import telegramService from "../src/services/telegramService.js";
import huggingfaceService from "../src/services/huggingfaceService.js";

async function main() {
  const msg = 
`🤗 *HUGGING FACE TOKEN ATIVADO!*
━━━━━━━━━━━━━━━━━━━━━━━━
${huggingfaceService.getStatus()}

💡 Consultar a qualquer momento: \`/hf\` ou \`/huggingface\``;

  const res = await telegramService.notifyOwner(msg);
  console.log("Mensagem Telegram enviada:", res?.ok ? "SUCESSO" : JSON.stringify(res));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
