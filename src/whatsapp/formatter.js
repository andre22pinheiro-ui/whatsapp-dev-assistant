// Formatadores de mensagens para WhatsApp (Markdown suportado: *bold*, _italic_, ~strike~, ```code```)

export function formatHelp(prefix = "/") {
  return `
🤖 *WHATSAPP DEV & PERSONAL ASSISTANT 24/7*
━━━━━━━━━━━━━━━━━━━━━━━━
👋 Olá, André! Estou 100% conectado na nuvem e sincronizado com o teu Surface Pro.

🛠️ *PROJETOS ANDROID & DEV:*
• \`${prefix}projetos\` - Lista os 8 projetos sincronizados do Surface
• \`${prefix}diagnostico <proj>\` - Saúde e diagnóstico de ficheiros Gradle/Manifest
• \`${prefix}corrigir <proj>\` - Auto-cura de erros e dependências
• \`${prefix}build <proj>\` - Compila APK Debug e envia no WhatsApp
• \`${prefix}release <proj>\` - Compila APK de Produção (Release)
• \`${prefix}apk <proj>\` - Envia o último APK pronto para instalar
• \`${prefix}studio <proj>\` - Abre o projeto no Android Studio do PC

📅 *CALENDÁRIO & GOOGLE CALENDAR:*
• \`${prefix}agenda\` - Lista os teus compromissos organizados
• \`${prefix}evento <quando> <o que>\` - Absorve evento imediato
  _Ex: "agenda amanhã às 15h Reunião" ou "marca sexta 10:30 Dentista"_
  *(Gera link de 1 clique Google Calendar, ficheiro .ics e aviso 15 min antes)*
• \`${prefix}lembrete <tempo> <texto>\` - Alarme no WhatsApp (ex: \`${prefix}lembrete 20m Ligar engenheiro\`)

📋 *TAREFAS & NOTAS RÁPIDAS:*
• \`${prefix}tarefa <texto>\` - Adiciona nova tarefa à tua lista
• \`${prefix}tarefas\` - Lista de tarefas pendentes
• \`${prefix}feita <id>\` - Marca tarefa como concluída
• \`${prefix}nota <texto>\` - Bloco de notas para medições, ideias e dados de obra
• \`${prefix}notas\` - Consulta as tuas últimas notas guardadas

📧 *GESTÃO INTELIGENTE DE EMAILS (GMAIL):*
• \`${prefix}emails\` ou \`${prefix}resumo-emails\` - Resumo executivo com IA dos últimos emails
• \`${prefix}email <termo>\` - Filtra e resume emails (ex: \`${prefix}email obra\` ou \`${prefix}email faturas\`)
• \`${prefix}ler-email <id>\` - Análise profunda e rascunho de resposta sugerido
• \`${prefix}enviar-email <para> <assunto> : <corpo>\` - Envia email diretamente pelo WhatsApp
• \`${prefix}config email <pass>\` - Configura a palavra-passe de app Gmail

💻 *CONTROLO SURFACE PRO & NUVEM:*
• \`${prefix}status\` ou \`${prefix}pc\` - CPU, RAM, Bateria do Surface, Disco, Uptime
• \`${prefix}print\` - Captura de ecrã em direto do portátil
• \`${prefix}cmd <comando>\` - Executa comando no terminal do sistema
• \`${prefix}nuvem\` - Link seguro do Painel Web (Dashboard)

⚡ *AGENTE AUTÓNOMO ANTIGRAVITY (AGY):*
• \`${prefix}ordem <instrução>\` - Executa código e tarefas no PC com o AGY
• \`${prefix}ordens\` - Histórico e estado das ordens executadas

🎙️ *MULTIMODALIDADE (ÁUDIO & FOTOS):*
• Podes enviar *mensagens de áudio* (voz) e o bot transcreve e age!
• Podes enviar *fotos/capturas* de erros ou documentos para análise com IA!

⚙️ *DEFINIÇÕES & IA:*
• \`${prefix}config\` - Estado do sistema e chave Gemini
• \`${prefix}config key <chave>\` - Configura ou atualiza a chave Gemini
• \`${prefix}flashscore\` - Resultados e confirmação em direto de jogos oficiais
━━━━━━━━━━━━━━━━━━━━━━━━
💡 _Podes falar normalmente por voz ou texto em português sem usar barras!_
`;
}

export function formatProjects(projects) {
  if (!projects || projects.length === 0) {
    return "📁 *Nenhum projeto encontrado* na pasta Desktop\\projectos.";
  }

  let text = `📂 *PROJETOS PREPARADOS (${projects.length}):*\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  projects.forEach((p, idx) => {
    let icon = "📁";
    let typeLabel = "Geral";

    if (p.type === "capacitor-android") {
      icon = "⚡📱";
      typeLabel = "Capacitor + Android";
    } else if (p.type === "android-native") {
      icon = "🤖";
      typeLabel = "Android Nativo (Gradle)";
    } else if (p.type === "python") {
      icon = "🐍";
      typeLabel = "Python";
    } else if (p.type === "node") {
      icon = "📦";
      typeLabel = "Node.js";
    }

    const apkInfo = p.latestApk ? `\n   📦 _APK Recente:_ \`${p.latestApk.name}\` (${p.latestApk.sizeMb} MB)` : "";

    text += `${idx + 1}. ${icon} *${p.name}* [_${typeLabel}_]${apkInfo}\n`;
  });

  text += `━━━━━━━━━━━━━━━━━━━━━━━━\n💡 _Dica: Usa \`/diagnostico <nome>\` para verificar erros, \`/corrigir <nome>\` para auto-cura ou \`/build <nome>\` para compilar._`;
  return text;
}

export function formatStatus(health) {
  if (!health.success) {
    return `❌ *Erro ao obter estado do computador:* ${health.error}`;
  }

  const d = health.data;
  return `
💻 *ESTADO DO COMPUTADOR (${d.hostname})*
━━━━━━━━━━━━━━━━━━━━━━━━
⚙️ *Processador (CPU):* ${d.cpuLoad}
🧠 *Memória RAM:* ${d.ram}
🔋 *Bateria:* ${d.battery}
💾 *Disco C::* ${d.disk}
⏱️ *Uptime:* ${d.uptime}
🖥️ *Sistema:* ${d.os}
━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

export function formatTasks(tasks) {
  if (!tasks || tasks.length === 0) {
    return "📝 *A tua lista de tarefas está vazia!*\nUsa `/tarefa <texto>` para adicionar uma nova tarefa.";
  }

  let text = `📋 *AS TUAS TAREFAS (${tasks.length}):*\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  tasks.forEach((t) => {
    const icon = t.completed ? "✅" : "⏳";
    const shortId = t.id.slice(-4);
    const body = t.completed ? `~${t.title}~` : t.title;
    text += `${icon} \`#${shortId}\` ${body}\n`;
  });

  text += `━━━━━━━━━━━━━━━━━━━━━━━━\n💡 _Usa \`/feita <id>\` para concluir ou \`/apagar <id>\` para remover._`;
  return text;
}

export default {
  formatHelp,
  formatProjects,
  formatStatus,
  formatTasks
};
