import telegramService from "../src/services/telegramService.js";

async function main() {
  const msg = 
`🏛️ *UNIFIED MASTER AI ASSISTANT ONLINE (TEMP 0.0)*
━━━━━━━━━━━━━━━━━━━━━━━━
André, todas as directivas foram integradas com sucesso:

⚡ *Motor Determinístico:* Groq LPU (openai/gpt-oss-120b) a temperatura 0.0
🐙 *GitHub Dev Token:* Configurado (andre22pinheiro-ui)
🗺️ *Cartografia:* OSM Amarante (amarante.osm) integrado
🔑 *Directório de APIs:* Protocolo ativo (/apis) para Google Gemini, Groq, ORS, Supabase, Cloudinary, Hugging Face, DRE/EUR-Lex

*Módulos Ativos:*
1. 🚌 Frotas & RotaBus (/frotas, /tacografo)
2. 👨‍🏫 Formador TCC (/tcc, /formador)
3. 🏠 Avaliação Imobiliária ImmoEval (/immo)
4. 🥗 Nutrição & Ergonomia (/nutricao, /briefing)
5. 💻 Engenharia de Software (/criar_app)
6. ⚖️ Legislação DRE.pt & EUR-Lex (/leis, /dre)

Digita /menu ou coloca qualquer questão.`;

  const res = await telegramService.notifyOwner(msg);
  console.log("Mensagem Telegram enviada:", res?.ok ? "SUCESSO" : JSON.stringify(res));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
