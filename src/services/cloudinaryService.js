import crypto from "crypto";
import fs from "fs";
import path from "path";
import config, { saveSettings } from "../config.js";
import logger from "../utils/logger.js";

class CloudinaryService {
  constructor() {
    this.secret = config.cloudinarySecret || "";
    this.apiKey = config.cloudinaryApiKey || "";
    this.cloudName = config.cloudinaryCloudName || "";
  }

  isConfigured() {
    return Boolean(config.cloudinarySecret && config.cloudinarySecret.trim());
  }

  saveCredentials({ secret, apiKey, cloudName }) {
    const update = {};
    if (secret) {
      config.cloudinarySecret = secret.trim();
      update.cloudinarySecret = secret.trim();
    }
    if (apiKey) {
      config.cloudinaryApiKey = apiKey.trim();
      update.cloudinaryApiKey = apiKey.trim();
    }
    if (cloudName) {
      config.cloudinaryCloudName = cloudName.trim();
      update.cloudinaryCloudName = cloudName.trim();
    }
    saveSettings(update);
    logger.info("☁️ Credenciais do Cloudinary guardadas com sucesso.");
    return true;
  }

  // Gera assinatura de autenticação para upload seguro na Cloudinary API
  generateSignature(params) {
    const sortedKeys = Object.keys(params).sort();
    const toSign = sortedKeys.map(k => `${k}=${params[k]}`).join("&") + config.cloudinarySecret;
    return crypto.createHash("sha1").update(toSign).digest("hex");
  }

  // Upload de imagem ou ficheiro para a CDN Cloudinary
  async uploadMedia(bufferOrBase64, { folder = "antigravity-media", publicId = null } = {}) {
    if (!config.cloudinarySecret) {
      logger.warn("Cloudinary Secret não configurado.");
      return null;
    }

    if (!config.cloudinaryCloudName || !config.cloudinaryApiKey) {
      logger.warn("Cloudinary Cloud Name ou API Key em falta para upload completo.");
      return {
        success: false,
        message: "Necessário Cloud Name e API Key além do Secret. Configura com /config cloudinary <cloud_name> <api_key>"
      };
    }

    try {
      const timestamp = Math.round(Date.now() / 1000);
      const params = {
        folder,
        timestamp
      };
      if (publicId) params.public_id = publicId;

      const signature = this.generateSignature(params);

      const formData = new FormData();
      formData.append("timestamp", timestamp);
      formData.append("folder", folder);
      formData.append("api_key", config.cloudinaryApiKey);
      formData.append("signature", signature);
      if (publicId) formData.append("public_id", publicId);

      if (Buffer.isBuffer(bufferOrBase64)) {
        const blob = new Blob([bufferOrBase64]);
        formData.append("file", blob, "upload.jpg");
      } else {
        formData.append("file", bufferOrBase64);
      }

      const uploadUrl = `https://api.cloudinary.com/v1_1/${config.cloudinaryCloudName}/image/upload`;
      const res = await fetch(uploadUrl, {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (data.secure_url) {
        logger.info(`☁️ [Cloudinary] Upload concluído: ${data.secure_url}`);
        return {
          success: true,
          url: data.secure_url,
          format: data.format,
          bytes: data.bytes,
          publicId: data.public_id
        };
      } else {
        logger.warn(`Erro no upload Cloudinary: ${JSON.stringify(data)}`);
        return { success: false, error: data.error?.message || "Erro desconhecido" };
      }
    } catch (err) {
      logger.error("Erro na comunicação com Cloudinary:", err);
      return { success: false, error: err.message };
    }
  }

  getStatus() {
    const hasSecret = Boolean(config.cloudinarySecret);
    const hasKey = Boolean(config.cloudinaryApiKey);
    const hasCloud = Boolean(config.cloudinaryCloudName);

    return (
      `☁️ *ESTADO DO CLOUDINARY (CDN & MEDIA STORAGE)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *API Secret:* ${hasSecret ? "Configurado (`" + config.cloudinarySecret.slice(0, 6) + "..." + config.cloudinarySecret.slice(-4) + "`)" : "❌ Não configurado"}\n` +
      `• *API Key:* ${hasKey ? "`" + config.cloudinaryApiKey + "`" : "⏳ Pendente (Opcional se usar Unsigned Preset)"}\n` +
      `• *Cloud Name:* ${hasCloud ? "`" + config.cloudinaryCloudName + "`" : "⏳ Pendente"}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      (hasCloud && hasKey && hasSecret
        ? `✅ *Pronto para uploads de media para a CDN!*\n`
        : `💡 _Para associar o teu Cloud Name e API Key:_\n\`/config cloudinary <cloud_name> <api_key>\` (ex: \`/config cloudinary meucloud 123456789\`)`)
    );
  }
}

export const cloudinaryService = new CloudinaryService();
export default cloudinaryService;

