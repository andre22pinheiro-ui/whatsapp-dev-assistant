#!/usr/bin/env node
/**
 * Antigravity AgentX MCP Server for Android Studio & Antigravity IDE
 * Implementa o protocolo MCP (Model Context Protocol) via stdio (JSON-RPC 2.0).
 */

import readline from "readline";
import universalProjectService from "../src/services/universalProjectService.js";
import { executeAgentTask } from "../src/services/agentxService.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

const TOOLS = [
  {
    name: "list_projects",
    description: "Lista todos os 22+ projetos do ecossistema (Desktop/projectos, AndroidStudioProjects, GitHub) com estado do Git e do Android Studio.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Filtro opcional por nome ou tipo de projeto" }
      }
    }
  },
  {
    name: "execute_agent_task",
    description: "Executa uma ordem autónoma (AgentX / BabyAGI + Auto-GPT) em qualquer projeto selecionado.",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Nome ou caminho do projeto (ex: matchpro, RegulacaoEmocional, game)" },
        task: { type: "string", description: "Descrição clara da tarefa a executar" },
        mode: { type: "string", enum: ["auto", "ml", "git", "build", "studio"], description: "Modo de execução" }
      },
      required: ["task"]
    }
  },
  {
    name: "run_ml_pipeline",
    description: "Executa o pipeline autónomo de Machine Learning (agentx_ml.py) com validação temporal/estratificada, benchmarks e afinação.",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Nome do projeto alvo" },
        objective: { type: "string", description: "Objetivo do modelo ou análise" }
      }
    }
  },
  {
    name: "git_operation",
    description: "Executa comandos Git num projeto (status, diff, log, commit, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Nome do projeto" },
        command: { type: "string", description: "Comando Git (ex: status, diff, log -n 5)" }
      },
      required: ["project", "command"]
    }
  },
  {
    name: "open_in_android_studio",
    description: "Abre o projeto especificado diretamente no Android Studio.",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Nome do projeto a abrir" }
      },
      required: ["project"]
    }
  }
];

function sendResponse(id, result, error = null) {
  const resp = { jsonrpc: "2.0", id };
  if (error) {
    resp.error = error;
  } else {
    resp.result = result;
  }
  process.stdout.write(JSON.stringify(resp) + "\n");
}

rl.on("line", async (line) => {
  if (!line.trim()) return;

  let request;
  try {
    request = JSON.parse(line);
  } catch (e) {
    return;
  }

  const { id, method, params } = request;

  if (method === "initialize") {
    sendResponse(id, {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: "antigravity-agentx",
        version: "1.0.0"
      }
    });
    return;
  }

  if (method === "notifications/initialized") {
    // Acknowledged
    return;
  }

  if (method === "tools/list") {
    sendResponse(id, { tools: TOOLS });
    return;
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params || {};

    try {
      if (name === "list_projects") {
        const list = await universalProjectService.listAllProjects(true);
        let filtered = list;
        if (args?.filter) {
          const f = args.filter.toLowerCase();
          filtered = list.filter(p => p.name.toLowerCase().includes(f) || p.type.toLowerCase().includes(f));
        }
        sendResponse(id, {
          content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }]
        });
        return;
      }

      if (name === "execute_agent_task") {
        const res = await executeAgentTask({
          task: args.task,
          projectName: args.project,
          mode: args.mode || "auto"
        });
        sendResponse(id, {
          content: [{ type: "text", text: res.output }]
        });
        return;
      }

      if (name === "run_ml_pipeline") {
        const res = await executeAgentTask({
          task: args.objective || "Executar pipeline autónomo de Machine Learning",
          projectName: args.project,
          mode: "ml"
        });
        sendResponse(id, {
          content: [{ type: "text", text: res.output }]
        });
        return;
      }

      if (name === "git_operation") {
        const res = await universalProjectService.runGit(args.project, args.command);
        sendResponse(id, {
          content: [{ type: "text", text: res.output || res.error }]
        });
        return;
      }

      if (name === "open_in_android_studio") {
        const res = await universalProjectService.openInAndroidStudio(args.project);
        sendResponse(id, {
          content: [{ type: "text", text: res.message || res.error }]
        });
        return;
      }

      sendResponse(id, null, { code: -32601, message: `Tool "${name}" não encontrada.` });
    } catch (err) {
      sendResponse(id, null, { code: -32603, message: err.message });
    }
    return;
  }

  // Métodos não implementados
  if (id !== undefined) {
    sendResponse(id, null, { code: -32601, message: `Método "${method}" não suportado.` });
  }
});

