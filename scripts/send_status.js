import telegramService from "../src/services/telegramService.js";
import blenderService from "../src/services/blenderService.js";

async function main() {
  const msg = 
`🎨 *ACESSO AO BLENDER 3D CONFIRMADO!*
━━━━━━━━━━━━━━━━━━━━━━━━
${blenderService.getStatus()}

💡 Podes pedir em linguagem natural:
• "Renderiza um modelo 3D de autocarro"
• "Gera uma cena 3D de divisória de pladur"`;

  const res = await telegramService.notifyOwner(msg);
  console.log("Mensagem Telegram enviada:", res?.ok ? "SUCESSO" : JSON.stringify(res));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
