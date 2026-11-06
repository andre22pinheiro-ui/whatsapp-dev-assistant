import config, { saveSettings } from "../config.js";
import logger from "../utils/logger.js";

const HF_INFERENCE_URL = "https://router.huggingface.co/hf-inference/models";

class HuggingfaceService {
  constructor() {
    this.token = config.huggingfaceToken || "";
    this.user = "Andrepinheiro10";
  }

  isConfigured() {
    return Boolean(config.huggingfaceToken && config.huggingfaceToken.startsWith("hf_"));
  }

  saveToken(token) {
    if (!token) return false;
    config.huggingfaceToken = token.trim();
    saveSettings({ huggingfaceToken: token.trim() });
    logger.info("🤗 Token do Hugging Face guardado com sucesso.");
    return true;
  }

  // Executa inferência num modelo do Hugging Face Hub
  async queryModel(modelId, inputs, parameters = {}) {
    if (!this.isConfigured()) {
      logger.warn("Hugging Face Token não configurado.");
      return null;
    }

    try {
      const url = `${HF_INFERENCE_URL}/${modelId}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.huggingfaceToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs, parameters })
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.warn(`Hugging Face erro (${modelId}): ${errText.slice(0, 150)}`);
        return { success: false, error: errText };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (err) {
      logger.error(`Erro na requisição Hugging Face (${modelId}):`, err);
      return { success: false, error: err.message };
    }
  }

  // Executa consulta a modelos em Português Europeu (AMALIA-9B / GlórIA)
  async consultarAmalia(promptUtilizador) {
    if (!this.isConfigured()) {
      return { success: false, error: "Token Hugging Face em falta." };
    }

    const systemPrompt = 
      "És um assistente técnico autónomo. Responde estritamente em português europeu (pt-PT). " +
      "Mantém rigor absoluto, precisão factual e omite formalismos.";

    try {
      const url = `${HF_INFERENCE_URL}/NOVA-IMS/AMALIA-9B/v1/chat/completions`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.huggingfaceToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "NOVA-IMS/AMALIA-9B",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: promptUtilizador }
          ],
          max_tokens: 2048,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        return { success: false, error: errText };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      return { success: true, content };
    } catch (err) {
      logger.error("Erro na consulta ao AMALIA-9B:", err);
      return { success: false, error: err.message };
    }
  }

  getStatus() {
    const hasToken = this.isConfigured();
    return (
      `🤗 *ESTADO DO HUGGING FACE (INFERENCE HUB)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Utilizador:* \`${this.user}\`\n` +
      `• *Token de Acesso:* ${hasToken ? "Ativo (`" + config.huggingfaceToken.slice(0, 6) + "..." + config.huggingfaceToken.slice(-4) + "`)" : "❌ Não configurado"}\n` +
      `• *Capacidades:* Modelos Open-Source (Llama 3.3, Qwen 2.5, DeepSeek, Embeddings BGE-M3, FLUX)\n` +
      `• *Plano:* Serverless Inference API (Free-tier)\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ *Pronto para execução e descarregamento de pesos/modelos no hub!*`
    );
  }
}

export const huggingfaceService = new HuggingfaceService();
export default huggingfaceService;

