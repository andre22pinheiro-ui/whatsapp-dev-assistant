import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import universalProjectService from "./universalProjectService.js";
import antigravityService from "./antigravityService.js";
import androidService from "./androidService.js";
import logger from "../utils/logger.js";

const execAsync = promisify(exec);

const ML_ENGINE_SCRIPT = path.resolve("C:/Users/Surface_Dpc/Desktop/projectos/whatsapp-dev-assistant/src/ml/agentx_ml.py");

/**
 * Universal AgentX Orchestrator:
 * Implementa a arquitetura de Agentes Autónomos (BabyAGI + Auto-GPT) com Machine Learning
 * aplicável a qualquer projeto em Desktop\projectos, AndroidStudioProjects e GitHub.
 */
export async function executeAgentTask({ task, projectName = null, mode = "auto", onUpdate = null }) {
  const startTime = Date.now();
  logger.info(`🤖 [AGENTX] A iniciar tarefa autónoma: "${task}" | Projeto alvo: ${projectName || "Geral"}`);

  // 1. Resolver projeto alvo
  let targetProject = null;
  if (projectName) {
    targetProject = await universalProjectService.findProject(projectName);
  }

  // 2. Se a tarefa for de Machine Learning ou análise de dados
  const isMlTask = mode === "ml" || /machine learning|ml|dataset|previsão|treino|modelo|eda|overfitting/i.test(task);
  if (isMlTask) {
    return await runMlPipeline(task, targetProject, onUpdate);
  }

  // 3. Se a tarefa for de Git
  if (mode === "git" || /^git\s+/i.test(task)) {
    const gitCmd = task.replace(/^git\s+/i, "").trim();
    const projName = targetProject ? targetProject.name : "whatsapp-dev-assistant";
    const res = await universalProjectService.runGit(projName, gitCmd);
    const duration = Math.round((Date.now() - startTime) / 1000);
    return {
      success: res.success,
      project: projName,
      type: "git",
      output: `[Git: ${projName}] $ git ${gitCmd}\n\n${res.output || res.error}`,
      durationSeconds: duration
    };
  }

  // 4. Se a tarefa for de Compilação
  if (mode === "build" || /^\/?build\s+/i.test(task)) {
    const projName = targetProject ? targetProject.name : task.replace(/^\/?build\s+/i, "").trim();
    const buildRes = await androidService.buildAndroidProject(projName, "debug");
    const duration = Math.round((Date.now() - startTime) / 1000);
    return {
      success: buildRes.success,
      project: projName,
      type: "build",
      output: buildRes.message + (buildRes.apk ? `\n\n📦 APK Gerado: ${buildRes.apk.path} (${buildRes.apk.sizeMb} MB)` : ""),
      apk: buildRes.apk,
      durationSeconds: duration
    };
  }

  // 5. Se a tarefa for abrir no Android Studio
  if (/^\/?studio\s+/i.test(task) || mode === "studio") {
    const projName = targetProject ? targetProject.name : task.replace(/^\/?studio\s+/i, "").trim();
    const openRes = await universalProjectService.openInAndroidStudio(projName);
    const duration = Math.round((Date.now() - startTime) / 1000);
    return {
      success: openRes.success,
      project: projName,
      type: "studio",
      output: openRes.message || openRes.error,
      durationSeconds: duration
    };
  }

  // 6. Execução Autónoma de Tarefa (BabyAGI + Auto-GPT via Antigravity Engine)
  const cwd = targetProject ? targetProject.path : null;
  const projectContext = targetProject
    ? `\nContexto do Projeto: ${targetProject.name} (${targetProject.type}, Git branch: ${targetProject.git?.branch || 'main'}, Caminho: ${targetProject.path})`
    : "";

  const augmentedPrompt = `[AgentX Autonomous Task Loop]
Objetivo: ${task}${projectContext}
Diretrizes:
1. Decompõe o objetivo nas etapas necessárias (BabyAGI task prioritization).
2. Executa as alterações de código, testes ou configurações com código 100% completo e funcional.
3. Se fizeres alterações em ficheiros, efetua 'git add' e 'git commit' descritivo.
4. Fornece um relatório final conciso em Português com o que foi implementado e verificado.`;

  const agyRes = await antigravityService.runAgyPrompt(augmentedPrompt, cwd);
  const duration = Math.round((Date.now() - startTime) / 1000);

  return {
    success: agyRes.success,
    project: targetProject ? targetProject.name : "Sistema",
    type: "agentx_task",
    output: agyRes.output || "Tarefa concluída pelo motor AgentX.",
    durationSeconds: duration
  };
}

/**
 * Executa o Pipeline de Machine Learning autónomo com regras rigorosas (ml-best-practices)
 */
async function runMlPipeline(task, targetProject, onUpdate = null) {
  const startTime = Date.now();
  const projPath = targetProject ? targetProject.path : "C:/Users/Surface_Dpc/Desktop/projectos/whatsapp-dev-assistant";

  logger.info(`🧠 [AGENTX-ML] A iniciar pipeline de ML para: "${task}"`);

  if (!fs.existsSync(ML_ENGINE_SCRIPT)) {
    return {
      success: false,
      output: `Script de Machine Learning não encontrado em ${ML_ENGINE_SCRIPT}`,
      durationSeconds: 0
    };
  }

  try {
    // Executar o motor AgentX-ML em Python
    const cmd = `python "${ML_ENGINE_SCRIPT}"`;
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: projPath,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" }
    });

    const output = (stdout || stderr || "").trim();
    const duration = Math.round((Date.now() - startTime) / 1000);

    return {
      success: true,
      project: targetProject ? targetProject.name : "Geral",
      type: "ml_pipeline",
      output: `🤖 [AgentX ML Pipeline Executado com Sucesso em ${duration}s]\n\n${output}`,
      durationSeconds: duration
    };
  } catch (err) {
    const duration = Math.round((Date.now() - startTime) / 1000);
    return {
      success: false,
      project: targetProject ? targetProject.name : "Geral",
      type: "ml_pipeline",
      output: `❌ Erro na execução do AgentX ML Pipeline: ${err.message}\n${err.stdout || ""}\n${err.stderr || ""}`,
      durationSeconds: duration
    };
  }
}

export default {
  executeAgentTask,
  runMlPipeline
};

