import telegramService from "../src/services/telegramService.js";
import cloudinaryService from "../src/services/cloudinaryService.js";

async function main() {
  const msg = 
`☁️ *DEFINIÇÕES DO CLOUDINARY ATUALIZADAS!*
━━━━━━━━━━━━━━━━━━━━━━━━
${cloudinaryService.getStatus()}`;

  const res = await telegramService.notifyOwner(msg);
  console.log("Mensagem Telegram enviada:", res?.ok ? "SUCESSO" : JSON.stringify(res));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
