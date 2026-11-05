import http from "http";
import config from "./config.js";
import logger from "./utils/logger.js";
import { createWebServer } from "./web/server.js";
import whatsapp from "./whatsapp/client.js";

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║                                                                        ║
║      📱 WHATSAPP DEV & PERSONAL ASSISTANT (ANTIGRAVITY & ANDROID)     ║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝
`);

  logger.info(`A iniciar servidor Web Dashboard na porta ${config.port}...`);

  const app = createWebServer();
  const server = http.createServer(app);

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      logger.warn(`Porta ${config.port} já em uso. Existe outra instância ativa.`);
      process.exit(0);
    } else {
      logger.error("Erro no servidor HTTP:", err);
    }
  });

  server.listen(config.port, () => {
    logger.info(`🌐 Web Dashboard disponível em: http://localhost:${config.port}`);
    logger.info(`📁 Pasta de Projetos: ${config.projectsDir}`);
    logger.info(`⚡ Antigravity CLI: ${config.agyPath}`);
  });

  // Iniciar cliente WhatsApp
  try {
    await whatsapp.start();

    // Ligar notificações do PC Worker ao WhatsApp
    const { pcSyncService } = await import("./services/pcSyncService.js");
    pcSyncService.setWhatsappNotifier(async (completedOrder) => {
      try {
        const rawRecipient = completedOrder.from || config.ownerPhone || "351912101839";
        const cleanRecipient = rawRecipient.includes("@")
          ? rawRecipient
          : `${rawRecipient.replace(/\D/g, "")}@s.whatsapp.net`;

        const successIcon = completedOrder.status === "completed" ? "✅" : "❌";
        const messageText =
          `${successIcon} *RELATÓRIO DO PC: ORDEM #${completedOrder.id}*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📋 *Ordem:* _"${completedOrder.order}"_\n` +
          `⏱️ *Duração no PC:* ${completedOrder.durationSeconds || 0}s\n\n` +
          `${(completedOrder.result || "Concluído sem mensagem").slice(0, 2500)}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💻 _Executado diretamente no teu PC físico._`;

        await whatsapp.sendMessage(cleanRecipient, { text: messageText });
        logger.info(`Notificação da ordem #${completedOrder.id} enviada via WhatsApp para ${cleanRecipient}`);
      } catch (err) {
        logger.error(`Erro ao enviar notificação da ordem #${completedOrder.id}:`, err);
      }
    });
  } catch (err) {
    logger.error("Erro ao inicializar WhatsApp:", err);
  }

  // Iniciar túnel de acesso em nuvem (Cloudflare HTTPS)
  if (config.enableCloudTunnel !== false) {
    try {
      const { cloudTunnel } = await import("./services/cloudTunnelService.js");
      cloudTunnel.startTunnel(config.port);
    } catch (err) {
      logger.warn(`Aviso ao iniciar Cloud Tunnel: ${err.message}`);
    }
  }

  // Encerramento controlado
  const shutdown = () => {
    logger.info("A encerrar assistente com segurança...");
    try {
      import("./services/cloudTunnelService.js").then(({ cloudTunnel }) => cloudTunnel.stopTunnel());
    } catch (e) {}
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  process.on("unhandledRejection", (err) => {
    logger.warn(`Unhandled Rejection protegido: ${err?.message || err}`);
  });

  process.on("uncaughtException", (err) => {
    logger.warn(`Uncaught Exception protegida: ${err?.message || err}`);
  });
}

main().catch((e) => {
  console.error("Erro fatal na inicialização:", e);
});

