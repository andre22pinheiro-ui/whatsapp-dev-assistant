import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import config, { saveSettings } from "../config.js";
import logger from "../utils/logger.js";

function stripAnsi(text) {
  if (!text) return "";
  return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");
}

export function isAgyInstalled() {
  return fs.existsSync(config.agyPath);
}

const localOrdersFile = path.join(config.dataDir, "whatsapp_orders.json");

function getBrainOrdersFile() {
  const brainDir = config.antigravityBrainDir;
  if (!fs.existsSync(brainDir)) {
    try {
      fs.mkdirSync(brainDir, { recursive: true });
    } catch (e) {}
  }
  return path.join(brainDir, "whatsapp_orders.json");
}

function getGlobalOrdersFile() {
  const globalDir = config.antigravityGlobalDir;
  if (!fs.existsSync(globalDir)) {
    try {
      fs.mkdirSync(globalDir, { recursive: true });
    } catch (e) {}
  }
  return path.join(globalDir, "whatsapp_orders.json");
}

export function getOrders() {
  try {
    const brainFile = getBrainOrdersFile();
    if (fs.existsSync(brainFile)) {
      return JSON.parse(fs.readFileSync(brainFile, "utf8"));
    }
  } catch (e) {
    logger.warn(`Erro ao ler ordens do brain: ${e.message}`);
  }

  try {
    if (fs.existsSync(localOrdersFile)) {
      return JSON.parse(fs.readFileSync(localOrdersFile, "utf8"));
    }
  } catch (e) {
    logger.warn(`Erro ao ler ordens locais: ${e.message}`);
  }

  return [];
}

export function saveOrders(orders) {
  const jsonStr = JSON.stringify(orders, null, 2);

  // 1. Guardar localmente no whatsapp-dev-assistant
  try {
    fs.writeFileSync(localOrdersFile, jsonStr, "utf8");
  } catch (e) {
    logger.error(`Erro ao guardar ordens locais: ${e.message}`);
  }

  // 2. Guardar na pasta de artifacts/brain da conversa ativa do Antigravity
  try {
    const brainFile = getBrainOrdersFile();
    fs.writeFileSync(brainFile, jsonStr, "utf8");
  } catch (e) {
    logger.error(`Erro ao guardar ordens no brain da conversa: ${e.message}`);
  }

  // 3. Guardar no diretório global do Antigravity
  try {
    const globalFile = getGlobalOrdersFile();
    fs.writeFileSync(globalFile, jsonStr, "utf8");

    // Guardar ponteiro de sessão ativa
    const activeSessionFile = path.join(config.antigravityGlobalDir, "active_session.json");
    fs.writeFileSync(
      activeSessionFile,
      JSON.stringify(
        {
          conversationId: config.activeConversationId,
          brainDir: config.antigravityBrainDir,
          lastOrderAt: new Date().toISOString(),
          totalOrders: orders.length
        },
        null,
        2
      ),
      "utf8"
    );
  } catch (e) {}
}

export function addOrder({ orderText, senderNumber, targetProject = null }) {
  const orders = getOrders();
  const orderId = `ORD-${Date.now().toString().slice(-4)}`;

  const newOrder = {
    id: orderId,
    conversationId: config.activeConversationId,
    timestamp: new Date().toISOString(),
    from: senderNumber || "WhatsApp",
    order: orderText.trim(),
    targetProject: targetProject || null,
    status: "executing",
    result: null,
    createdAt: new Date().toLocaleString("pt-PT")
  };

  orders.unshift(newOrder); // O mais recente primeiro
  // Manter no máximo 100 ordens
  if (orders.length > 100) orders.length = 100;

  saveOrders(orders);
  logger.info(`📋 Nova ordem registada: [${orderId}] "${orderText}" (Chat: ${config.activeConversationId})`);
  return newOrder;
}

export function updateOrder(orderId, updates) {
  const orders = getOrders();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx !== -1) {
    orders[idx] = { ...orders[idx], ...updates, updatedAt: new Date().toISOString() };
    saveOrders(orders);
    return orders[idx];
  }
  return null;
}

export async function runAgyPrompt(prompt, projectDir = null) {
  if (!isAgyInstalled()) {
    return {
      success: false,
      output: `O comando Antigravity CLI (agy.exe) não foi encontrado em: ${config.agyPath}`
    };
  }

  return new Promise((resolve) => {
    logger.info(`A executar Antigravity CLI com prompt: "${prompt}"`);

    const args = [
      "-p",
      prompt,
      "--dangerously-skip-permissions",
      "--output-format",
      "text"
    ];

    if (projectDir && fs.existsSync(projectDir)) {
      args.push("--add-dir", projectDir);
    }

    const child = spawn(config.agyPath, args, {
      cwd: projectDir || config.projectsDir,
      env: process.env,
      shell: false
    });

    let stdoutData = "";
    let stderrData = "";

    child.stdout.on("data", (data) => {
      stdoutData += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderrData += data.toString();
    });

    child.on("close", (code) => {
      const cleanStdout = stripAnsi(stdoutData).trim();
      const cleanStderr = stripAnsi(stderrData).trim();

      if (code === 0) {
        logger.info(`Antigravity concluiu a ordem com sucesso.`);
        resolve({
          success: true,
          output: cleanStdout || "Tarefa concluída pelo Antigravity sem mensagem de retorno."
        });
      } else {
        logger.warn(`Antigravity terminou com código ${code}`);
        resolve({
          success: false,
          output: cleanStderr || cleanStdout || `Erro na execução do Antigravity (Código: ${code})`
        });
      }
    });

    child.on("error", (err) => {
      logger.error(`Erro ao iniciar Antigravity: ${err.message}`);
      resolve({
        success: false,
        output: `Falha ao iniciar processo agy.exe: ${err.message}`
      });
    });

    // Timeout de segurança (5 minutos)
    setTimeout(() => {
      if (!child.killed) {
        child.kill();
        resolve({
          success: false,
          output: "Tempo limite de execução do Antigravity excedido (5 minutos)."
        });
      }
    }, 300000);
  });
}

export async function executeChatOrder(order) {
  const startTime = Date.now();
  let projectDir = null;

  // Se o CLI Antigravity não existir (ambiente Cloud / Linux), guardar na fila do PC
  if (!isAgyInstalled() || config.isCloud) {
    const { pcSyncService } = await import("./pcSyncService.js");
    pcSyncService.queueOrderForPc(order);
    const isPcUp = pcSyncService.isPcOnline();
    return {
      success: true,
      queued: true,
      isPcOnline: isPcUp,
      output: isPcUp
        ? "⚡ O teu PC está ligado! A ordem foi enviada para o computador e está a ser processada..."
        : "⏳ O teu PC físico está desligado. A ordem foi guardada na fila de espera com segurança e será executada automaticamente assim que ligares o computador.",
      durationSeconds: 0
    };
  }

  if (order.targetProject) {
    projectDir = path.isAbsolute(order.targetProject)
      ? order.targetProject
      : path.join(config.projectsDir, order.targetProject);
  }

  const prompt = `Executa de forma autónoma e completa a seguinte ordem enviada pelo utilizador via WhatsApp para o chat Antigravity: "${order.order}". Se a tarefa envolver verificar ficheiros, compilar ou corrigir bugs, faz as alterações necessárias e reporta de forma clara e objetiva o que foi feito.`;

  const result = await runAgyPrompt(prompt, projectDir);
  const durationSec = Math.round((Date.now() - startTime) / 1000);

  const updatedOrder = updateOrder(order.id, {
    status: result.success ? "completed" : "failed",
    result: result.output,
    durationSeconds: durationSec,
    completedAt: new Date().toLocaleString("pt-PT")
  });

  return {
    ...result,
    order: updatedOrder,
    durationSeconds: durationSec
  };
}

export default {
  isAgyInstalled,
  getOrders,
  saveOrders,
  addOrder,
  updateOrder,
  runAgyPrompt,
  executeChatOrder
};
