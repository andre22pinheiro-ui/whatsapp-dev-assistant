import telegramService from "../src/services/telegramService.js";
import orsRouteService from "../src/services/orsRouteService.js";

async function main() {
  const msg = 
`🛣️ *OPENROUTESERVICE (ROTABUS) ATIVADO!*
━━━━━━━━━━━━━━━━━━━━━━━━
${orsRouteService.getStatus()}

💡 Teste rápido de gabarito e tempos de rota:
\`/rota Amarante para Penafiel\` ou \`/rota Amarante para Porto\``;

  const res = await telegramService.notifyOwner(msg);
  console.log("Mensagem Telegram enviada:", res?.ok ? "SUCESSO" : JSON.stringify(res));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
