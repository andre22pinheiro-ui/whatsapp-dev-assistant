import http from "http";
import https from "https";
import os from "os";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import config from "../src/config.js";
import antigravityService from "../src/services/antigravityService.js";
import androidService from "../src/services/androidService.js";
import universalProjectService from "../src/services/universalProjectService.js";
import agentxService from "../src/services/agentxService.js";
import appScaffoldService from "../src/services/appScaffoldService.js";
import emailService from "../src/services/emailService.js";
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
let syncCounter = 0;

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
    const allProjects = await universalProjectService.listAllProjects(false);
    const payload = JSON.stringify({
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      uptimeSeconds: Math.round(os.uptime()),
      agyInstalled: antigravityService.isAgyInstalled(),
      projectsDir: config.projectsDir,
      projects: allProjects,
      totalProjects: allProjects.length,
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

// 5. Executar uma ordem localmente no Windows com o Universal AgentX Engine
async function processOrderLocally(order) {
  logger.info(`⚡ [EXECUÇÃO PC] A processar ordem #${order.id}: "${order.order}"`);
  const startTime = Date.now();

  try {
    const rawOrder = order.order.trim();

    // 5.1 Listar todos os projetos
    if (/^\/?projetos/i.test(rawOrder)) {
      const projects = await universalProjectService.listAllProjects(true);
      const lines = projects.map(p => {
        const studio = p.isOpenInStudio ? " [ABERTO NO STUDIO]" : "";
        const git = p.hasGit ? `Git: ${p.git.branch} (${p.git.dirtyFiles} alt)` : "Sem Git";
        return `• *${p.name}* (${p.type}) - ${git}${studio}`;
      });
      return {
        success: true,
        output: `📁 *Inventário Universal de Projetos (${projects.length}):*\n\n${lines.join("\n")}`,
        durationSeconds: Math.round((Date.now() - startTime) / 1000)
      };
    }

    // 5.2 Abrir no Android Studio (/studio <projeto>)
    if (/^\/?studio\s+/i.test(rawOrder)) {
      const projName = rawOrder.replace(/^\/?studio\s+/i, "").trim();
      const openRes = await universalProjectService.openInAndroidStudio(projName);
      return {
        success: openRes.success,
        output: openRes.message || openRes.error,
        durationSeconds: Math.round((Date.now() - startTime) / 1000)
      };
    }

    // 5.3 Comandos Git (/git <projeto> <comando>)
    if (/^\/?git\s+/i.test(rawOrder)) {
      const parts = rawOrder.replace(/^\/?git\s+/i, "").trim().split(" ");
      const projName = parts[0];
      const gitCmd = parts.slice(1).join(" ") || "status";
      const gitRes = await universalProjectService.runGit(projName, gitCmd);
      return {
        success: gitRes.success,
        output: `[Git: ${gitRes.project}] $ git ${gitCmd}\n\n${gitRes.output || gitRes.error}`,
        durationSeconds: Math.round((Date.now() - startTime) / 1000)
      };
    }

    // 5.4 Machine Learning (/ml [projeto] : <objetivo>)
    if (/^\/?ml\b/i.test(rawOrder)) {
      let targetProj = order.targetProject || null;
      let mlPrompt = rawOrder.replace(/^\/?ml\s*/i, "").trim();
      if (mlPrompt.includes(":")) {
        const [projPart, ...rest] = mlPrompt.split(":");
        targetProj = projPart.trim();
        mlPrompt = rest.join(":").trim();
      }
      const mlRes = await agentxService.executeAgentTask({
        task: mlPrompt || "Executar pipeline de Machine Learning",
        projectName: targetProj,
        mode: "ml"
      });
      return {
        success: mlRes.success,
        output: mlRes.output,
        durationSeconds: mlRes.durationSeconds
      };
    }

    // 5.4.1 Criação Autónoma de App (/criar-app <nome> : <prompt>)
    if (/^\/?(criar[-_]app|gerar[-_]app)\b/i.test(rawOrder)) {
      const promptPart = rawOrder.replace(/^\/?(criar[-_]app|gerar[-_]app)\s*/i, "").trim();
      let appName = "";
      let appPrompt = "";
      if (promptPart.includes(":")) {
        const [p1, ...p2] = promptPart.split(":");
        appName = p1.trim();
        appPrompt = p2.join(":").trim();
      } else {
        const parts = promptPart.split(" ");
        appName = parts[0];
        appPrompt = parts.slice(1).join(" ") || `Aplicação ${appName}`;
      }

      const buildRes = await appScaffoldService.buildAndDeployApp({
        name: appName,
        prompt: appPrompt
      });

      return {
        success: true,
        output:
          `🚀 *APP GERADA E PUBLICADA COM SUCESSO!*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📱 *Aplicação:* *${buildRes.title}*\n` +
          `⏱️ *Tempo:* ${buildRes.durationSeconds}s\n\n` +
          `🌐 *Vercel Web App:*\n${buildRes.vercelUrl}\n\n` +
          `🐙 *GitHub:*\n${buildRes.githubUrl}\n\n` +
          `📦 *Android APK (GitHub Actions):*\n${buildRes.actionsUrl}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━`,
        durationSeconds: buildRes.durationSeconds
      };
    }

    // 5.5 Execução Autónoma com o Motor AgentX (/exec ou ordem padrão)
    let targetProj = order.targetProject || null;
    let taskText = rawOrder;
    if (taskText.startsWith("/exec ") || taskText.startsWith("/ordem ")) {
      taskText = taskText.replace(/^\/?(exec|ordem)\s+/i, "").trim();
      if (taskText.includes(":")) {
        const [projPart, ...rest] = taskText.split(":");
        targetProj = projPart.trim();
        taskText = rest.join(":").trim();
      }
    }

    const agentRes = await agentxService.executeAgentTask({
      task: taskText,
      projectName: targetProj,
      mode: "auto"
    });

    return {
      success: agentRes.success,
      output: agentRes.output,
      durationSeconds: agentRes.durationSeconds
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

    // Verificação periódica autónoma de prompts de apps recebidos por email (a cada ~60s)
    syncCounter++;
    if (syncCounter % 6 === 0 && emailService.isConfigured()) {
      try {
        await emailService.checkAppPromptEmails();
      } catch (emErr) {
        logger.warn(`Aviso ao verificar emails de prompts no worker: ${emErr.message}`);
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

  // Iniciar escuta do Telegram Bot se configurado (100% Free)
  try {
    const { telegramService } = await import("../src/services/telegramService.js");
    if (telegramService.isConfigured()) {
      telegramService.startPolling();
    }
  } catch (tErr) {}

  // Executar primeiro ciclo imediato
  await syncCycle();

  // Manter em escuta periódica contínua
  setInterval(syncCycle, POLL_INTERVAL_MS);
}

import fs from "fs";

function logCrash(type, err) {
  const line = `\n[${new Date().toISOString()}] [${type}] ${err?.stack || err}\n`;
  try {
    fs.appendFileSync(path.join(config.dataDir, "crash.log"), line, "utf8");
  } catch(e) {}
}

process.on("uncaughtException", (err) => {
  logCrash("UNCAUGHT_EXCEPTION", err);
  logger.error("Exceção não tratada capturada no PC Worker:", err);
});

process.on("unhandledRejection", (reason) => {
  logCrash("UNHANDLED_REJECTION", reason);
  logger.error("Promessa rejeitada não tratada no PC Worker:", reason);
});

process.on("exit", (code) => {
  logCrash("PROCESS_EXIT", `Process exited with code ${code}`);
});

main().catch((err) => {
  logger.error("Erro fatal no Agente Local do PC:", err);
});

