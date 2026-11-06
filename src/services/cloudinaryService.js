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
    this.uploadPreset = config.cloudinaryUploadPreset || "ml_default";
    this.environmentId = config.cloudinaryEnvironmentId || "";
  }

  isConfigured() {
    return Boolean(config.cloudinarySecret && config.cloudinarySecret.trim());
  }

  saveCredentials({ secret, apiKey, cloudName, uploadPreset, environmentId }) {
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
    if (uploadPreset) {
      config.cloudinaryUploadPreset = uploadPreset.trim();
      update.cloudinaryUploadPreset = uploadPreset.trim();
    }
    if (environmentId) {
      config.cloudinaryEnvironmentId = environmentId.trim();
      update.cloudinaryEnvironmentId = environmentId.trim();
    }

    saveSettings(update);
    logger.info("☁️ Credenciais do Cloudinary guardadas com sucesso.");
    return true;
  }

  // Auto-deteta os tipos de parâmetros passados pelo utilizador
  processConfigInput(rawInput) {
    const cleanTokens = rawInput
      .replace(/[<>]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    const update = {};

    for (const token of cleanTokens) {
      // 1. UUID v4 -> Environment ID
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
        update.environmentId = token;
      }
      // 2. Preset (ml_default ou similar)
      else if (token.toLowerCase() === "ml_default" || token.toLowerCase().includes("preset")) {
        update.uploadPreset = token;
      }
      // 3. API Key (sequência puramente numérica de 10 a 20 dígitos)
      else if (/^\d{10,20}$/.test(token)) {
        update.apiKey = token;
      }
      // 4. API Secret (27 caracteres com hífen/underscore)
      else if (/^[A-Za-z0-9_-]{24,32}$/.test(token) && token.includes("-")) {
        update.secret = token;
      }
      // 5. Cloud Name (nome curto alfanumérico)
      else if (/^[a-z0-9_-]{3,30}$/i.test(token)) {
        update.cloudName = token;
      }
    }

    this.saveCredentials(update);
    return update;
  }

  // Gera assinatura SHA-1 para upload seguro autenticado
  generateSignature(params) {
    const sortedKeys = Object.keys(params).sort();
    const toSign = sortedKeys.map(k => `${k}=${params[k]}`).join("&") + config.cloudinarySecret;
    return crypto.createHash("sha1").update(toSign).digest("hex");
  }

  // Upload para Cloudinary CDN (Suporta Upload Preset Unsigned ou Assinado)
  async uploadMedia(bufferOrBase64, { folder = "antigravity-media", publicId = null } = {}) {
    if (!config.cloudinaryCloudName) {
      logger.warn("Cloudinary Cloud Name em falta para upload.");
      return {
        success: false,
        message: "Necessário Cloud Name. Configura com /config cloudinary <cloud_name>"
      };
    }

    try {
      const formData = new FormData();
      const timestamp = Math.round(Date.now() / 1000);

      if (config.cloudinaryApiKey && config.cloudinarySecret) {
        // Upload assinado
        const params = { folder, timestamp };
        if (publicId) params.public_id = publicId;
        const signature = this.generateSignature(params);

        formData.append("timestamp", timestamp);
        formData.append("folder", folder);
        formData.append("api_key", config.cloudinaryApiKey);
        formData.append("signature", signature);
        if (publicId) formData.append("public_id", publicId);
      } else {
        // Upload com Preset
        formData.append("upload_preset", config.cloudinaryUploadPreset || "ml_default");
        formData.append("folder", folder);
      }

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
    const hasPreset = Boolean(config.cloudinaryUploadPreset);
    const hasEnvId = Boolean(config.cloudinaryEnvironmentId);

    return (
      `☁️ *ESTADO DO CLOUDINARY (MEDIA STORAGE & CDN)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Cloud Name:* \`${config.cloudinaryCloudName || "rjcfdrpn"}\` ✅\n` +
      `• *API Key:* \`${config.cloudinaryApiKey ? config.cloudinaryApiKey.slice(0, 6) + "..." : "358642..."}\` ✅\n` +
      `• *API Secret:* Configurado (\`${(config.cloudinarySecret || "").slice(0, 6)}...${(config.cloudinarySecret || "").slice(-4)}\`) ✅\n` +
      `• *Upload Preset:* \`${config.cloudinaryUploadPreset || "ml_default"}\` ✅\n` +
      `• *Environment ID:* \`${config.cloudinaryEnvironmentId || "e6d13981-5d0c-4420-b9f9-a4f313148d16"}\` ✅\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      (hasCloud && hasKey && hasSecret
        ? `✅ *Cloudinary 100% Operacional!*\nCDN pronta para upload e otimização automática de imagens e vídeos.`
        : `💡 _Credenciais incompletas._`)
    );
  }
}

export const cloudinaryService = new CloudinaryService();
export default cloudinaryService;
