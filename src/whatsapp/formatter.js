// Formatadores de mensagens para WhatsApp (Markdown suportado: *bold*, _italic_, ~strike~, ```code```)

export function formatHelp(prefix = "/") {
  return `
🤖 *ASSISTENTE DE DESENVOLVIMENTO & PESSOAL (DUAL-BOT)*
━━━━━━━━━━━━━━━━━━━━━━━━
👋 Olá! Estou conectado ao teu computador e pronto para diagnosticar, compilar e reparar os teus projetos.

🛠️ *GESTÃO & AUTO-CURA DE PROJETOS:*
• \`${prefix}projetos\` - Lista projetos em Desktop\\projectos
• \`${prefix}diagnostico <proj>\` - Diagnostica problemas e saúde do projeto
• \`${prefix}corrigir <proj>\` - Executa auto-reparação estrutural e limpa bloqueios
• \`${prefix}build <proj>\` - Compila APK Debug (Capacitor ou Android Nativo)
• \`${prefix}apk <proj>\` - Envia o último APK para instalar no telemóvel
• \`${prefix}studio <proj>\` - Abre o projeto no Android Studio
• \`${prefix}flashscore\` - Confirmação e dados oficiais de jogos via Flashscore.pt

🧠 *APRENDIZAGEM CONTÍNUA:*
• \`${prefix}aprender <quando disser X> = <fazer Y>\` - Ensina atalhos e padrões
• \`${prefix}aprendizados\` - Lista comandos aprendidos

⚡ *ANTIGRAVITY CODING AI & CHAT BRIDGE:*
• \`${prefix}ordem <instrução>\` - Adiciona e executa ordem no Chat Antigravity
• \`${prefix}ordem <proj> : <instrução>\` - Ordem focada num projeto específico
• \`${prefix}ordens\` - Lista as ordens recentes do Chat
• \`${prefix}chat <instrução>\` - Atalho direto para ordens no Chat
• \`${prefix}agy <prompt>\` - Executa tarefa no Antigravity CLI

💻 *CONTROLO DO COMPUTADOR & NUVEM:*
• \`${prefix}nuvem\` - Link público HTTPS de acesso ao painel a partir de qualquer rede
• \`${prefix}status\` ou \`${prefix}pc\` - CPU, RAM, bateria, disco
• \`${prefix}print\` ou \`${prefix}screenshot\` - Foto do ecrã do PC
• \`${prefix}cmd <comando>\` - Executa comando no terminal PowerShell

📋 *GESTOR PESSOAL:*
• \`${prefix}tarefa <texto>\` - Adiciona uma nova tarefa
• \`${prefix}tarefas\` - Lista as tarefas pendentes
• \`${prefix}feita <id>\` - Marca tarefa como concluída
• \`${prefix}lembrete <tempo> <texto>\` - Agenda lembrete e cria evento para o Google Calendar

💬 *CONVERSA COM IA:*
Podes também falar normalmente comigo!
_Ex: "Como está o uso de memória do meu PC?", "Diagnostica o matchpro" ou "Compila o APK do pladur-pro"._
━━━━━━━━━━━━━━━━━━━━━━━━
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
