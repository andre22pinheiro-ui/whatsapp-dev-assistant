import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcodeTerminal from "qrcode-terminal";
import QRCode from "qrcode";
import EventEmitter from "events";
import fs from "fs";
import path from "path";
import config, { saveSettings } from "../config.js";
import logger from "../utils/logger.js";
import { handleIncomingMessage } from "./messageHandler.js";
import personalAssistant from "../services/personalAssistant.js";

export const botSentMessageIds = new Set();
export const recentMessagesStore = new Map();

/**
 * Instância de socket WhatsApp com sessão fixa e persistente
 */
export class WhatsAppBotInstance extends EventEmitter {
  constructor(options) {
    super();
    this.name = options.name; // "ASSISTENTE" | "RECEPTOR" | "EMISSOR"
    this.role = options.role; // "unified" | "receiver" | "sender"
    this.phone = options.phone; // ex: "351912101839"
    this.authDir = options.authDir;
    this.sock = null;
    this.qrCodeDataUrl = null;
    this.pairingCode = null;
    this.connectionState = "disconnected";
    this.userInfo = null;
    this.reconnectAttempts = 0;
    this.isStarting = false;
    this.isRegistered = false;

    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }
  }

  cleanAuthDir() {
    try {
      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
        fs.mkdirSync(this.authDir, { recursive: true });
        logger.info(`[${this.name}] Ficheiros de sessão limpos.`);
      }
    } catch (e) {
      logger.error(`[${this.name}] Erro ao limpar authDir:`, e);
    }
  }

  async reconnect(forceResetAuth = false) {
    logger.info(`[${this.name}] A reiniciar bot WhatsApp (+${this.phone}) [Reset credenciais: ${forceResetAuth}]...`);
    try {
      this.isStarting = false;
      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners();
          this.sock.end();
        } catch (e) {}
        this.sock = null;
      }
      if (forceResetAuth) {
        this.cleanAuthDir();
        this.pairingCode = null;
      }
      this.qrCodeDataUrl = null;
      this.connectionState = "connecting";
      this.userInfo = null;
      this.reconnectAttempts = 0;
      this.emit("status_change", this.getStatus());
      await this.start();
      return true;
    } catch (err) {
      logger.error(`[${this.name}] Falha ao reconectar:`, err);
      throw err;
    }
  }

  async start(onMessageReceived = null) {
    if (this.isStarting) return;
    this.isStarting = true;

    try {
      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners();
          this.sock.end();
        } catch (e) {}
        this.sock = null;
      }

      logger.info(`[${this.name}] A inicializar Bot WhatsApp (+${this.phone}) [Modo: ${this.role.toUpperCase()}]...`);
      this.connectionState = "connecting";
      this.emit("status_change", this.getStatus());

      // Preservar sempre chaves e estado do handshake (NUNCA limpar no arranque para permitir que o handshake de emparelhamento termine sem ser interrompido)
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        // Identidade fixa para o WhatsApp reconhecer dispositivo desktop autorizado
        browser: Browsers.windows("Chrome"),
        generateHighQualityLinkPreview: true,
        keepAliveIntervalMs: 30000,
        defaultQueryTimeoutMs: 60000,
        connectTimeoutMs: 60000,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        getMessage: async (key) => {
          if (key?.id && recentMessagesStore.has(key.id)) {
            return recentMessagesStore.get(key.id);
          }
          return undefined;
        }
      });

      this.sock.ev.on("creds.update", saveCreds);

      // Se já estiver registado na pasta de autenticação, reutiliza a sessão sem pedir novos códigos
      let isAlreadyLinked = Boolean(state.creds?.registered && state.creds?.me?.id);
      if (!isAlreadyLinked && fs.existsSync(path.join(this.authDir, "creds.json"))) {
        try {
          const rawCreds = JSON.parse(fs.readFileSync(path.join(this.authDir, "creds.json"), "utf8"));
          if (rawCreds?.registered) {
            isAlreadyLinked = true;
          }
        } catch (e) {}
      }
      this.isRegistered = isAlreadyLinked;
      if (isAlreadyLinked) {
        logger.info(`🔒 [${this.name}] Sessão WhatsApp registada encontrada (+${state.creds?.me?.id || this.phone}). A restabelecer ligação fixa.`);
        this.pairingCode = null;
      } else if (this.phone && !this.pairingCode && this.reconnectAttempts === 0) {
        // Solicita código de emparelhamento no arranque inicial apenas (nunca durante reconexões para não abortar o handshake em curso)
        setTimeout(async () => {
          try {
            if (this.connectionState === "connected" || !this.sock || this.pairingCode) return;
            const cleanPhone = this.phone.replace(/\D/g, "");
            const code = await this.sock.requestPairingCode(cleanPhone);
            this.pairingCode = code;
            logger.info(`🔢 [${this.name}] CÓDIGO DE EMPARELHAMENTO ESTÁVEL PARA +${cleanPhone}: ${code}`);
            this.emit("pairing_code", { code, phone: cleanPhone, name: this.name });
            this.emit("status_change", this.getStatus());
          } catch (err) {
            logger.warn(`[${this.name}] Aviso pairing code: ` + err.message);
          }
        }, 3000);
      }

      // Evento de atualização da conexão
      this.sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          logger.info(`[${this.name}] Novo QR Code gerado (+${this.phone})`);
          qrcodeTerminal.generate(qr, { small: true });

          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr);
          } catch (e) {
            logger.error(`[${this.name}] Erro ao converter QR em imagem:`, e);
          }

          this.connectionState = "qr_ready";
          this.emit("qr", { qr, dataUrl: this.qrCodeDataUrl, pairingCode: this.pairingCode, name: this.name });
          this.emit("status_change", this.getStatus());
        }

        if (connection === "open") {
          this.reconnectAttempts = 0;
          this.qrCodeDataUrl = null;
          this.pairingCode = null;
          this.connectionState = "connected";
          this.isRegistered = true;

          const user = this.sock.user;
          const phone = user?.id?.split(":")[0] || user?.id?.split("@")[0] || this.phone;
          this.userInfo = { phone, name: user?.name || `Bot ${this.name}` };

          // Fixar permanentemente o registo para não pedir novas autorizações no telemóvel
          saveSettings({ sessionLocked: true });

          logger.info(`✅ [${this.name}] WHATSAPP CONECTADO E SESSÃO FIXADA COM SUCESSO! (+${phone})`);
          this.emit("status_change", this.getStatus());

          if (this.role === "sender" || this.role === "unified") {
            setTimeout(async () => {
              try {
                const target = `${(config.senderPhone || "351919115655").replace(/\D/g, "")}@s.whatsapp.net`;
                await this.sendMessage(target, {
                  text: "🚀 *WHATSAPP DEV ASSISTANT ATIVO E FIXADO!*\n━━━━━━━━━━━━━━━━━━━━━━━━\nA ligação permanente foi configurada com sucesso. O WhatsApp não voltará a pedir autorização a novas apps.\n\nComandos disponíveis:\n• `/projetos` - Ver lista e estados\n• `/diagnostico` - Saúde geral de todos os projetos\n• `/status` - Carga do PC\n• `/print` - Foto do ecrã"
                });
                logger.info(`Notificação de prontidão enviada para ${target}`);
              } catch (e) {
                logger.warn("Aviso envio notificação inicial:", e.message);
              }
            }, 2000);
          }
        } else if (connection === "close") {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;

          this.connectionState = "disconnected";
          logger.warn(`[${this.name}] Conexão fechada. Código: ${statusCode}`);
          this.emit("status_change", this.getStatus());

          if (isLoggedOut) {
            // Apenas limpa se WhatsApp reportou 401 / desvinculado no telemóvel
            logger.warn(`[${this.name}] Sessão desvinculada no telemóvel (401). A limpar dados para novo emparelhamento...`);
            this.cleanAuthDir();
            this.isRegistered = false;
            this.userInfo = null;
            this.pairingCode = null;
            this.qrCodeDataUrl = null;
            setTimeout(() => {
              this.isStarting = false;
              this.start(onMessageReceived);
            }, 5000);
          } else {
            // Qualquer outro código (408 timeout, 515 restart, etc.): PRESERVA os ficheiros de sessão e reconecta suavemente
            this.reconnectAttempts++;
            const delay = statusCode === 515 ? 1500 : Math.min(this.reconnectAttempts * 2000, 8000);
            logger.info(`[${this.name}] A reconectar sessão em ${delay / 1000}s (Código: ${statusCode})...`);
            setTimeout(() => {
              this.isStarting = false;
              this.start(onMessageReceived);
            }, delay);
          }
        }
      });

      // Escutar mensagens recebidas (suporta notificações em direto e mensagens sincronizadas)
      this.sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify" && type !== "append") return;
        for (const msg of messages) {
          if (msg.key?.id && msg.message) {
            recentMessagesStore.set(msg.key.id, msg.message);
          }
          if (msg.key?.id && botSentMessageIds.has(msg.key.id)) continue;
          try {
            if (onMessageReceived) {
              await onMessageReceived(this, msg);
            }
          } catch (err) {
            logger.error(`[${this.name}] Erro ao processar mensagem recebida:`, err);
          }
        }
      });
    } finally {
      this.isStarting = false;
    }
  }

  async sendMessage(targetJid, content) {
    if (!this.sock || this.connectionState !== "connected") {
      throw new Error(`Bot [${this.name} / +${this.phone}] não está conectado`);
    }
    const result = await this.sock.sendMessage(targetJid, content);
    if (result?.key?.id) {
      recentMessagesStore.set(result.key.id, result.message || content);
      botSentMessageIds.add(result.key.id);
      setTimeout(() => {
        botSentMessageIds.delete(result.key.id);
        recentMessagesStore.delete(result.key.id);
      }, 600000);
    }
    return result;
  }

  getStatus() {
    return {
      name: this.name,
      role: this.role,
      phone: this.phone,
      state: this.connectionState,
      user: this.userInfo,
      hasQr: !!this.qrCodeDataUrl,
      qrDataUrl: this.qrCodeDataUrl,
      pairingCode: this.pairingCode || null
    };
  }
}

/**
 * Gerenciador Unificado de Bot WhatsApp (1 ligação única fixa por padrão)
 */
class DualBotManager extends EventEmitter {
  constructor() {
    super();

    const isDual = !!config.isDualBotEnabled;
    const botPhone = config.receiverPhone || "351912101839";

    // 1. BOT PRINCIPAL UNIFICADO
    this.receiver = new WhatsAppBotInstance({
      name: isDual ? "RECEPTOR" : "ASSISTENTE",
      role: isDual ? "receiver" : "unified",
      phone: botPhone,
      authDir: config.authReceiverDir
    });

    if (isDual) {
      // 2. BOT EMISSOR SECUNDÁRIO (Apenas se o utilizador ativar modo dual)
      this.sender = new WhatsAppBotInstance({
        name: "EMISSOR",
        role: "sender",
        phone: config.senderPhone || "351919115655",
        authDir: config.authSenderDir
      });

      this.sender.on("status_change", (data) => this.emit("status_change", { target: "sender", ...data }));
      this.sender.on("qr", (data) => this.emit("qr", { target: "sender", ...data }));
    } else {
      // No modo unificado padrão: o sender espelha o receiver
      // Isto impede a criação de uma 2ª app vinculada no WhatsApp do telemóvel
      this.sender = this.receiver;
    }

    this.receiver.on("status_change", (data) => this.emit("status_change", { target: "receiver", ...data }));
    this.receiver.on("qr", (data) => this.emit("qr", { target: "receiver", ...data }));
  }

  async start() {
    logger.info(`🚀 A inicializar WhatsApp Dev Assistant (Modo: ${config.isDualBotEnabled ? "Dual-Bot" : "Ligação Única Fixa"})...`);

    const onMessageUnified = async (botInst, msg) => {
      logger.info(`📥 Mensagem recebida no WhatsApp (+${botInst.phone})`);
      await handleIncomingMessage(botInst.sock, msg, botSentMessageIds);
    };

    await this.receiver.start(onMessageUnified);

    if (config.isDualBotEnabled && this.sender !== this.receiver) {
      await new Promise((r) => setTimeout(r, 2500));
      await this.sender.start(onMessageUnified);
    }

    personalAssistant.setReminderNotifier(async (rem) => {
      try {
        const targetNumber = (rem.targetJid ? rem.targetJid.replace(/\D/g, "") : (config.senderPhone || config.receiverPhone || "351912101839")).replace(/\D/g, "");
        const targetJid = `${targetNumber}@s.whatsapp.net`;
        const activeBot = (this.sender.connectionState === "connected") ? this.sender : this.receiver;

        if (activeBot.connectionState === "connected") {
          await activeBot.sendMessage(targetJid, {
            text: `🔔 *LEMBRETE DO ASSISTENTE:*\n━━━━━━━━━━━━━━━━━━━━━━━━\n_${rem.text}_\n━━━━━━━━━━━━━━━━━━━━━━━━\nData: ${new Date().toLocaleTimeString("pt-PT")}`
          });
          logger.info(`Notificação de lembrete enviada via WhatsApp para ${targetJid}`);
        }
      } catch (err) {
        logger.error("Erro ao enviar notificação de lembrete:", err);
      }
    });

    import("../services/calendarService.js").then(({ default: calendarService }) => {
      calendarService.setCalendarNotifier(async (ev) => {
        try {
          const targetNumber = (config.senderPhone || config.receiverPhone || "351919115655").replace(/\D/g, "");
          const targetJid = `${targetNumber}@s.whatsapp.net`;
          const activeBot = (this.sender.connectionState === "connected") ? this.sender : this.receiver;
          if (activeBot.connectionState === "connected") {
            await activeBot.sendMessage(targetJid, { text: ev.text });
            logger.info(`Notificação de evento enviada via WhatsApp para ${targetJid}`);
          }
        } catch (err) {
          logger.error("Erro ao enviar notificação de evento de calendário:", err);
        }
      });
      calendarService.startCalendarScheduler();
    });
  }

  async sendMessage(targetJid, content) {
    if (this.sender && this.sender.connectionState === "connected") {
      return await this.sender.sendMessage(targetJid, content);
    } else if (this.receiver && this.receiver.connectionState === "connected") {
      return await this.receiver.sendMessage(targetJid, content);
    } else {
      throw new Error("Bot WhatsApp não está conectado no momento.");
    }
  }

  async reconnect(target = "all", forceResetAuth = false) {
    if (this.receiver) {
      await this.receiver.reconnect(forceResetAuth);
    }
    if (config.isDualBotEnabled && this.sender && this.sender !== this.receiver) {
      await this.sender.reconnect(forceResetAuth);
    }
  }

  getStatus() {
    const isDual = config.isDualBotEnabled && this.sender !== this.receiver;
    return {
      receiver: this.receiver.getStatus(),
      sender: isDual ? this.sender.getStatus() : this.receiver.getStatus(),
      isBridgeActive: this.receiver.connectionState === "connected",
      state: this.receiver.connectionState,
      pairingCode: this.receiver.pairingCode || (isDual ? this.sender.pairingCode : null),
      botPhone: this.receiver.phone,
      ownerPhone: config.senderPhone,
      sessionLocked: !!config.sessionLocked,
      isDualBotEnabled: isDual
    };
  }
}

export const whatsapp = new DualBotManager();
export default whatsapp;
