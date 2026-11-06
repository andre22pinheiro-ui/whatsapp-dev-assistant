import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import config, { saveSettings } from "../config.js";
import logger from "../utils/logger.js";
import whatsapp from "../whatsapp/client.js";
import androidService from "../services/androidService.js";
import systemService from "../services/systemService.js";
import personalAssistant from "../services/personalAssistant.js";
import antigravityService from "../services/antigravityService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sessionsFile = path.join(config.dataDir, "sessions.json");

function loadSessions() {
  try {
    if (fs.existsSync(sessionsFile)) {
      return JSON.parse(fs.readFileSync(sessionsFile, "utf8"));
    }
  } catch (e) {}
  return {};
}

function saveSessions(sessions) {
  try {
    fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2), "utf8");
  } catch (e) {}
}

const activeSessions = loadSessions();

export function createWebServer() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // Verificador de números associados ao WhatsApp Bot
  const isAuthorizedPhone = (inputPhone) => {
    if (!inputPhone) return false;
    const clean = String(inputPhone).replace(/\D/g, "");
    if (!clean) return false;
    const authorized = [
      (config.senderPhone || "").replace(/\D/g, ""),
      (config.ownerPhone || "351919115655").replace(/\D/g, ""),
      (config.receiverPhone || "351912101839").replace(/\D/g, ""),
      "351919115655",
      "351912101839"
    ].filter(Boolean);

    return authorized.some((p) => clean.endsWith(p) || p.endsWith(clean));
  };

  // Middleware de autorização para Catálogo e APKs (apenas números associados ao bot ou sessão ativa)
  const checkDownloadAccess = (req, res, next) => {
    // 1. Número de telefone autorizado via query, header ou body
    const phone =
      req.query.phone ||
      req.query.number ||
      req.query.from ||
      req.headers["x-user-phone"] ||
      (req.body && req.body.phone);

    if (phone && isAuthorizedPhone(phone)) {
      return next();
    }

    // 2. Sessão web autenticada (Login com PIN no dashboard)
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : req.query.token;

    if (token && activeSessions[token]) {
      return next();
    }

    // 3. Token de sincronização PC Worker
    const syncHeader = req.headers["x-sync-token"] || req.query.sync_token;
    if (
      syncHeader &&
      (syncHeader === config.syncSecret ||
        syncHeader === "segredo_super_seguro_sync_2026" ||
        syncHeader === "sync_default_token_9959")
    ) {
      return next();
    }

    // Bloqueio para qualquer outro utilizador
    return res.status(403).json({
      error:
        "Acesso Negado: O Catálogo de Downloads é restrito exclusivamente aos números associados ao WhatsApp Bot (+351 919 115 655 / +351 912 101 839).",
      status: 403,
      authorized: false,
      help: "Indique o seu número de telemóvel autorizado via ?phone=351919115655 ou inicie sessão no painel."
    });
  };

  // Intercetor de segurança para download de ficheiros .apk
  app.use((req, res, next) => {
    if (req.path.toLowerCase().endsWith(".apk")) {
      return checkDownloadAccess(req, res, next);
    }
    next();
  });

  app.use(express.static(path.join(__dirname, "public")));

  // Lista de clientes SSE conectados para tempo real
  const sseClients = new Set();

  function broadcastSSE(eventType, data) {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(payload);
      } catch (e) {
        sseClients.delete(client);
      }
    }
  }

  // Escutar eventos do WhatsApp e Logger para broadcast SSE
  whatsapp.on("status_change", (data) => broadcastSSE("whatsapp_status", data));
  whatsapp.on("qr", (data) => broadcastSSE("whatsapp_qr", data));
  logger.on("log", (data) => broadcastSSE("log_entry", data));

  // 0. AUTENTICAÇÃO PRIVADA & CRIPTOGRAFADA (EMAIL + PIN)
  app.post("/api/auth/login", (req, res) => {
    const { email, pin } = req.body || {};
    const validEmail = (config.authEmail || "Andre22pinheiro@gmail.com").toLowerCase().trim();
    const validPin = (config.authPin || "9959").trim();

    const inputEmail = (email || "").toLowerCase().trim();
    const inputPin = (pin || "").toString().trim();

    if (inputEmail === validEmail && inputPin === validPin) {
      const token = crypto.randomBytes(32).toString("hex");
      activeSessions[token] = {
        email: validEmail,
        createdAt: new Date().toISOString()
      };
      saveSessions(activeSessions);
      logger.info(`🔐 [AUTH] Login autorizado com sucesso para: ${validEmail}`);
      return res.json({ success: true, token, email: validEmail });
    }

    logger.warn(`⛔ [AUTH] Tentativa de login falhada com email: "${inputEmail}"`);
    return res.status(401).json({ success: false, error: "Email ou código de acesso incorretos." });
  });

  app.get("/api/auth/me", (req, res) => {
    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.startsWith("Bearer ")) ? authHeader.slice(7) : req.query.token;

    if (token && activeSessions[token]) {
      return res.json({ authenticated: true, user: activeSessions[token] });
    }
    return res.status(401).json({ authenticated: false });
  });

  app.post("/api/auth/logout", (req, res) => {
    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.startsWith("Bearer ")) ? authHeader.slice(7) : req.query.token;
    if (token && activeSessions[token]) {
      delete activeSessions[token];
      saveSessions(activeSessions);
      logger.info(`🔒 [AUTH] Sessão encerrada.`);
    }
    res.json({ success: true });
  });

  // Middleware de proteção para todas as rotas da API
  app.use("/api", (req, res, next) => {
    if (req.path.startsWith("/auth/") || req.path === "/mobile-message" || req.path === "/downloads") return next();

    // Permitir rotas de sincronização PC <-> Nuvem protegidas por Token Secreto
    if (req.path.startsWith("/sync/")) {
      const syncHeader = req.headers["x-sync-token"] || req.query.sync_token;
      if (syncHeader && (syncHeader === config.syncSecret || syncHeader === "segredo_super_seguro_sync_2026" || syncHeader === "sync_default_token_9959")) {
        return next();
      }
    }

    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.startsWith("Bearer ")) ? authHeader.slice(7) : req.query.token;

    if (!token || !activeSessions[token]) {
      return res.status(401).json({ error: "Acesso restrito. Autenticação necessária.", requireAuth: true });
    }
    next();
  });

  // 1. ENDPOINT DE STATUS GERAL
  app.get("/api/status", async (req, res) => {
    const sysHealth = await systemService.getSystemHealth();
    const { cloudTunnel } = await import("../services/cloudTunnelService.js");
    res.json({
      whatsapp: whatsapp.getStatus(),
      receiver: whatsapp.receiver.getStatus(),
      sender: whatsapp.sender.getStatus(),
      system: sysHealth,
      cloud: cloudTunnel.getStatus(),
      agyInstalled: antigravityService.isAgyInstalled(),
      projectsDir: config.projectsDir,
      receiverPhone: config.receiverPhone,
      senderPhone: config.senderPhone,
      geminiConfigured: !!config.geminiApiKey
    });
  });

  // 1.1 ENDPOINT DE ACESSO EM NUVEM
  app.get("/api/cloud-url", async (req, res) => {
    const { cloudTunnel } = await import("../services/cloudTunnelService.js");
    res.json(cloudTunnel.getStatus());
  });

  // 1.1.1 ENDPOINTS DE DOWNLOADS E PROJETOS EM VERCEL (APENAS NÚMEROS DO BOT)
  app.get("/api/downloads", checkDownloadAccess, (req, res) => {
    const callerPhone =
      req.query.phone ||
      req.query.number ||
      req.headers["x-user-phone"] ||
      config.ownerPhone ||
      "351919115655";

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      authorizedCaller: callerPhone,
      message: "Acesso autorizado aos números do WhatsApp Bot.",
      vercelProjects: [
        { name: "Smooth-Bus-Routes (RotaBus)", url: "https://smooth-bus-routes.vercel.app", apkUrl: "https://smooth-bus-routes.vercel.app/rotabus.apk" },
        { name: "MatchPro (Streaming & Tática)", url: "https://matchpro-alpha.vercel.app", apkUrl: "https://matchpro-alpha.vercel.app/MatchPro.apk" },
        { name: "Pladur-Pro (Engenharia 3D & Orçamentos)", url: "https://pladur-pro.vercel.app", apkUrl: "https://pladur-pro.vercel.app/PladurPro.apk" },
        { name: "WhatsApp Dev Assistant (Painel Nuvem & Bot)", url: "http://136.64.71.248:3333", apkUrl: "https://matchpro-alpha.vercel.app/WhatsAppDevAssistant.apk" },
        { name: "AppFrota (Gestão de Frotas)", url: "https://appfrota-ten.vercel.app" },
        { name: "Casa de Bonecas 3D", url: "https://casadebonecas-3d.vercel.app" },
        { name: "Last War Tactics", url: "https://last-war-tactics.vercel.app" },
        { name: "Pesquisa Imobiliário", url: "https://pesquisa-imobiliario.vercel.app" }
      ],
      apks: [
        { name: "MatchPro.apk", sizeMb: 4.62, url: "https://matchpro-alpha.vercel.app/MatchPro.apk" },
        { name: "PladurPro.apk", sizeMb: 36.6, url: "https://pladur-pro.vercel.app/PladurPro.apk" },
        { name: "rotabus.apk", sizeMb: 79.26, url: "https://smooth-bus-routes.vercel.app/rotabus.apk" },
        { name: "WhatsAppDevAssistant.apk", sizeMb: 12.97, url: "https://matchpro-alpha.vercel.app/WhatsAppDevAssistant.apk" }
      ]
    });
  });

  app.get("/downloads/:filename", checkDownloadAccess, (req, res) => {
    const filename = req.params.filename;
    const publicPath = path.join(__dirname, "public", filename);
    const desktopPath = path.join(config.projectsDir, filename);
    const target = fs.existsSync(publicPath) ? publicPath : (fs.existsSync(desktopPath) ? desktopPath : null);

    if (target) {
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "application/vnd.android.package-archive");
      return res.sendFile(target);
    }
    return res.status(404).json({ error: `APK ${filename} não encontrado.` });
  });

  // 1.2 ENDPOINT PARA APLICAÇÃO ANDROID NO TELEMÓVEL (BRIDGE NATIVO NOTIFICATIONLISTENER)
  app.post("/api/mobile-message", async (req, res) => {
    try {
      const { sender, text } = req.body || {};
      if (!text || !text.trim()) {
        return res.status(400).json({ error: "Texto da mensagem em falta." });
      }

      const senderNumber = sender || config.ownerPhone || "351919115655";
      logger.info(`📱 [APP MOBILE] Mensagem recebida de ${senderNumber}: "${text}"`);

      const { processMobileMessage } = await import("../whatsapp/messageHandler.js");
      const reply = await processMobileMessage(senderNumber, text.trim());

      logger.info(`📱 [APP MOBILE] Resposta enviada com sucesso: "${reply ? reply.slice(0, 100) : ''}..."`);
      return res.json({ success: true, reply: reply || "✅ Mensagem processada pelo assistente." });
    } catch (err) {
      logger.error("Erro no processamento do endpoint /api/mobile-message:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // 2. ENDPOINT DE PROJETOS
  app.get("/api/projects", (req, res) => {
    const projects = androidService.listAllProjects();
    res.json({ projects });
  });

  // 3. COMPILAÇÃO DE PROJETO
  app.post("/api/build", async (req, res) => {
    const { project, variant } = req.body;
    if (!project) return res.status(400).json({ error: "Nome do projeto em falta" });

    logger.info(`Compilação solicitada via Web Dashboard para: ${project}`);
    const result = await androidService.buildAndroidProject(project, variant || "debug");
    res.json(result);
  });

  // 4. ABRIR NO ANDROID STUDIO
  app.post("/api/open-studio", (req, res) => {
    const { project } = req.body;
    if (!project) return res.status(400).json({ error: "Nome do projeto em falta" });

    const result = androidService.openInAndroidStudio(project);
    res.json(result);
  });

  // 5. DISPOSITIVOS ADB
  app.get("/api/adb-devices", async (req, res) => {
    const result = await androidService.getAdbDevices();
    res.json(result);
  });

  // 6. GESTÃO DE TAREFAS
  app.get("/api/tasks", (req, res) => {
    res.json({ tasks: personalAssistant.getTasks() });
  });

  app.post("/api/tasks", (req, res) => {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "Título em falta" });
    const task = personalAssistant.addTask(title);
    broadcastSSE("tasks_updated", { tasks: personalAssistant.getTasks() });
    res.json({ success: true, task });
  });

  app.post("/api/tasks/:id/toggle", (req, res) => {
    const task = personalAssistant.toggleTask(req.params.id);
    broadcastSSE("tasks_updated", { tasks: personalAssistant.getTasks() });
    res.json({ success: !!task, task });
  });

  app.delete("/api/tasks/:id", (req, res) => {
    const ok = personalAssistant.deleteTask(req.params.id);
    broadcastSSE("tasks_updated", { tasks: personalAssistant.getTasks() });
    res.json({ success: ok });
  });

  // 7. LEMBRETES
  app.get("/api/reminders", (req, res) => {
    res.json({ reminders: personalAssistant.getReminders() });
  });

  app.post("/api/reminders", (req, res) => {
    const { timeExpr, text } = req.body;
    const result = personalAssistant.scheduleReminder(timeExpr, text);
    res.json(result);
  });

  // 7.0.1 LISTA DE COMPRAS NA NUVEM
  app.get("/api/shopping", (req, res) => {
    res.json({ success: true, items: personalAssistant.getShoppingList() });
  });

  app.post("/api/shopping", (req, res) => {
    const { text, category, qty } = req.body || {};
    if (!text) return res.status(400).json({ error: "Nome do artigo em falta" });
    const item = personalAssistant.addShoppingItem(text, category, qty);
    res.json({ success: true, item, items: personalAssistant.getShoppingList() });
  });

  app.post("/api/shopping/:id/toggle", (req, res) => {
    const item = personalAssistant.toggleShoppingItem(req.params.id);
    res.json({ success: !!item, item, items: personalAssistant.getShoppingList() });
  });

  app.delete("/api/shopping/:id", (req, res) => {
    const ok = personalAssistant.removeShoppingItem(req.params.id);
    res.json({ success: ok, items: personalAssistant.getShoppingList() });
  });

  app.post("/api/shopping/clear", (req, res) => {
    const items = personalAssistant.clearCheckedShoppingItems();
    res.json({ success: true, items });
  });

  // 7.0.2 GESTÃO DE DESPESAS
  app.get("/api/expenses", (req, res) => {
    res.json({ success: true, expenses: personalAssistant.getExpenses() });
  });

  app.post("/api/expenses", (req, res) => {
    const { amount, category, description } = req.body || {};
    if (!amount) return res.status(400).json({ error: "Valor da despesa em falta" });
    const exp = personalAssistant.addExpense(amount, category, description);
    res.json({ success: true, expense: exp, expenses: personalAssistant.getExpenses() });
  });

  // 7.1 ORDENS DO CHAT ANTIGRAVITY (WHATSAPP BRIDGE)
  app.get("/api/chat-orders", (req, res) => {
    res.json({
      conversationId: config.activeConversationId,
      orders: antigravityService.getOrders()
    });
  });

  app.post("/api/chat-orders", async (req, res) => {
    const { order, targetProject } = req.body;
    if (!order) return res.status(400).json({ error: "Texto da ordem em falta" });

    const newOrder = antigravityService.addOrder({
      orderText: order,
      senderNumber: "WebDashboard",
      targetProject: targetProject || null
    });

    // Executar em background
    antigravityService.executeChatOrder(newOrder).catch((err) => {
      logger.error(`Erro ao executar ordem #${newOrder.id} do WebDashboard:`, err);
    });

    res.json({ success: true, order: newOrder });
  });

  // 7.2 ROTAS DE SINCRONIZAÇÃO PC <-> NUVEM (PARA EXECUTAR ORDENS QUANDO O PC LIGA)
  app.post("/api/sync/heartbeat", async (req, res) => {
    const { pcSyncService } = await import("../services/pcSyncService.js");
    pcSyncService.recordHeartbeat(req.body);
    const pending = pcSyncService.getPendingOrders();
    res.json({
      success: true,
      pendingOrdersCount: pending.length,
      hasPending: pending.length > 0
    });
  });

  app.get("/api/sync/orders/pending", async (req, res) => {
    const { pcSyncService } = await import("../services/pcSyncService.js");
    res.json({
      success: true,
      orders: pcSyncService.getPendingOrders()
    });
  });

  app.post("/api/sync/orders/:id/complete", async (req, res) => {
    const { pcSyncService } = await import("../services/pcSyncService.js");
    const result = await pcSyncService.completeOrder(req.params.id, req.body || {});
    res.json({ success: !!result, order: result });
  });

  app.get("/api/sync/status", async (req, res) => {
    const { pcSyncService } = await import("../services/pcSyncService.js");
    res.json(pcSyncService.getStatus());
  });

  // 7.3 IMPORTAR SESSÃO DO WHATSAPP DIRETAMENTE DO PC (SEM QR CODE NEM CÓDIGOS)
  app.post("/api/sync/upload-session", async (req, res) => {
    const { zipBase64, target } = req.body || {};
    if (!zipBase64) return res.status(400).json({ error: "zipBase64 em falta" });

    try {
      const buffer = Buffer.from(zipBase64, "base64");
      const zipPath = path.join(config.dataDir, "uploaded_session.zip");
      fs.writeFileSync(zipPath, buffer);

      const targetDir = (target === "sender") ? config.authSenderDir : config.authReceiverDir;
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const { execSync } = await import("child_process");
      const pythonCmd = process.platform === "win32" ? "python" : "python3";
      execSync(`${pythonCmd} -c "import zipfile, sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "${zipPath}" "${targetDir}"`);

      saveSettings({ isDualBotEnabled: false, sessionLocked: true });

      logger.info(`📦 Sessão (${target || "receiver"}) importada com sucesso do PC! A reiniciar processo para aplicar ligação direta...`);
      res.json({ success: true, message: "Sessão importada com sucesso! A reiniciar aplicação..." });

      setTimeout(() => {
        process.exit(0);
      }, 800);
    } catch (e) {
      logger.error("Erro ao importar sessão:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // 8. DEFINIÇÕES
  app.post("/api/settings", (req, res) => {
    const { ownerPhone, geminiApiKey, allowAllSenders, emailUser, emailPassword } = req.body;
    const updates = {};
    if (ownerPhone !== undefined) {
      config.ownerPhone = ownerPhone;
      updates.ownerPhone = ownerPhone;
    }
    if (geminiApiKey !== undefined) {
      config.geminiApiKey = geminiApiKey;
      updates.geminiApiKey = geminiApiKey;
    }
    if (allowAllSenders !== undefined) {
      config.allowAllSenders = allowAllSenders;
      updates.allowAllSenders = allowAllSenders;
    }
    if (emailUser !== undefined) {
      config.emailUser = emailUser;
      updates.emailUser = emailUser;
    }
    if (emailPassword !== undefined) {
      config.emailPassword = emailPassword;
      updates.emailPassword = emailPassword;
    }
    if (req.body.telegramBotToken !== undefined) {
      config.telegramBotToken = req.body.telegramBotToken;
      updates.telegramBotToken = config.telegramBotToken;
    }
    if (req.body.telegramChatId !== undefined) {
      config.telegramChatId = req.body.telegramChatId;
      updates.telegramChatId = config.telegramChatId;
    }

    const updated = saveSettings(updates);
    res.json({ success: true, settings: updated });
  });

  // 8.1 GESTÃO DE EMAILS (LEITURA E RESUMO)
  app.get("/api/emails", async (req, res) => {
    try {
      const { emailService } = await import("../services/emailService.js");
      if (!emailService.isConfigured()) {
        return res.json({ success: false, configured: false, error: "Email não configurado" });
      }
      const query = req.query.q || "";
      const limit = parseInt(req.query.limit || "6", 10);
      const emails = await emailService.fetchRecentEmails({ limit, query });
      const summary = await emailService.generateEmailsSummary(emails, query);
      res.json({ success: true, configured: true, emails, summary });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/emails/send", async (req, res) => {
    try {
      const { emailService } = await import("../services/emailService.js");
      if (!emailService.isConfigured()) {
        return res.status(400).json({ success: false, error: "Email não configurado" });
      }
      const { to, subject, body } = req.body || {};
      if (!to || !body) {
        return res.status(400).json({ success: false, error: "Destinatário ('to') e corpo ('body') são obrigatórios" });
      }
      const result = await emailService.sendEmail({ to, subject, body });
      res.json({ success: true, result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 8.2 DESENVOLVIMENTO AUTÓNOMO DE APPS VIA API
  app.post("/api/app/generate", async (req, res) => {
    try {
      const { appScaffoldService } = await import("../services/appScaffoldService.js");
      const { name, prompt, sender } = req.body || {};
      if (!name || !prompt) {
        return res.status(400).json({ success: false, error: "Nome ('name') e prompt ('prompt') são obrigatórios." });
      }
      logger.info(`🌐 Requisição API recebida para gerar app '${name}'...`);
      const result = await appScaffoldService.buildAndDeployApp({ name, prompt, sender });
      res.json({ success: true, app: result });
    } catch (e) {
      logger.error("Erro na API ao gerar app:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/email/check-prompts", async (req, res) => {
    try {
      const { emailService } = await import("../services/emailService.js");
      const result = await emailService.checkAppPromptEmails();
      res.json({ success: true, result });
    } catch (e) {
      logger.error("Erro na verificação de emails de prompts via API:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 8.3 GOOGLE CALENDÁRIO & SINCRONIZAÇÃO NATIVA ANDROID
  app.get("/api/calendar/events", async (req, res) => {
    try {
      const { getAllEvents, getUpcomingEvents, formatDayAgenda } = await import("../services/calendarService.js");
      const events = getUpcomingEvents(14);
      const todayAgenda = formatDayAgenda();
      res.json({ success: true, events, todayAgenda });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/calendar/sync", async (req, res) => {
    try {
      const { summary, events } = req.body || {};
      logger.info(`📅 Calendário sincronizado a partir do telemóvel Android!`);
      if (summary) {
        saveSettings({ lastDeviceCalendarSummary: summary, lastCalendarSyncAt: new Date().toISOString() });
      }
      res.json({ success: true, message: "Calendário Android sincronizado com sucesso" });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 9. FORÇAR RECONEXÃO / GERAR NOVO CÓDIGO
  app.post("/api/reconnect", async (req, res) => {
    const { target, reset, restartProcess } = req.body || {};
    logger.info(`Reconexão solicitada (alvo: ${target || "todos"}, reset: ${!!reset}, restart: ${!!restartProcess})`);
    try {
      if (restartProcess) {
        res.json({ success: true, message: "A reiniciar processo..." });
        setTimeout(() => process.exit(0), 500);
        return;
      }
      await whatsapp.reconnect(target || "all", !!reset);
      res.json({ success: true, message: "Reconexão iniciada" });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 9.1 GERAR NOVO CÓDIGO DE EMPARELHAMENTO FRESCO
  app.post("/api/pairing-code", async (req, res) => {
    try {
      const activeBot = whatsapp.receiver || whatsapp.sender;
      if (activeBot.connectionState === "connected") {
        return res.json({ success: true, connected: true, message: "Já conectado" });
      }
      if (!activeBot.sock) {
        return res.status(500).json({ success: false, error: "Socket não inicializado" });
      }
      const cleanPhone = (activeBot.phone || config.receiverPhone || "351912101839").replace(/\D/g, "");
      activeBot.pairingCode = null;
      const code = await activeBot.sock.requestPairingCode(cleanPhone);
      activeBot.pairingCode = code;
      logger.info(`🔢 Novo código de emparelhamento gerado a pedido: ${code}`);
      res.json({ success: true, pairingCode: code, phone: cleanPhone });
    } catch (e) {
      logger.error("Erro ao gerar novo pairing code:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 10. SIMULADOR DE CHAT INTERATIVO (TESTES AUTÓNOMOS E USO VIA BROWSER)
  app.post("/api/chat/send", async (req, res) => {
    const { text, fromPhone } = req.body;
    if (!text) return res.status(400).json({ error: "Texto em falta" });

    const phone = (fromPhone || config.ownerPhone || "351912101839").replace(/\D/g, "");
    const simulatedSenderJid = `${phone}@s.whatsapp.net`;

    const responses = [];
    const simulatedSock = {
      sendMessage: async (targetJid, content) => {
        let textReply = content.text || "";
        let hasImage = !!content.image;
        let hasDoc = !!content.document;
        let fileName = content.fileName || "";
        let caption = content.caption || "";

        let imageBase64 = null;
        if (hasImage && Buffer.isBuffer(content.image)) {
          imageBase64 = "data:image/png;base64," + content.image.toString("base64");
        }

        responses.push({
          targetJid,
          text: textReply,
          hasImage,
          imageBase64,
          hasDoc,
          fileName,
          caption,
          timestamp: new Date().toLocaleTimeString("pt-PT")
        });

        return { key: { id: "SIM_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6) } };
      }
    };

    const simulatedMsg = {
      key: {
        remoteJid: simulatedSenderJid,
        fromMe: phone.includes("919115655"),
        id: "WEB_SIM_" + Date.now()
      },
      message: {
        conversation: text
      }
    };

    try {
      const { handleIncomingMessage } = await import("../whatsapp/messageHandler.js");
      const { botSentMessageIds } = await import("../whatsapp/client.js");
      await handleIncomingMessage(simulatedSock, simulatedMsg, botSentMessageIds);
      res.json({ success: true, responses });
    } catch (e) {
      logger.error("Erro no simulador de chat:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 11. LOGS EM TEMPO REAL VIA SSE
  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    sseClients.add(res);

    // Enviar estado inicial e logs recentes
    res.write(`event: init\ndata: ${JSON.stringify({
      status: whatsapp.getStatus(),
      logs: logger.getRecentLogs()
    })}\n\n`);

    req.on("close", () => {
      sseClients.delete(res);
    });
  });

  return app;
}

export default createWebServer;

