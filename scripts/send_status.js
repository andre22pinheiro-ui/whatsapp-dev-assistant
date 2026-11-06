import telegramService from "../src/services/telegramService.js";
import cloudinaryService from "../src/services/cloudinaryService.js";

async function main() {
  const msg = 
`☁️ *CLOUDINARY 100% ATIVO & OPERACIONAL!*
━━━━━━━━━━━━━━━━━━━━━━━━
André, o teu Cloudinary ficou totalmente validado com o Cloud Name correto (\`rjcfdrpn\`):

• *Cloud Name:* \`rjcfdrpn\`
• *API Key:* \`358642419643238\`
• *Upload Teste:* Concluído com sucesso na CDN!
• *URL de Teste:* https://res.cloudinary.com/rjcfdrpn/image/upload/v1793988896/antigravity-media/dkdyj25l4mnqd3ljtpvg.png

━━━━━━━━━━━━━━━━━━━━━━━━
🗣️ *MODO DE LINGUAGEM CORRENTE ATIVADO*
A partir de agora podes falar comigo normalmente, sem comandos de barra (/) nem frases robóticas. Podes pedir-me rotas, apontar compras, tirar dúvidas sobre o tacógrafo ou leis de pesados, pedir avaliações de casas ou conversar sobre código, tudo em português normal do dia-a-dia.`;

  const res = await telegramService.notifyOwner(msg);
  console.log("Mensagem Telegram enviada:", res?.ok ? "SUCESSO" : JSON.stringify(res));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
