#!/usr/bin/env node
/**
 * AgentX Universal CLI Runner
 * Permite invocar o Agente Autónomo diretamente de:
 * 1. Linha de Comandos
 * 2. Android Studio (External Tools / Gradle)
 * 3. Atalhos do Windows / WhatsApp Worker
 */

import path from "path";
import { executeAgentTask } from "../src/services/agentxService.js";
import universalProjectService from "../src/services/universalProjectService.js";

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    project: null,
    task: null,
    mode: "auto",
    list: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--project" || arg === "-p") {
      options.project = args[++i];
    } else if (arg === "--task" || arg === "-t") {
      options.task = args[++i];
    } else if (arg === "--mode" || arg === "-m") {
      options.mode = args[++i];
    } else if (arg === "--list" || arg === "-l") {
      options.list = true;
    } else if (!options.task) {
      options.task = arg;
    }
  }

  return options;
}

async function main() {
  const opts = parseArgs();

  if (opts.list) {
    console.log("🔍 A listar todos os projetos monitorizados...");
    const projects = await universalProjectService.listAllProjects(true);
    console.log(`\nEncontrados ${projects.length} projetos:\n`);
    for (const p of projects) {
      const git = p.git.hasGit ? `Git: ${p.git.branch} (${p.git.dirtyFiles} alterados, ${p.git.commits} commits)` : "Sem Git";
      const studio = p.isOpenInStudio ? "[ABERTO NO ANDROID STUDIO]" : "";
      console.log(`• ${p.name.padEnd(25)} | Tipo: ${p.type.padEnd(18)} | ${git} ${studio}`);
    }
    process.exit(0);
  }

  if (!opts.task) {
    console.log(`
Uso: node agentx-runner.js [opções]
Opções:
  -p, --project <nome/caminho>  Nome ou diretório do projeto alvo
  -t, --task "<descrição>"      Instrução ou objetivo para o agente autónomo
  -m, --mode <auto|ml|git|build|studio>  Modo específico de execução
  -l, --list                    Lista todos os projetos disponíveis
    `);
    process.exit(1);
  }

  console.log(`⚡ A iniciar execução AgentX...`);
  console.log(`Projeto: ${opts.project || "(Global/Auto)"}`);
  console.log(`Modo: ${opts.mode}`);
  console.log(`Tarefa: "${opts.task}"\n`);

  try {
    const res = await executeAgentTask({
      task: opts.task,
      projectName: opts.project,
      mode: opts.mode
    });

    console.log("\n================ RESULTADO DA EXECUÇÃO ================\n");
    console.log(res.output);
    console.log(`\nStatus: ${res.success ? "SUCESSO" : "FALHA"} | Tempo: ${res.durationSeconds}s`);
    process.exit(res.success ? 0 : 1);
  } catch (err) {
    console.error("❌ Erro fatal:", err.message);
    process.exit(1);
  }
}

main();

