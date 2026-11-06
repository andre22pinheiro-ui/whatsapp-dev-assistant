import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Carregar .env se existir
dotenv.config({ path: path.join(rootDir, ".env") });

const dataDir = path.join(rootDir, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const settingsFile = path.join(dataDir, "settings.json");

export function loadSettings() {
  try {
    if (fs.existsSync(settingsFile)) {
      return JSON.parse(fs.readFileSync(settingsFile, "utf8"));
    }
  } catch (e) {
    console.error("Erro ao carregar settings.json:", e);
  }
  return {};
}

export function saveSettings(newSettings) {
  try {
    const current = loadSettings();
    const updated = { ...current, ...newSettings };
    fs.writeFileSync(settingsFile, JSON.stringify(updated, null, 2), "utf8");
    return updated;
  } catch (e) {
    console.error("Erro ao guardar settings.json:", e);
    return null;
  }
}

const settings = loadSettings();

export const config = {
  rootDir,
  dataDir,
  authDir: path.join(dataDir, "auth_info"),
  authReceiverDir: path.join(dataDir, "auth_receiver"),
  authSenderDir: path.join(dataDir, "auth_sender"),
  port: parseInt(process.env.PORT || settings.port || "3333", 10),
  projectsDir: process.env.PROJECTS_DIR || settings.projectsDir || "C:\\Users\\Surface_Dpc\\Desktop\\projectos",
  androidSdkPath: process.env.ANDROID_SDK_PATH || settings.androidSdkPath || "C:\\Users\\Surface_Dpc\\AppData\\Local\\Android\\Sdk",
  adbPath: process.env.ADB_PATH || settings.adbPath || "C:\\Users\\Surface_Dpc\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe",
  studioPath: process.env.STUDIO_PATH || settings.studioPath || "C:\\Program Files\\Android\\Android Studio\\bin\\studio64.exe",
  agyPath: process.env.AGY_PATH || settings.agyPath || "C:\\Users\\Surface_Dpc\\AppData\\Local\\agy\\bin\\agy.exe",
  cloudflaredPath: process.env.CLOUDFLARED_PATH || settings.cloudflaredPath || "C:\\Users\\Surface_Dpc\\Desktop\\projectos\\PC-Remote-Portatil\\cloudflared.exe",
  enableCloudTunnel: settings.enableCloudTunnel !== undefined ? settings.enableCloudTunnel : true,
  receiverPhone: process.env.RECEIVER_PHONE || settings.receiverPhone || "351912101839",
  senderPhone: process.env.SENDER_PHONE || settings.senderPhone || "351919115655",
  geminiApiKey: process.env.GEMINI_API_KEY || settings.geminiApiKey || "",
  prefix: process.env.BOT_PREFIX || settings.prefix || "/",
  allowAllSenders: settings.allowAllSenders !== undefined ? settings.allowAllSenders : true,
  isDualBotEnabled: false, // Forçado a false: Sempre 1 bot unificado na nuvem (+351912101839)
  sessionLocked: settings.sessionLocked !== undefined ? settings.sessionLocked : false,
  authEmail: process.env.AUTH_EMAIL || settings.authEmail || "Andre22pinheiro@gmail.com",
  authPin: process.env.AUTH_PIN || settings.authPin || "9959",
  activeConversationId: process.env.ACTIVE_CONVERSATION_ID || settings.activeConversationId || "0d7a259f-1d2f-4fd7-b342-67e047718f38",
  antigravityBrainDir: path.join(process.env.USERPROFILE || "C:\\Users\\Surface_Dpc", ".gemini", "antigravity", "brain", settings.activeConversationId || "0d7a259f-1d2f-4fd7-b342-67e047718f38"),
  antigravityGlobalDir: path.join(process.env.USERPROFILE || "C:\\Users\\Surface_Dpc", ".gemini", "antigravity"),
  isCloud: process.env.IS_CLOUD === "true" || settings.isCloud === true,
  cloudServerUrl: process.env.CLOUD_SERVER_URL || settings.cloudServerUrl || "http://localhost:3333",
  syncSecret: process.env.SYNC_SECRET_TOKEN || settings.syncSecret || "sync_default_token_9959",
  emailUser: process.env.EMAIL_USER || settings.emailUser || settings.authEmail || "Andre22pinheiro@gmail.com",
  emailPassword: process.env.EMAIL_PASSWORD || settings.emailPassword || "",
  imapHost: process.env.IMAP_HOST || settings.imapHost || "imap.gmail.com",
  imapPort: parseInt(process.env.IMAP_PORT || settings.imapPort || "993", 10),
  smtpHost: process.env.SMTP_HOST || settings.smtpHost || "smtp.gmail.com",
  smtpPort: parseInt(process.env.SMTP_PORT || settings.smtpPort || "465", 10),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || settings.telegramBotToken || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID || settings.telegramChatId || "",
  groqApiKey: process.env.GROQ_API_KEY || settings.groqApiKey || "",
  groqModel: process.env.GROQ_MODEL || settings.groqModel || "openai/gpt-oss-120b",
  githubToken: process.env.GITHUB_TOKEN || settings.githubToken || "",
  githubOwner: process.env.GITHUB_OWNER || settings.githubOwner || "andre22pinheiro-ui",
  cloudinarySecret: process.env.CLOUDINARY_SECRET || settings.cloudinarySecret || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || settings.cloudinaryApiKey || "",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || settings.cloudinaryCloudName || "",
  cloudinaryUrl: process.env.CLOUDINARY_URL || settings.cloudinaryUrl || "",
  cloudinaryUploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || settings.cloudinaryUploadPreset || "ml_default",
  cloudinaryEnvironmentId: process.env.CLOUDINARY_ENVIRONMENT_ID || settings.cloudinaryEnvironmentId || "",
  huggingfaceToken: process.env.HUGGINGFACE_TOKEN || settings.huggingfaceToken || "",
  orsApiKey: process.env.ORS_API_KEY || settings.orsApiKey || settings.openRouteServiceApiKey || ""
};

export default config;

