import http from "http";
import https from "https";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import config from "../src/config.js";
import antigravityService from "../src/services/antigravityService.js";
import androidService from "../src/services/androidService.js";
import logger from "../src/utils/logger.js";

const execAsync = promisify(exec);

console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║                                                                        ║
║      💻 WHATSAPP DEV ASSISTANT - AGENTE LOCAL DO PC (WORKER)          ║
║         (Sincronização Automática com a Nuvem & Execução Local)       ║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝
`);

const CLOUD_URL = (config.cloudServerUrl || "http://localhost:3333").replace(/\/$/, "");
const SYNC_SECRET = config.syncSecret || "sync_default_token_9959";
const POLL_INTERVAL_MS = 10000; // 10 segundos

let isProcessing = false;

// Função auxiliar para fazer chamadas HTTP/HTTPS com JSON
function requestJson(urlStr, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const isHttps = url.protocol === "https:";
    const transport = isHttps ? https : http;

    const reqOptions = {
      method: options.method || "GET",
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        "User-Agent": "WhatsAppAssistant-PCWorker/1.0",
        "x-sync-token": SYNC_SECRET,
        ...(postData ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) } : {}),
        ...(options.headers || {})
      },
      timeout: 15000
    };

    const req = transport.request(reqOptions, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout na ligação ao servidor da nuvem"));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// 1. Atualizar repositório Git se configurado
async function checkGitUpdate() {
  try {
    const { stdout } = await execAsync("git remote -v", { cwd: config.rootDir });
    if (stdout && stdout.trim()) {
      logger.info("A verificar atualizações de código no Git...");
      const pullRes = await execAsync("git pull --no-edit", { cwd: config.rootDir });
      logger.info(`Git pull: ${pullRes.stdout.trim()}`);
    }
  } catch (e) {
    // Git pode não estar configurado com remote ainda, ignora silenciosamente
  }
}

// 2. Enviar batimento cardíaco (Heartbeat)
async function sendHeartbeat() {
  try {
    const payload = JSON.stringify({
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      uptimeSeconds: Math.round(os.uptime()),
      agyInstalled: antigravityService.isAgyInstalled(),
      projectsDir: config.projectsDir,
      projects: androidService.listAllProjects(),
      timestamp: new Date().toISOString()
    });

    const res = await requestJson(`${CLOUD_URL}/api/sync/heartbeat`, { method: "POST" }, payload);
    return res.data;
  } catch (err) {
    return null;
  }
}

// 3. Obter ordens pendentes para o PC
async function fetchPendingOrders() {
  try {
    const res = await requestJson(`${CLOUD_URL}/api/sync/orders/pending`);
    if (res.data?.success && Array.isArray(res.data.orders)) {
      return res.data.orders;
    }
  } catch (err) {
    // Nuvem temporariamente inacessível
  }
  return [];
}

// 4. Concluir ordem e enviar resultado para a Nuvem (que notifica WhatsApp)
async function reportOrderResult(orderId, result) {
  try {
    const payload = JSON.stringify(result);
    await requestJson(`${CLOUD_URL}/api/sync/orders/${orderId}/complete`, { method: "POST" }, payload);
    logger.info(`✅ Resultado da ordem #${orderId} reportado à Nuvem com sucesso.`);
  } catch (err) {
    logger.error(`Erro ao reportar conclusão da ordem #${orderId}:`, err);
  }
}

// 5. Executar uma ordem localmente no Windows
async function processOrderLocally(order) {
  logger.info(`⚡ [EXECUÇÃO PC] A processar ordem #${order.id}: "${order.order}"`);
  const startTime = Date.now();

  try {
    let projectDir = null;
    if (order.targetProject) {
      projectDir = config.projectsDir + "\\" + order.targetProject;
    }

    // Se for um comando de build específico
    if (order.order.startsWith("/build ") || order.order.startsWith("build ")) {
      const projName = order.order.replace(/^\/?build\s+/, "").trim();
      logger.info(`A iniciar compilação Android para ${projName}...`);
      const buildRes = await androidService.buildAndroidProject(projName, "debug");
      const durationSec = Math.round((Date.now() - startTime) / 1000);
      return {
        success: buildRes.success,
        output: buildRes.message + (buildRes.apk ? `\nAPK gerado: ${buildRes.apk.path}` : ""),
        durationSeconds: durationSec
      };
    }

    // Execução pelo Antigravity CLI
    const prompt = `Executa de forma autónoma a seguinte ordem solicitada via WhatsApp: "${order.order}". Faz as alterações necessárias e reporta de forma objetiva o que foi feito.`;
    const agyRes = await antigravityService.runAgyPrompt(prompt, projectDir);
    const durationSec = Math.round((Date.now() - startTime) / 1000);

    return {
      success: agyRes.success,
      output: agyRes.output,
      durationSeconds: durationSec
    };
  } catch (err) {
    return {
      success: false,
      output: `Erro na execução local no PC: ${err.message}`,
      durationSeconds: Math.round((Date.now() - startTime) / 1000)
    };
  }
}

// 6. Ciclo principal do Agente Local
async function syncCycle() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const hb = await sendHeartbeat();
    if (!hb) {
      // Servidor ainda não respondeu, tenta no próximo ciclo
      return;
    }

    const pendingOrders = await fetchPendingOrders();
    if (pendingOrders.length > 0) {
      logger.info(`📋 ${pendingOrders.length} ordem(ns) pendente(s) detetada(s) para execução no PC.`);

      for (const order of pendingOrders) {
        const result = await processOrderLocally(order);
        await reportOrderResult(order.id, result);
      }
    }
  } catch (err) {
    logger.warn(`Aviso no ciclo de sincronização: ${err.message}`);
  } finally {
    isProcessing = false;
  }
}

// Inicialização
async function main() {
  logger.info(`A iniciar Agente Local do PC...`);
  logger.info(`Conectando ao Servidor Nuvem: ${CLOUD_URL}`);

  // Aguardar ligação inicial
  await checkGitUpdate();

  // Executar primeiro ciclo imediato
  await syncCycle();

  // Manter em escuta periódica contínua
  setInterval(syncCycle, POLL_INTERVAL_MS);
}

main().catch((err) => {
  logger.error("Erro fatal no Agente Local do PC:", err);
});

