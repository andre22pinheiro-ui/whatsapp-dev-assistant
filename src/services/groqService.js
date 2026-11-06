import config from "../config.js";
import logger from "../utils/logger.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_AUDIO_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

export const UNIFIED_MASTER_SYSTEM_PROMPT = `
# Role & Operational Directive
You are the Unified Master AI Assistant for André Pinheiro, operating under strict deterministic rules at temperature 0.0. No assumptions, no estimations, and zero conversational filler. You provide precise, fact-based, and modular data across all integrated professional domains.

## Core Specializations & Active Modules
1. 🚌 Fleet Management & Transport (AppFrota / RotaBus): Heavy vehicle regulations, tachograph data (TQR-3011B), 3D routing limits, and public transport logistics.
2. 👨‍🏫 TCC & Pedagogical Training (CCP Holder): Verified legal updates, driving/rest times (Reg. CE 561/2006), GSR2 safety mandates, and structured instructional modules for professional drivers.
3. 🏠 Real Estate Valuation & Banking (ImmoEval): Deterministic property analysis, banking valuation criteria (CMVM/Banco de Portugal), area ratios, and price-per-m² metrics for Amarante.
4. 🥗 Nutrition & Executive Ergonomics: Measured high-protein dietary routines, core/lumbar support parameters, and schedule synchronization (Google Calendar/Gmail).
5. 💻 Autonomous Software Engineering: Full-stack code generation (Next.js, TypeScript, Supabase, Flutter, Jetpack Compose, Vercel deployment, and automated txt change reports).
6. ⚖️ Legal & Regulatory Analysis: Direct processing of Portuguese and EU legislation (Diário da República Eletrónico / DRE.pt, EUR-Lex, Código da Estrada).

## Operational Rules (GlórIA & Strict Determinism)
- TEMPERATURA: 0.0 (Zero tolerância para alucinações, especulações ou invenções de dados).
- FRAMEWORK LINGUÍSTICO GLÓRIA (Soberania do Português Europeu): Enforça estritamente a gramática, ortografia e terminologia técnico-administrativa de Portugal (pt-PT): 'ecrã', 'telemóvel', 'autocarro', 'condução', 'travagem', 'tacógrafo', 'fatura', 'requerimento'. Rejeita terminantemente brasileirismos ou distorções estruturais.
- DUAL-LAYER LANGUAGE SEPARATION:
  1. Linguagem Natural, Resumos e Notas: 100% Português Europeu culto e rigoroso (padrão GlórIA).
  2. Código Técnico, Sintaxe e APIs: Inglês técnico padrão para programação, variáveis e ficheiros de sistema.
- LINGUAGEM CORRENTE: Fala em português de Portugal fluido, direto e conversacional ("linguagem corrente"), sem comandos de barra (/) rígidos nem respostas mecânicas. Compreende pedidos naturais do dia a dia.
- PKM & OBSIDIAN INTEGRITY: Formata conceitos e referências atómicas com sintaxe estrita de wikilinks [[Nome da Nota]].
- CONCISÃO & FACTOS: Sem 'filler' ou saudações supérfluas. Respostas orientadas a soluções funcionais de imediato.
- AUDIENCE: André Pinheiro (Motorista profissional de pesados, Formador certificado CCP, investidor imobiliário e programador).

## API & Resource Link Provisioning Protocol
Whenever the user requests instructions on how to acquire free-tier API keys, tokens, or endpoints for any integrated service (Google Gemini, Telegram, OpenRouteService, Groq, Supabase, Cloudinary, Hugging Face, DRE/EUR-Lex, GitHub, OpenStreetMap), you must immediately output the exact, official registration links and direct onboarding steps in a clean, structured list.
`.trim();

export class GroqService {
  constructor() {
    this.candidateModels = [
      "openai/gpt-oss-120b",
      "qwen/qwen3.8-27b",
      "openai/gpt-oss-20b"
    ];
  }

  isConfigured() {
    return Boolean(config.groqApiKey && config.groqApiKey.startsWith("gsk_"));
  }

  // Chamada de Chat Completions determinística (Temperature: 0.0)
  async callChat({
    messages = [],
    userPrompt = "",
    systemPrompt = UNIFIED_MASTER_SYSTEM_PROMPT,
    temperature = 0.0,
    model = config.groqModel || "openai/gpt-oss-120b",
    maxTokens = 2048
  } = {}) {
    if (!this.isConfigured()) {
      logger.warn("Groq API Key não configurada.");
      return null;
    }

    const builtMessages = [];
    if (systemPrompt) {
      builtMessages.push({ role: "system", content: systemPrompt });
    }

    if (messages.length > 0) {
      builtMessages.push(...messages);
    } else if (userPrompt) {
      builtMessages.push({ role: "user", content: userPrompt });
    }

    const modelsToTry = [model, ...this.candidateModels.filter((m) => m !== model)];
    let lastError = null;

    for (const currentModel of modelsToTry) {
      try {
        const startTime = Date.now();
        const response = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${config.groqApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: currentModel,
            messages: builtMessages,
            temperature: Math.max(0.0, Math.min(temperature, 1.0)),
            max_tokens: maxTokens
          })
        });

        if (!response.ok) {
          const errBody = await response.text();
          logger.warn(`Groq modelo ${currentModel} falhou com status ${response.status}: ${errBody.slice(0, 150)}`);
          lastError = new Error(`Groq HTTP ${response.status}: ${errBody}`);
          continue;
        }

        const data = await response.json();
        const duration = Date.now() - startTime;
        const choice = data.choices?.[0];
        const content = choice?.message?.content || "";

        logger.info(`⚡ Groq [${currentModel}] respondeu em ${duration}ms (${data.usage?.total_tokens || 0} tokens).`);
        return {
          content: content.trim(),
          model: currentModel,
          usage: data.usage,
          durationMs: duration
        };
      } catch (err) {
        lastError = err;
        logger.warn(`Erro na requisição Groq com ${currentModel}: ${err.message}`);
      }
    }

    logger.error("Todos os modelos Groq falharam:", lastError?.message);
    return null;
  }

  // Transcrição de áudio com Whisper no Groq (Ultra-rápido & Gratuito)
  async transcribeAudio(audioBuffer, filename = "audio.ogg") {
    if (!this.isConfigured()) return null;

    const audioModels = ["whisper-large-v3-turbo", "whisper-large-v3"];

    for (const audioModel of audioModels) {
      try {
        const formData = new FormData();
        const blob = new Blob([audioBuffer], { type: "audio/ogg" });
        formData.append("file", blob, filename);
        formData.append("model", audioModel);
        formData.append("language", "pt");
        formData.append("response_format", "json");

        const response = await fetch(GROQ_AUDIO_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${config.groqApiKey}`
          },
          body: formData
        });

        if (!response.ok) {
          const errText = await response.text();
          logger.warn(`Groq Whisper ${audioModel} falhou: ${errText.slice(0, 120)}`);
          continue;
        }

        const data = await response.json();
        if (data.text) {
          logger.info(`🎙️ Groq Whisper transcreveu áudio com sucesso via ${audioModel}.`);
          return data.text.trim();
        }
      } catch (err) {
        logger.warn(`Erro no Groq Whisper com ${audioModel}: ${err.message}`);
      }
    }

    return null;
  }
}

export const groqService = new GroqService();
export default groqService;
