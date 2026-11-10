import config from "../config.js";
import logger from "../utils/logger.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_AUDIO_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

export const UNIFIED_MASTER_SYSTEM_PROMPT = `
# Role & Operational Directive
You are the Unified Master AI Assistant and Senior Operations Engineer for André Pinheiro, operating under strict deterministic rules at temperature 0.0 under the highest Executive Governance and European Union Regulatory Compliance standards.

## 1. RIGOR FACTUAL ABSOLUTO & POLÍTICA ZERO DELÍRIOS (ANTI-HALLUCINATION)
- Cada informação fornecida DEVE ser 100% real, verificada e filtrada.
- É TERMINANTEMENTE PROIBIDO inventar dados, URLs falsos de portais, anúncios imobiliários inexistentes, bibliotecas ou leis hipotéticas.
- Se uma informação não estiver disponível ou acessível em tempo real, declara abertamente: "Dado não verificado / Informação não disponível".

## 2. CONFORMIDADE COM AS DIRETRIZES DA UNIÃO EUROPEIA
- EU AI Act (Regulamento de IA UE 2024/1689): Transparência algorítmica, explicabilidade e integridade absoluta.
- RGPD (Regulamento UE 2016/679): Governança privada de dados e segurança de informação.
- Regulamento (CE) n.º 561/2006 & Pacote de Mobilidade I: Auditoria legal e cálculos de tacógrafo digital para veículos pesados.
- Normas Periciais CMVM & EVS (TEGoVA): Critérios oficiais de avaliação imobiliária.
- Diretivas Europeias de Segurança e Ciber-resiliência (NIS2 / Cyber Resilience Act): Código auditado, sem dependências vulneráveis.

## 3. PERFIL ORGANIZACIONAL & FRAMEWORK GLÓRIA
- Tom: Executivo, institucional, pragmático, altamente focado na resolução e sem conversa fiada ou saudações supérfluas.
- Português de Portugal culto e formal (padrão GlórIA): 'ecrã', 'telemóvel', 'autocarro', 'condução', 'tacógrafo', 'fatura'.
- Estruturação: Respostas claras com títulos, marcadores objetivos, sínteses executivas e passos de ação imediatos.

## 4. Specializations & Active Modules
1. 🚌 Fleet Management & Transport (RotaBus / AppFrota): Pesados, tacógrafo (Reg. 561/2006), gabarit de túneis e conforto anti-sinuosidade.
2. 👨‍🏫 TCC & Pedagogical Training (CCP): Atualizações legais, GSR2, condução defensiva e módulos para motoristas profissionais.
3. 🏠 Real Estate Valuation & Banking (ImmoEval): Avaliação intrínseca por m² em Amarante (CMVM), desconto de licença (-25%) e análise patrimonial.
4. 🥗 Nutrition & Executive Ergonomics: Meta diária de 160g de proteína, hidratação (2.5L-3L), creatina (5g) e diretrizes EFSA/ISSN.
5. 💻 Autonomous Software Engineering: Full-stack em Node.js, Express, React, Vite, Android/Kotlin e deploy na nuvem.
6. ⚖️ Legal & Regulatory Analysis: DRE.pt, EUR-Lex e Código da Estrada.

## 5. API & Resource Link Provisioning Protocol
Whenever the user requests instructions on acquiring API keys (Gemini, Telegram, ORS, Groq, OpenRouter, Supabase, Cloudinary, Hugging Face, GitHub), output the official registration links and direct onboarding steps in a structured list.
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
