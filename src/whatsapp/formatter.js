// Formatadores de mensagens para WhatsApp (Markdown suportado: *bold*, _italic_, ~strike~, ```code```)

export function formatHelp(prefix = "/") {
  return `
🤖 *WHATSAPP DEV & PERSONAL ASSISTANT 24/7*
━━━━━━━━━━━━━━━━━━━━━━━━
👋 Olá, André! Estou 100% conectado na nuvem e sincronizado com o teu Surface Pro.

👔 *GESTOR PESSOAL (CALENDÁRIO & EMAIL):*
• \`${prefix}gestor\` - Painel executivo diário (agenda de hoje, emails, rascunhos e tarefas)
• \`${prefix}hoje\` - Compromissos e reuniões de hoje
• \`${prefix}amanha\` - Agenda detalhada de amanhã
• \`${prefix}anotar-evento <quando> <o que>\` - Marca evento com deteção de conflitos e Google Calendar
• \`${prefix}rever-agenda\` ou \`${prefix}agenda\` - Ver próximos 7 dias
• \`${prefix}procurar-evento <termo>\` - Pesquisa eventos pelo nome ou local
• \`${prefix}emails\` ou \`${prefix}rever-emails\` - Resumo executivo com IA dos últimos emails
• \`${prefix}ler-email <id>\` - Análise profunda de email e sugestão de resposta
• \`${prefix}rascunhos\` - Lista de rascunhos de email anotados
• \`${prefix}anotar-email <para> <assunto> : <msg>\` - Anota rascunho para rever e enviar
• \`${prefix}enviar-rascunho <id>\` - Envia o rascunho anotado imediatamente
• \`${prefix}apagar-rascunho <id>\` - Elimina rascunho
• \`${prefix}enviar-email <para> <assunto> : <corpo>\` - Envia email diretamente pelo WhatsApp

🛠️ *PROJETOS ANDROID & DEV:*
• \`${prefix}projetos\` - Lista os 22 projetos sincronizados do Surface
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
• \`${prefix}config email <pass>\` - Configura a palavra-passe de app Gmail
• \`${prefix}confirmar\` - Confirmação do ecossistema AgentX
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

export function formatPersonalManagerDashboard({
  todayEvents = [],
  tomorrowEvents = [],
  tasks = [],
  drafts = [],
  isEmailConfigured = false,
  emailUser = ""
}) {
  const now = new Date();
  const dateFormatted = now.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });

  let text =
    `👔 *GESTOR PESSOAL EXECUTIVO - ANDRÉ PINHEIRO*\n` +
    `🗓️ _${dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1)}_\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // 1. Calendário de Hoje
  text += `📅 *HOJE (${todayEvents.length} compromisso${todayEvents.length === 1 ? "" : "s"}):*\n`;
  if (todayEvents.length === 0) {
    text += `   • 🏖️ _Nenhum compromisso agendado para hoje. Dia livre!_\n`;
  } else {
    todayEvents.forEach((e, i) => {
      const loc = e.location ? ` (${e.location})` : "";
      text += `   ${i + 1}. 🕒 *${e.time}* - ${e.title}${loc}\n`;
    });
  }

  // 2. Calendário de Amanhã
  text += `\n📅 *AMANHÃ (${tomorrowEvents.length} compromisso${tomorrowEvents.length === 1 ? "" : "s"}):*\n`;
  if (tomorrowEvents.length === 0) {
    text += `   • 🏖️ _Sem compromissos marcados para amanhã._\n`;
  } else {
    tomorrowEvents.forEach((e, i) => {
      const loc = e.location ? ` (${e.location})` : "";
      text += `   ${i + 1}. 🕒 *${e.time}* - ${e.title}${loc}\n`;
    });
  }

  // 3. Email & Rascunhos
  text += `\n📧 *EMAIL & RASCUNHOS (${emailUser || "Gmail"}):*\n`;
  text += `   • Conexão: ${isEmailConfigured ? "✅ *Ativo e Sincronizado*" : "⚠️ *Pendente de Palavra-passe de App*"}\n`;
  if (drafts.length === 0) {
    text += `   • 📝 Rascunhos guardados: _Nenhum rascunho pendente._\n`;
  } else {
    text += `   • 📝 *${drafts.length} Rascunho(s) Anotado(s) para Rever:*\n`;
    drafts.slice(0, 3).forEach((d, idx) => {
      text += `     ${idx + 1}. *[#${d.id}]* Para: _${d.to || "Sem destinatário"}_ - "${d.subject}"\n`;
    });
    if (drafts.length > 3) {
      text += `     _(+${drafts.length - 3} outros rascunhos)_\n`;
    }
  }

  // 4. Tarefas Prioritárias
  const pendingTasks = tasks.filter((t) => !t.completed);
  text += `\n📋 *TAREFAS PENDENTES (${pendingTasks.length}):*\n`;
  if (pendingTasks.length === 0) {
    text += `   • ✅ _Todas as tarefas concluídas!_\n`;
  } else {
    pendingTasks.slice(0, 3).forEach((t) => {
      const shortId = t.id ? t.id.slice(-4) : "";
      text += `   • ⏳ \`#${shortId}\` ${t.title}\n`;
    });
    if (pendingTasks.length > 3) {
      text += `   • _(+${pendingTasks.length - 3} tarefas adicionais)_\n`;
    }
  }

  // 5. Ações Rápidas
  text +=
    `\n━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `⚡ *COMANDOS DO GESTOR PESSOAL:*\n` +
    `• \`/hoje\` ou \`/amanha\` - Rever compromissos\n` +
    `• \`/anotar-evento <quando> <o que>\` - Novo evento\n` +
    `• \`/emails\` ou \`/rever-emails\` - Resumo da caixa\n` +
    `• \`/rascunhos\` - Rever rascunhos de email\n` +
    `• \`/anotar-email <para> <assunto> : <msg>\` - Guardar rascunho\n` +
    `• \`/enviar-rascunho <id>\` - Expedir rascunho`;

  return text;
}

export default {
  formatHelp,
  formatProjects,
  formatStatus,
  formatTasks,
  formatPersonalManagerDashboard
};
