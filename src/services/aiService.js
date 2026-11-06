import { GoogleGenerativeAI } from "@google/generative-ai";
import config from "../config.js";
import logger from "../utils/logger.js";
import { readData, writeData } from "../utils/storage.js";

let genAI = null;
let currentApiKey = null;

function getAiClient() {
  const key = config.geminiApiKey;
  if (!key) return null;
  if (!genAI || currentApiKey !== key) {
    genAI = new GoogleGenerativeAI(key);
    currentApiKey = key;
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

  // Deteção rápida de Gestor Pessoal e Painel Diário
  if (
    lower === "gestor" ||
    lower === "gestor pessoal" ||
    lower === "painel pessoal" ||
    lower === "meu dia" ||
    lower === "resumo do dia" ||
    lower === "painel" ||
    lower === "o meu painel"
  ) {
    return { type: "action", action: "SHOW_MANAGER" };
  }

  // Deteção rápida de Eventos e Calendário
  if (
    lower === "hoje" ||
    lower === "o que tenho hoje" ||
    lower === "o que tenho hoje?" ||
    lower === "agenda de hoje" ||
    lower === "rever hoje" ||
    lower === "eventos de hoje" ||
    lower === "compromissos de hoje" ||
    lower === "meu dia hoje"
  ) {
    return { type: "action", action: "TODAY_EVENTS" };
  }

  if (
    lower === "amanha" ||
    lower === "amanhã" ||
    lower === "o que tenho amanha" ||
    lower === "o que tenho amanhã" ||
    lower === "o que tenho amanha?" ||
    lower === "o que tenho amanhã?" ||
    lower === "agenda de amanha" ||
    lower === "agenda de amanhã" ||
    lower === "rever amanha" ||
    lower === "rever amanhã" ||
    lower === "eventos de amanha" ||
    lower === "eventos de amanhã"
  ) {
    return { type: "action", action: "TOMORROW_EVENTS" };
  }

  if (
    lower.startsWith("procura evento ") ||
    lower.startsWith("procurar evento ") ||
    lower.startsWith("pesquisa evento ") ||
    lower.startsWith("pesquisar evento ") ||
    lower.startsWith("pesquisa na agenda ") ||
    lower.startsWith("procura na agenda ")
  ) {
    const term = userMessage.replace(/^(procura evento|procurar evento|pesquisa evento|pesquisar evento|pesquisa na agenda|procura na agenda)\s+/i, "").trim();
    return { type: "action", action: "SEARCH_EVENTS", param: term };
  }

  if (
    lower.startsWith("agenda ") ||
    lower.startsWith("agendar ") ||
    lower.startsWith("marca ") ||
    lower.startsWith("marcar ") ||
    lower.startsWith("evento ") ||
    lower.startsWith("adiciona evento ") ||
    lower.startsWith("adicionar evento ") ||
    lower.startsWith("anota evento ") ||
    lower.startsWith("anotar evento ") ||
    lower.startsWith("anota no calendario ") ||
    lower.startsWith("anota no calendário ") ||
    lower.startsWith("anotar no calendario ") ||
    lower.startsWith("anotar no calendário ") ||
    lower.startsWith("marca no calendario ") ||
    lower.startsWith("marca no calendário ")
  ) {
    const eventPhrase = userMessage.replace(/^(agenda|agendar|marca|marcar|evento|adiciona evento|adicionar evento|anota evento|anotar evento|anota no calendario|anota no calendário|anotar no calendario|anotar no calendário|marca no calendario|marca no calendário)\s+/i, "").trim();
    return { type: "action", action: "ADD_EVENT", param: eventPhrase };
  }

  if (
    lower === "agenda" ||
    lower === "calendario" ||
    lower === "calendário" ||
    lower === "eventos" ||
    lower === "ver agenda" ||
    lower === "rever agenda" ||
    lower === "rever calendario" ||
    lower === "rever calendário" ||
    lower === "ver eventos" ||
    lower === "o que tenho marcado" ||
    lower === "o que tenho marcado?"
  ) {
    return { type: "action", action: "LIST_EVENTS" };
  }

  // Deteção rápida de Rascunhos de Email
  if (
    lower === "rascunhos" ||
    lower === "ver rascunhos" ||
    lower === "rever rascunhos" ||
    lower === "os meus rascunhos" ||
    lower === "rascunhos de email" ||
    lower === "emails por enviar"
  ) {
    return { type: "action", action: "LIST_DRAFTS" };
  }

  if (
    lower.startsWith("anota email ") ||
    lower.startsWith("anotar email ") ||
    lower.startsWith("rascunho de email ") ||
    lower.startsWith("rascunho email ") ||
    lower.startsWith("guardar rascunho ")
  ) {
    const draftText = userMessage.replace(/^(anota email|anotar email|rascunho de email|rascunho email|guardar rascunho)\s+/i, "").trim();
    return { type: "action", action: "DRAFT_EMAIL", param: draftText };
  }

  if (
    lower.startsWith("enviar rascunho ") ||
    lower.startsWith("expedir rascunho ") ||
    lower.startsWith("manda o rascunho ")
  ) {
    const id = userMessage.replace(/^(enviar rascunho|expedir rascunho|manda o rascunho)\s+/i, "").trim();
    return { type: "action", action: "SEND_DRAFT", param: id };
  }

  // Deteção rápida de Notas
  if (
    lower.startsWith("nota ") ||
    lower.startsWith("anota ") ||
    lower.startsWith("aponta ") ||
    lower.startsWith("apontar ")
  ) {
    const noteText = userMessage.replace(/^(nota|anota|aponta|apontar)\s+/i, "").trim();
    return { type: "action", action: "ADD_NOTE", param: noteText };
  }

  if (
    lower === "notas" ||
    lower === "ver notas" ||
    lower === "as minhas notas" ||
    lower === "bloco de notas"
  ) {
    return { type: "action", action: "LIST_NOTES" };
  }

  // Deteção rápida de Emails e Resumos
  if (
    lower === "emails" ||
    lower === "ver emails" ||
    lower === "resumo de emails" ||
    lower === "resumo dos emails" ||
    lower === "resumo dos meus emails" ||
    lower === "tenho emails novos?" ||
    lower === "tenho emails novos" ||
    lower === "quais sao os emails de hoje" ||
    lower === "quais são os emails de hoje" ||
    lower === "emails recentes" ||
    lower === "caixa de entrada" ||
    lower === "inbox" ||
    lower === "rever emails" ||
    lower === "ler emails" ||
    lower === "ver os emails" ||
    lower === "rever a caixa de correio"
  ) {
    return { type: "action", action: "LIST_EMAILS" };
  }

  if (
    lower.startsWith("emails sobre ") ||
    lower.startsWith("email sobre ") ||
    lower.startsWith("emails de ") ||
    lower.startsWith("email de ") ||
    lower.startsWith("procura email ") ||
    lower.startsWith("pesquisa email ")
  ) {
    const topic = userMessage.replace(/^(emails sobre|email sobre|emails de|email de|procura email|pesquisa email)\s+/i, "").trim();
    return { type: "action", action: "SEARCH_EMAILS", param: topic };
  }

  if (
    lower === "links" ||
    lower === "links dos projetos" ||
    lower === "links em vercel" ||
    lower === "projetos em vercel" ||
    lower === "vercel" ||
    lower === "ver links" ||
    lower === "sites" ||
    lower === "sites em vercel"
  ) {
    return { type: "action", action: "LIST_LINKS" };
  }

  if (
    lower === "apks" ||
    lower === "downloads" ||
    lower === "download" ||
    lower === "descarregar apks" ||
    lower === "apks para testar" ||
    lower === "apks para telemovel" ||
    lower === "apks para smartphone" ||
    lower === "instalar nos smartphones" ||
    lower === "quais sao os apks" ||
    lower === "quais são os apks"
  ) {
    return { type: "action", action: "LIST_APKS" };
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
        "Para conversar livremente com IA e absorver eventos complexos, podes configurar a tua chave gratuita Gemini no painel web ou com `/config key <chave>`.\n" +
        "Podes obter a chave em: https://aistudio.google.com/app/apikey\n\n" +
        "Comandos disponíveis: `/agenda`, `/evento <quando> <o que>`, `/status`, `/projetos`, `/diagnostico <proj>`, `/build <proj>`."
    };
  }

  const CANDIDATE_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-2.5-flash-lite"
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

// Transcrição de áudios e mensagens de voz do WhatsApp
export async function transcribeAudio(audioBuffer, mimeType = "audio/ogg") {
  const client = getAiClient();
  if (!client) return null;

  const cleanMime = mimeType.split(";")[0].trim();
  const base64Data = audioBuffer.toString("base64");

  const CANDIDATE_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest"
  ];

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = client.getGenerativeModel({ model: modelName });
      const prompt = "Transcreve fielmente esta mensagem de áudio em português de Portugal. Devolve APENAS o texto falado de forma limpa, sem introduções nem aspas.";
      const res = await model.generateContent([
        {
          inlineData: {
            data: base64Data,
            mimeType: cleanMime
          }
        },
        prompt
      ]);
      const text = res.response.text().trim();
      if (text) return text;
    } catch (err) {
      logger.warn(`Tentativa de transcrição com ${modelName} falhou: ${err.message}`);
    }
  }
  return null;
}

// Análise multimodal de imagens, capturas de ecrã ou código
export async function analyzeImage(imageBuffer, mimeType = "image/jpeg", userPrompt = "") {
  const client = getAiClient();
  if (!client) return "⚠️ Chave Gemini não configurada para análise de imagem.";

  const cleanMime = mimeType.split(";")[0].trim();
  const base64Data = imageBuffer.toString("base64");

  const CANDIDATE_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest"
  ];

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: "Você é um assistente técnico e de engenharia sénior. Analise imagens, capturas de ecrã de código, mensagens de erro, relatórios ou desenhos e responda sempre em português de Portugal de forma direta, clara e com soluções práticas."
      });
      const prompt = userPrompt || "Analisa esta imagem e descreve o que contém, identificando eventuais problemas ou pontos de ação importantes.";
      const res = await model.generateContent([
        {
          inlineData: {
            data: base64Data,
            mimeType: cleanMime
          }
        },
        prompt
      ]);
      const text = res.response.text().trim();
      if (text) return text;
    } catch (err) {
      logger.warn(`Tentativa de análise visual com ${modelName} falhou: ${err.message}`);
    }
  }
  return "❌ Não foi possível analisar a imagem no momento. Tenta novamente dentro de alguns segundos.";
}

export default {
  processNaturalLanguage,
  transcribeAudio,
  analyzeImage,
  getLearnedPatterns,
  learnPattern
};
