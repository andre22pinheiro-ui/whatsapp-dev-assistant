import { GoogleGenerativeAI } from "@google/generative-ai";
import config from "../config.js";
import logger from "../utils/logger.js";
import { readData, writeData } from "../utils/storage.js";

let genAI = null;

function getAiClient() {
  const key = config.geminiApiKey;
  if (!key) return null;
  if (!genAI) {
    genAI = new GoogleGenerativeAI(key);
  }
  return genAI;
}

// Obter padrões aprendidos (Harness Evolution)
export function getLearnedPatterns() {
  return readData("learned_patterns", []);
}

// Registar novo padrão aprendido
export function learnPattern(trigger, action, description = "") {
  const patterns = getLearnedPatterns();
  const cleanTrigger = trigger.toLowerCase().trim();
  const existingIdx = patterns.findIndex(p => p.trigger.toLowerCase() === cleanTrigger);

  const newEntry = {
    id: "pat_" + Date.now(),
    trigger: cleanTrigger,
    action: action.trim(),
    description: description || `Padrão aprendido para: ${cleanTrigger}`,
    createdAt: new Date().toISOString()
  };

  if (existingIdx !== -1) {
    patterns[existingIdx] = newEntry;
  } else {
    patterns.push(newEntry);
  }

  writeData("learned_patterns", patterns);
  logger.info(`🧠 Novo padrão de comportamento aprendido: "${cleanTrigger}" -> "${action}"`);
  return newEntry;
}

export async function processNaturalLanguage(userMessage, context = {}) {
  const client = getAiClient();
  const lower = userMessage.toLowerCase().trim();

  // 1. VERIFICAR SE CORRESPONDE A UM PADRÃO APRENDIDO PELO UTILIZADOR (Zero Overhead)
  const patterns = getLearnedPatterns();
  for (const pat of patterns) {
    if (lower === pat.trigger || lower.includes(pat.trigger)) {
      logger.info(`🧠 Padrão aprendido acionado: "${pat.trigger}"`);
      return {
        type: "learned_action",
        command: pat.action,
        description: pat.description
      };
    }
  }

  // 2. FALLBACK INTELIGENTE BASEADO EM INTENÇÕES DETERMINÍSTICAS (Sem custos de tokens)
  if (
    lower.includes("estado") ||
    lower.includes("status") ||
    lower.includes("como esta o pc") ||
    lower.includes("como está o pc") ||
    lower.includes("como esta o computador") ||
    lower.includes("como está o computador") ||
    lower.includes("memoria") ||
    lower.includes("memória") ||
    lower.includes("processador") ||
    lower.includes("cpu")
  ) {
    return { type: "action", action: "STATUS" };
  }

  if (
    lower.includes("print") ||
    lower.includes("screenshot") ||
    lower.includes("foto do ecr") ||
    lower.includes("captura de ecr")
  ) {
    return { type: "action", action: "SCREENSHOT" };
  }

  if (
    lower.includes("projetos") ||
    lower.includes("projects") ||
    lower.includes("quais sao os projetos") ||
    lower.includes("ver projetos")
  ) {
    return { type: "action", action: "LIST_PROJECTS" };
  }

  // Deteção de Diagnóstico e Auto-Cura de Projetos
  if (lower.startsWith("diagnostica ") || lower.startsWith("diagnostico ") || lower.includes("saude do ") || lower.includes("saúde do ")) {
    let proj = lower.replace(/^(diagnostica|diagnostico|saude do|saúde do)\s+/, "").trim().split(" ")[0];
    if (context.projects) {
      const match = context.projects.find(p => p.toLowerCase().includes(proj));
      if (match) proj = match;
    }
    return { type: "action", action: "DIAGNOSE", project: proj };
  }

  if (lower.startsWith("corrige ") || lower.startsWith("corrigir ") || lower.startsWith("repara ") || lower.startsWith("fix ")) {
    let proj = lower.replace(/^(corrige|corrigir|repara|fix)\s+/, "").trim().split(" ")[0];
    if (context.projects) {
      const match = context.projects.find(p => p.toLowerCase().includes(proj));
      if (match) proj = match;
    }
    return { type: "action", action: "FIX", project: proj };
  }

  if (
    lower.startsWith("compilar ") ||
    lower.startsWith("build ") ||
    lower.includes("faz build do ") ||
    lower.includes("faz o build do ") ||
    lower.includes("compila o ")
  ) {
    let projName = "";
    const words = lower.replace(/^(faz o build do|faz build do|compila o|compilar|build)\s+/, "").trim().split(" ");
    projName = words[0];
    if (context.projects && context.projects.length > 0) {
      const found = context.projects.find(p => p.toLowerCase().includes(projName));
      if (found) projName = found;
    }
    return { type: "action", action: "BUILD_ANDROID", project: projName };
  }

  if (
    lower.startsWith("tarefa ") ||
    lower.startsWith("adicionar tarefa ") ||
    lower.startsWith("anota ") ||
    lower.startsWith("lembrar de ")
  ) {
    const taskText = userMessage.replace(/^(tarefa|adicionar tarefa|anota|lembrar de)\s+/i, "").trim();
    return { type: "action", action: "ADD_TASK", param: taskText };
  }

  if (
    lower === "ajuda" ||
    lower === "menu" ||
    lower === "o que sabes fazer" ||
    lower === "comandos"
  ) {
    return { type: "action", action: "HELP" };
  }

  // 3. PROCESSAMENTO COM IA GEMINI (Cascata adaptativa com suporte aos modelos mais recentes)
  if (!client) {
    return {
      type: "no_key",
      reply:
        "💡 *Comando recebido.*\n" +
        "Para conversar livremente com IA, podes configurar uma chave Gemini no painel web ou com `/config key <chave>`.\n" +
        "Comandos diretos disponíveis: `/status`, `/print`, `/projetos`, `/diagnostico <proj>`, `/corrigir <proj>`, `/build <proj>`, `/apk <proj>`."
    };
  }

  const CANDIDATE_MODELS = [
    "gemini-flash-lite-latest",
    "gemini-3.8-flash",
    "gemini-2.5-flash-lite",
    "gemini-flash-latest"
  ];

  let lastError = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: `
Você é o assistente pessoal e engenheiro sénior conectado ao computador do utilizador (Surface Pro).
Capacidades e projetos disponíveis:
- Projetos: ${JSON.stringify(context.projects || [])}
- Padrões aprendidos: ${JSON.stringify(patterns)}
Responda sempre em português e, quando aplicável, devolva um JSON com:
{
  "action": "BUILD_ANDROID" | "DIAGNOSE" | "FIX" | "STATUS" | "SCREENSHOT" | "ADD_TASK" | "LIST_PROJECTS" | "CHAT",
  "project": "nome-do-projeto-se-aplicavel",
  "param": "detalhes",
  "reply": "mensagem amigável para WhatsApp"
}
Se for conversa geral, responda com texto útil e natural.
`
      });

      const result = await model.generateContent(userMessage);
      const text = result.response.text().trim();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return { type: "action", ...parsed };
        } catch (e) {}
      }

      return { type: "chat", reply: text };
    } catch (error) {
      lastError = error;
      logger.warn(`Modelo ${modelName} indisponível (${error.message.split('\n')[0]}). A tentar modelo alternativo...`);
    }
  }

  logger.error("Todos os modelos Gemini falharam:", lastError?.message);
  return {
    type: "error",
    reply: `⚠️ A IA está temporariamente indisponível: ${lastError?.message?.split('\n')[0] || "Erro de rede"}.\nUse comandos diretos: \`/status\`, \`/projetos\`, \`/ajuda\`, \`/print\`.`
  };
}

export default {
  processNaturalLanguage,
  getLearnedPatterns,
  learnPattern
};
