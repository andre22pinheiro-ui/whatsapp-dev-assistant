import telegramService from "../src/services/telegramService.js";
import cloudinaryService from "../src/services/cloudinaryService.js";

async function main() {
  const msg = 
`☁️ *CLOUD NAME CLOUDINARY ATIVADO!*
━━━━━━━━━━━━━━━━━━━━━━━━
${cloudinaryService.getStatus()}

💡 Para concluir a autenticação da API:
No teu painel (onde viste \`crjcfdrpn\`), copia a **API Key** (número de 15 dígitos) que está mesmo ao lado do Secret e envia:
\`/config cloudinary <api_key>\``;

  const res = await telegramService.notifyOwner(msg);
  console.log("Mensagem Telegram enviada:", res?.ok ? "SUCESSO" : JSON.stringify(res));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
