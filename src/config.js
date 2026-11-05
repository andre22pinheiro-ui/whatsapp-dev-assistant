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
  isDualBotEnabled: settings.isDualBotEnabled !== undefined ? settings.isDualBotEnabled : false,
  sessionLocked: settings.sessionLocked !== undefined ? settings.sessionLocked : false,
  authEmail: process.env.AUTH_EMAIL || settings.authEmail || "Andre22pinheiro@gmail.com",
  authPin: process.env.AUTH_PIN || settings.authPin || "9959",
  activeConversationId: process.env.ACTIVE_CONVERSATION_ID || settings.activeConversationId || "0d7a259f-1d2f-4fd7-b342-67e047718f38",
  antigravityBrainDir: path.join(process.env.USERPROFILE || "C:\\Users\\Surface_Dpc", ".gemini", "antigravity", "brain", settings.activeConversationId || "0d7a259f-1d2f-4fd7-b342-67e047718f38"),
  antigravityGlobalDir: path.join(process.env.USERPROFILE || "C:\\Users\\Surface_Dpc", ".gemini", "antigravity"),
  isCloud: process.env.IS_CLOUD === "true" || settings.isCloud === true,
  cloudServerUrl: process.env.CLOUD_SERVER_URL || settings.cloudServerUrl || "http://localhost:3333",
  syncSecret: process.env.SYNC_SECRET_TOKEN || settings.syncSecret || "sync_default_token_9959"
};

export default config;

