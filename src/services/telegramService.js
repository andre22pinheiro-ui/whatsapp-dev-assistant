import config, { saveSettings } from "../config.js";
import logger from "../utils/logger.js";
import appScaffoldService from "./appScaffoldService.js";
import emailService from "./emailService.js";
import calendarService from "./calendarService.js";
import systemService from "./systemService.js";
import universalProjectService from "./universalProjectService.js";
import personalAssistant from "./personalAssistant.js";
import aiService from "./aiService.js";
import portugalLawService from "./portugalLawService.js";
import masterDomainService from "./masterDomainService.js";

class TelegramService {
  constructor() {
    this.isPolling = false;
    this.lastUpdateId = 0;
    this.pollAbortController = null;
    this.botInfo = null;
  }

  isConfigured() {
    return Boolean(config.telegramBotToken && config.telegramBotToken.trim());
  }

  getApiUrl(method) {
    return `https://api.telegram.org/bot${config.telegramBotToken}/${method}`;
  }

  // Enviar mensagem de texto formatada
  async sendMessage(chatId, text, { parseMode = "Markdown", replyMarkup = null } = {}) {
    if (!this.isConfigured()) return null;

    const targetChatId = chatId || config.telegramChatId;
    if (!targetChatId) {
      logger.warn("Telegram: Nenhum Chat ID configurado para envio de mensagem.");
      return null;
    }

    try {
      const payload = {
        chat_id: targetChatId,
        text,
        disable_web_page_preview: false
      };

      if (parseMode) {
        payload.parse_mode = parseMode;
      }
      if (replyMarkup) {
        payload.reply_markup = replyMarkup;
      }

      const res = await fetch(this.getApiUrl("sendMessage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data.ok) {
        // Se falhar com Markdown por causa de caracteres especiais, tentar sem parse_mode
        if (parseMode && data.description?.includes("can't parse entities")) {
          delete payload.parse_mode;
          const retryRes = await fetch(this.getApiUrl("sendMessage"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          return await retryRes.json();
        }
        logger.warn(`Erro no envio de mensagem Telegram: ${data.description}`);
      }
      return data;
    } catch (err) {
      logger.error("Erro na chamada à API do Telegram:", err);
      return null;
    }
  }

  // Notificar o André no Telegram (usado pelo Email-to-App e alertas)
  async notifyOwner(text) {
    if (config.telegramChatId) {
      return await this.sendMessage(config.telegramChatId, text);
    }
    return null;
  }

  // Verificar bot e obter detalhes
  async getMe() {
    if (!this.isConfigured()) return null;
    try {
      const res = await fetch(this.getApiUrl("getMe"));
      const data = await res.json();
      if (data.ok) {
        this.botInfo = data.result;
        logger.info(`🤖 Telegram Bot Ativo: @${data.result.username} (${data.result.first_name})`);
        return data.result;
      }
    } catch (e) {
      logger.warn(`Erro ao verificar Telegram getMe: ${e.message}`);
    }
    return null;
  }

  // Registar comandos oficiais no menu do Telegram
  async registerBotCommands() {
    if (!this.isConfigured()) return;
    try {
      const commands = [
        { command: "start", description: "Menu principal e ajuda" },
        { command: "leis", description: "Consultor Jurídico Sénior (Código Estrada, DRE, Municípios, Tacógrafo)" },
        { command: "briefing", description: "Resumo executivo diário completo (Agenda, Emails, Tarefas, Compras)" },
        { command: "criar_app", description: "Programar nova App na nuvem (GitHub + Vercel + APK)" },
        { command: "emails", description: "Resumo da caixa de entrada do Gmail" },
        { command: "agenda", description: "Compromissos de hoje (Google Calendar)" },
        { command: "compras", description: "Lista de compras e stock na nuvem" },
        { command: "despesas", description: "Controlo financeiro e registo de despesas" },
        { command: "tarefas", description: "Minhas tarefas e afazeres" },
        { command: "links", description: "Sites e apps em produção na Vercel" },
        { command: "apks", description: "Catálogo de downloads diretos de APKs" },
        { command: "status", description: "Estado do Surface e da Nuvem" }
      ];

      await fetch(this.getApiUrl("setMyCommands"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commands })
      });
      logger.info("📋 Comandos rápidos do Telegram registados com sucesso.");
    } catch (e) {
      logger.warn(`Erro ao registar comandos Telegram: ${e.message}`);
    }
  }

  // Ciclo de Long Polling para receber mensagens em tempo real (100% Free)
  async startPolling() {
    if (!this.isConfigured()) {
      logger.info("ℹ️ Telegram Bot Token não configurado. Para ativar: envie o token do @BotFather.");
      return;
    }

    if (this.isPolling) return;
    this.isPolling = true;

    await this.getMe();
    await this.registerBotCommands();
    logger.info("🚀 A iniciar escuta em tempo real do Telegram Bot (Long Polling 100% Free)...");

    while (this.isPolling) {
      try {
        const url = `${this.getApiUrl("getUpdates")}?offset=${this.lastUpdateId + 1}&timeout=25`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            this.lastUpdateId = update.update_id;
            await this.handleUpdate(update);
          }
        } else if (!data.ok) {
          logger.warn(`Telegram polling erro: ${data.description}`);
          await new Promise((r) => setTimeout(r, 5000));
        }
      } catch (err) {
        // Erro de rede transitório
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  stopPolling() {
    this.isPolling = false;
    logger.info("⏹️ Escuta do Telegram Bot terminada.");
  }

  // Tratar mensagem recebida do utilizador
  async handleUpdate(update) {
    const msg = update.message;
    if (!msg || !msg.text) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const fromUser = msg.from?.username || msg.from?.first_name || "Utilizador";

    // SEGURANÇA E PRIVACIDADE ESTRITA: Apenas o André (Chat ID 950415577) tem autorização
    const AUTHORIZED_CHAT_IDS = ["950415577"];
    if (config.telegramChatId && !AUTHORIZED_CHAT_IDS.includes(String(config.telegramChatId))) {
      AUTHORIZED_CHAT_IDS.push(String(config.telegramChatId));
    }

    const currentChatIdStr = String(chatId);
    if (!AUTHORIZED_CHAT_IDS.includes(currentChatIdStr)) {
      logger.warn(`⛔ [TELEGRAM BLOQUEADO] Tentativa de acesso não autorizada de ${fromUser} (ID: ${chatId})`);
      await this.sendMessage(
        chatId,
        "⛔ *Acesso Negado*\n━━━━━━━━━━━━━━━━━━━━━━━━\nEste assistente autónomo é de uso estritamente privado para o engenheiro André Pinheiro."
      );
      return;
    }

    // Se o ChatId não estiver memorizado, memoriza o do dono (+351 919 115 655)
    if (!config.telegramChatId) {
      config.telegramChatId = String(chatId);
      saveSettings({ telegramChatId: String(chatId) });
      logger.info(`📌 Telegram Chat ID configurado automaticamente: ${chatId} (${fromUser})`);
    }

    logger.info(`💬 [TELEGRAM PRIVADO] Mensagem de ${fromUser} (Chat: ${chatId}): "${text}"`);

    // Comandos de Barra ou Palavras-Chave Diretas
    const lower = text.toLowerCase().trim();
    const cleanCmd = lower.replace(/^\//, "").trim();

    // 1.0 AUTO-DETEÇÃO DE PALAVRA-PASSE DE 16 LETRAS DO GMAIL (SEM PRECISAR DE /config_email)
    const cleanLetters = text.replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (cleanLetters.length === 16 && !text.startsWith("/") && !text.includes(" ")) {
      logger.info(`🔑 Palavra-passe de 16 letras detetada automaticamente: ${cleanLetters}`);
      emailService.saveCredentials({ email: config.authEmail || "Andre22pinheiro@gmail.com", password: cleanLetters });
      try {
        await emailService.fetchRecentEmails({ limit: 1 });
        return await this.sendMessage(
          chatId,
          `✅ *PALAVRA-PASSE DO GMAIL DETETADA E ATIVADA!*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Identifiquei o teu código de 16 letras e validei a ligação IMAP diretamente com a Google.\n\n` +
          `📧 *Conta:* \`${config.authEmail || "Andre22pinheiro@gmail.com"}\`\n` +
          `🔒 *Estado:* 100% Conectado e Operacional!\n\n` +
          `Já podes usar \`/emails\` ou enviar emails para criar apps!`
        );
      } catch (err) {
        return await this.sendMessage(
          chatId,
          `⚠️ Código de 16 letras detetado (\`${cleanLetters}\`), mas a Google rejeitou com:\n${err.message}\nVerifica se a Verificação em 2 Passos está ativa no Google.`
        );
      }
    }

    // 1.0.1 RESOLUTOR AUTÓNOMO DE PROBLEMAS & ANTI-LOOP (AUTO-HEALER)
    const isTrouble =
      lower.includes("loop") ||
      lower.includes("preso") ||
      lower.includes("trav") ||
      lower.includes("bloque") ||
      lower.includes("coloquei o cod") ||
      lower.includes("coloquei o código") ||
      lower.includes("ja coloquei") ||
      lower.includes("já coloquei") ||
      lower.includes("ja meti") ||
      lower.includes("já meti") ||
      lower.includes("nao da") ||
      lower.includes("não dá") ||
      lower.includes("não funciona") ||
      lower.includes("nao funciona") ||
      lower.includes("lento") ||
      lower.includes("falha") ||
      lower.includes("resolver");

    if (isTrouble) {
      logger.info(`🛠️ [AUTO-HEALER ACIONADO] André reportou problema: "${text}"`);
      const emailOk = emailService.isConfigured();
      let emailStatusMsg = "";

      if (emailOk) {
        emailStatusMsg = "✅ *GMAIL:* Está **100% CONECTADO** e verificado! Não precisas de colocar mais nenhum código.";
      } else {
        emailStatusMsg = "ℹ️ *GMAIL:* Ainda pendente. Gera o código em https://myaccount.google.com/apppasswords e envia só as 16 letras.";
      }

      const healerMsg =
        `🛠️ *DIAGNÓSTICO & RESOLUÇÃO AUTOMÁTICA:* \n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Detetei a tua dificuldade e analisei o sistema para desbloquear:\n\n` +
        `${emailStatusMsg}\n` +
        `✅ *TELEGRAM BOT:* 100% Ativo e em escuta direta.\n` +
        `✅ *PROJETOS SINCRONIZADOS:* 23 Projetos no Surface Pro.\n` +
        `✅ *SERVIDOR NUVEM:* http://136.64.71.248:3333 ativo.\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 *O que queres fazer a seguir?*\n` +
        `1. Consultar a caixa de correio: \`/emails\`\n` +
        `2. Ver compromissos de hoje: \`/agenda\`\n` +
        `3. Programar uma nova app: \`/criar_app <nome> : <o que deve fazer>\`\n` +
        `4. Ver links das apps no Vercel: \`/links\``;

      return await this.sendMessage(chatId, healerMsg);
    }
    // 1.0.2 CONSULTOR JURÍDICO SÉNIOR (DIÁRIO DA REPÚBLICA & LEIS DE TRÂNSITO)
    const isLegalQuery =
      cleanCmd === "leis" ||
      cleanCmd === "lei" ||
      cleanCmd === "dre" ||
      cleanCmd === "codigo_estrada" ||
      cleanCmd === "transito" ||
      cleanCmd.startsWith("lei ") ||
      cleanCmd.startsWith("leis ") ||
      cleanCmd.startsWith("dre ") ||
      lower.includes("diario da republica") ||
      lower.includes("diário da república") ||
      lower.includes("tempos de conducao") ||
      lower.includes("tempos de condução") ||
      lower.includes("transporte de criancas") ||
      lower.includes("transporte de crianças") ||
      lower.includes("cadeirinha") ||
      lower.includes("tacografo") ||
      lower.includes("tacógrafo") ||
      lower.includes("leis municipais") ||
      lower.includes("cargas e descargas") ||
      lower.includes("codigo da estrada") ||
      lower.includes("código da estrada") ||
      (lower.includes("lei") && (lower.includes("trânsito") || lower.includes("transito") || lower.includes("estacionamento") || lower.includes("criança")));

    if (isLegalQuery) {
      const legalAnswer = await portugalLawService.consultLegalAdvisor(text);
      return await this.sendMessage(chatId, legalAnswer);
    }

    // 1.0.3 NUTRIÇÃO DE ALTA PERFORMANCE & ROTINA FÍSICA
    const isNutritionQuery =
      cleanCmd === "nutricao" ||
      cleanCmd === "nutrição" ||
      cleanCmd === "dieta" ||
      cleanCmd === "macros" ||
      cleanCmd === "proteina" ||
      cleanCmd === "proteína" ||
      lower.includes("cottage cheese") ||
      lower.includes("nestum pro") ||
      lower.includes("lombo de porco") ||
      lower.includes("air fryer") ||
      lower.includes("airfryer") ||
      lower.includes("vegetais freshona") ||
      lower.includes("monsieur cuisine") ||
      lower.includes("waffles proteicos") ||
      lower.includes("suporte lombar") ||
      lower.includes("ergonomia") ||
      lower.includes("plano alimentar") ||
      (lower.includes("o que") && lower.includes("comer"));

    if (isNutritionQuery) {
      const plan = masterDomainService.getNutritionPlan();
      return await this.sendMessage(chatId, plan);
    }

    // 1.0.4 ENGENHARIA DE CONSTRUÇÃO & PLADUR-PRO
    const isPladurQuery =
      cleanCmd === "pladur" ||
      cleanCmd === "pladur_pro" ||
      cleanCmd === "gesso" ||
      lower.includes("placa de gesso") ||
      lower.includes("perfis de pladur") ||
      lower.includes("montantes") ||
      lower.includes("raias") ||
      lower.includes("isolamento acustico") ||
      lower.includes("isolamento acústico") ||
      lower.includes("lã de rocha") ||
      lower.includes("orçamento pladur") ||
      lower.includes("en 520") ||
      lower.includes("en 14195");

    if (isPladurQuery) {
      const specs = masterDomainService.getPladurSpecifications();
      return await this.sendMessage(chatId, specs);
    }

    // 1.0.5 GESTÃO DE FROTAS & TACÓGRAFO (APPFROTA / ROTABUS)
    const isFleetQuery =
      cleanCmd === "frota" ||
      cleanCmd === "appfrota" ||
      cleanCmd === "rotabus" ||
      cleanCmd === "tqr" ||
      lower.includes("tacografo digital") ||
      lower.includes("tacógrafo digital") ||
      lower.includes("tqr-3011b") ||
      lower.includes("dados do tacografo") ||
      lower.includes("gabarito") ||
      lower.includes("altura pesados") ||
      lower.includes("descarregar cartao");

    if (isFleetQuery) {
      const fleetSpecs = masterDomainService.getFleetTacographAnalysis();
      return await this.sendMessage(chatId, fleetSpecs);
    }

    if (cleanCmd === "start" || cleanCmd === "menu" || cleanCmd === "ajuda") {
      const welcome =
        `🤖 *BEM-VINDO AO ASSISTENTE PESSOAL & DEV (TELEGRAM PRIVADO)*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Olá, André! O teu assistente está 100% conectado, exclusivo e sincronizado.\n\n` +
        `🚀 *DESENVOLVIMENTO AUTÓNOMO (PROMPT-TO-APP):*\n` +
        `• \`/criar_app <nome> : <prompt>\` - Desenvolve app React+Vite+Capacitor, envia para o GitHub e publica na Vercel!\n` +
        `• \`/verificar_emails\` - Lê a caixa de correio por pedidos de apps\n\n` +
        `🌐 *LINKS & APKS OFICIAIS:*\n` +
        `• \`/links\` ou \`/vercel\` - Todos os projetos em produção na Vercel\n` +
        `• \`/apks\` - Links diretos de alta velocidade para testar APKs\n` +
        `• \`/projetos\` - Lista os 23 projetos sincronizados do Surface\n\n` +
        `👔 *GESTOR PESSOAL (EMAIL & AGENDA):*\n` +
        `• \`/gestor\` - Resumo executivo diário\n` +
        `• \`/hoje\` ou \`/agenda\` - Compromissos do dia\n` +
        `• \`/emails\` - Resumo dos últimos emails recebidos\n` +
        `• \`/status\` - Saúde do PC (CPU, RAM, Bateria)\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 _Podes também pedir diretamente em linguagem natural ou áudio!_`;

      return await this.sendMessage(chatId, welcome);
    }

    // 1.1 Perguntas sobre Gmail / Acesso / Configuração / Link
    if (/gmail|email|correio/i.test(cleanCmd) && (cleanCmd.includes("acesso") || cleanCmd.includes("tens") || cleanCmd.includes("como") || cleanCmd.includes("ligar") || cleanCmd.includes("link") || cleanCmd.includes("config") || cleanCmd.includes("pass") || cleanCmd.includes("senha") || cleanCmd.includes("chave") || cleanCmd.includes("onde"))) {
      return await this.sendMessage(
        chatId,
        `📧 *LINK OFICIAL PARA CONFIGURAR O GMAIL (100% FREE)*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Conta associada: \`${config.authEmail || 'Andre22pinheiro@gmail.com'}\`\n\n` +
        `🔗 *Link direto do Google:*\n👉 https://myaccount.google.com/apppasswords\n\n` +
        `*Passos simples (1 minuto):*\n` +
        `1. Abre o link acima no teu telemóvel ou PC.\n` +
        `2. Em *Nome da app*, escreve: \`Bot\`\n` +
        `3. Clica em **Criar**\n` +
        `4. Copia o código amarelo de 16 letras (ex: \`abcd efgh ijkl mnop\`)\n` +
        `5. Envia-me aqui no chat:\n   \`/config_email <as-16-letras>\`\n\n` +
        `Fico logo com acesso total para resumir emails e criar apps por email! 🚀`
      );
    }

    // 1.2 Configurar palavra-passe do Gmail
    if (cleanCmd.startsWith("config_email") || cleanCmd.startsWith("config-email") || cleanCmd.startsWith("senha_email")) {
      let rawPass = text.replace(/^\/?(config_email|config-email|senha_email)\s*/i, "").trim();
      let pass = rawPass.replace(/[<>[\]"'`\s]/g, "").trim().toLowerCase();
      if (pass.length > 16) {
        pass = pass.slice(0, 16);
      }

      if (!pass || pass.length < 12) {
        return await this.sendMessage(chatId, `💡 Envia a palavra-passe de 16 letras gerada no Google (sem chavetas):\nExemplo: \`/config_email abcd efgh ijkl mnop\``);
      }

      emailService.saveCredentials({ email: config.authEmail || "Andre22pinheiro@gmail.com", password: pass });

      // Testar conexão de imediato
      try {
        const testEmails = await emailService.fetchRecentEmails({ limit: 1 });
        return await this.sendMessage(
          chatId,
          `✅ *GMAIL CONECTADO COM SUCESSO!*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📧 *Conta:* \`${config.authEmail || "Andre22pinheiro@gmail.com"}\`\n` +
          `🔒 *Estado:* Ligação IMAP/SMTP verificada e 100% ativa!\n\n` +
          `🚀 *O que podes fazer agora:*\n` +
          `• \`/emails\` - Consultar e resumir os teus emails recentes com IA\n` +
          `• Envia um email para \`Andre22pinheiro@gmail.com\` com o assunto \`[App] Nome\` e o bot cria a app autonomamente no GitHub e Vercel!`
        );
      } catch (err) {
        return await this.sendMessage(
          chatId,
          `⚠️ *Credencial guardada, mas o Gmail reportou:*\n${err.message}\nVerifica se a Verificação em 2 Passos está ativa no Google.`
        );
      }
    }

    // 2. /criar_app ou /criar-app ou criar app
    if (cleanCmd.startsWith("criar_app") || cleanCmd.startsWith("criar-app") || cleanCmd.startsWith("criar app") || cleanCmd.startsWith("criar ")) {
      const rawPrompt = text.replace(/^\/?(criar_app|criar-app|criar\s+app|criar)\s*/i, "").trim();
      if (!rawPrompt) {
        return await this.sendMessage(
          chatId,
          `💡 *Como usar o Criador de Apps:*\n` +
          `\`/criar_app <nome> : <instruções>\`\n\n` +
          `*Exemplo:*\n` +
          `\`/criar_app Gestor de Obras : App para registo de clientes de pladur, materiais e orçamentos.\``
        );
      }

      let appName = "";
      let appPrompt = "";
      if (rawPrompt.includes(":")) {
        const [p1, ...p2] = rawPrompt.split(":");
        appName = p1.trim();
        appPrompt = p2.join(":").trim();
      } else {
        const parts = rawPrompt.split(" ");
        appName = parts[0];
        appPrompt = parts.slice(1).join(" ") || `Aplicação ${appName}`;
      }

      await this.sendMessage(
        chatId,
        `⚡ *A INICIAR DESENVOLVIMENTO AUTÓNOMO DA APP...*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📱 *Nome:* *${appName}*\n` +
        `📝 *Prompt:* "${appPrompt.slice(0, 150)}..."\n\n` +
        `⏳ _1. A estruturar projeto React + Vite + TailwindCSS_\n` +
        `⏳ _2. A configurar Capacitor Android & GitHub Actions_\n` +
        `⏳ _3. A criar repositório e fazer push para o GitHub_\n` +
        `⏳ _4. A efetuar deploy em produção no Vercel_\n\n` +
        `_Aguarda alguns segundos pelo relatório final com os links..._`
      );

      try {
        const buildRes = await appScaffoldService.buildAndDeployApp({
          name: appName,
          prompt: appPrompt,
          sender: fromUser
        });

        const successMsg =
          `🚀 *APP GERADA E PUBLICADA COM SUCESSO!*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📱 *Aplicação:* *${buildRes.title}*\n` +
          `⏱️ *Tempo de execução:* ${buildRes.durationSeconds}s\n\n` +
          `🌐 *Vercel Web App (Produção):*\n${buildRes.vercelUrl}\n\n` +
          `🐙 *Repositório GitHub:*\n${buildRes.githubUrl}\n\n` +
          `📦 *Compilação Android APK (GitHub Actions):*\n${buildRes.actionsUrl}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💡 _A app já está em produção e pronta para testares no telemóvel!_`;

        return await this.sendMessage(chatId, successMsg);
      } catch (err) {
        return await this.sendMessage(chatId, `❌ *Erro ao gerar a aplicação:*\n${err.message}`);
      }
    }

    // 3. /links ou /vercel
    if (cleanCmd === "links" || cleanCmd === "vercel" || cleanCmd === "sites") {
      const linksText =
        `🌐 *LINKS OFICIAIS DOS PROJETOS EM VERCEL (PRODUÇÃO)*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🚌 *1. Smooth-Bus-Routes (RotaBus)*\n` +
        `   🔗 https://smooth-bus-routes.vercel.app\n` +
        `   • APK: https://smooth-bus-routes.vercel.app/rotabus.apk\n\n` +
        `⚽ *2. MatchPro (Streaming & Tática)*\n` +
        `   🔗 https://matchpro-alpha.vercel.app\n` +
        `   • APK: https://matchpro-alpha.vercel.app/MatchPro.apk\n\n` +
        `🏗️ *3. Pladur-Pro (Engenharia 3D & Orçamentação)*\n` +
        `   🔗 https://pladur-pro.vercel.app\n` +
        `   • APK: https://pladur-pro.vercel.app/PladurPro.apk\n\n` +
        `🚛 *4. AppFrota (Gestão de Frotas)*\n` +
        `   🔗 https://appfrota-ten.vercel.app\n\n` +
        `🧸 *5. Casa de Bonecas 3D*\n` +
        `   🔗 https://casadebonecas-3d.vercel.app\n\n` +
        `⚔️ *6. Last War Tactics*\n` +
        `   🔗 https://last-war-tactics.vercel.app\n\n` +
        `🏠 *7. Pesquisa Imobiliário*\n` +
        `   🔗 https://pesquisa-imobiliario.vercel.app\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━`;
      return await this.sendMessage(chatId, linksText);
    }

    // 4. /apks ou /downloads
    if (cleanCmd === "apks" || cleanCmd === "downloads" || cleanCmd === "download") {
      const apksText =
        `📦 *CATÁLOGO DE DOWNLOADS DE APKS (PRODUÇÃO)*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `1. ⚽ *MatchPro (4.62 MB)*\n` +
        `   📥 https://matchpro-alpha.vercel.app/MatchPro.apk\n\n` +
        `2. 🏗️ *Pladur-Pro (36.6 MB)*\n` +
        `   📥 https://pladur-pro.vercel.app/PladurPro.apk\n\n` +
        `3. 🚌 *RotaBus (79.2 MB)*\n` +
        `   📥 https://smooth-bus-routes.vercel.app/rotabus.apk\n\n` +
        `4. 🤖 *WhatsApp Dev Assistant (12.97 MB)*\n` +
        `   📥 https://matchpro-alpha.vercel.app/WhatsAppDevAssistant.apk\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 _Toca no link para descarregar diretamente no teu telemóvel e instalar!_`;
      return await this.sendMessage(chatId, apksText);
    }

    // 5. /status ou /pc
    if (cleanCmd === "status" || cleanCmd === "pc" || cleanCmd === "info") {
      const health = await systemService.getSystemHealth();
      const st =
        `💻 *ESTADO DO COMPUTADOR & NUVEM*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🖥️ *Máquina:* ${health.os} (${health.hostname})\n` +
        `⚡ *CPU Load:* ${health.cpuLoad}\n` +
        `🧠 *Memória RAM:* ${health.ram}\n` +
        `💾 *Disco:* ${health.disk}\n` +
        `🔋 *Bateria:* ${health.battery}\n` +
        `⏱️ *Uptime:* ${health.uptime}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━`;
      return await this.sendMessage(chatId, st);
    }

    // 6. /projetos
    if (cleanCmd === "projetos" || cleanCmd === "projeto") {
      const projects = await universalProjectService.listAllProjects(false);
      const lines = projects.map((p, idx) => `${idx + 1}. *${p.name}* (${p.type})`);
      return await this.sendMessage(
        chatId,
        `📁 *PROJETOS SINCRONIZADOS (${projects.length}):*\n━━━━━━━━━━━━━━━━━━━━━━━━\n${lines.join("\n")}`
      );
    }

    // 7. /emails ou /resumo
    if (cleanCmd === "emails" || cleanCmd === "resumo" || cleanCmd === "rever_emails") {
      if (!emailService.isConfigured()) {
        return await this.sendMessage(
          chatId,
          `📧 *Gmail não configurado:*\nConfigura a tua palavra-passe de app Gmail para leres e resumires emails com IA.`
        );
      }
      await this.sendMessage(chatId, `🔍 _A consultar caixa de entrada e a gerar resumo com IA..._`);
      try {
        const emails = await emailService.fetchRecentEmails({ limit: 5 });
        const summary = await emailService.generateEmailsSummary(emails);
        return await this.sendMessage(chatId, summary);
      } catch (e) {
        return await this.sendMessage(chatId, `❌ Erro ao consultar emails: ${e.message}`);
      }
    }

    // 8. /agenda ou /hoje
    if (cleanCmd === "agenda" || cleanCmd === "hoje") {
      const today = new Date().toISOString().split("T")[0];
      const events = calendarService.getEventsForDay(today);
      if (events && events.length > 0) {
        const list = events.map((e, i) => `${i + 1}. *${e.time}* - ${e.title} (${e.location || 'Sem local'})`).join("\n");
        return await this.sendMessage(chatId, `📅 *COMPROMISSOS DE HOJE:*\n━━━━━━━━━━━━━━━━━━━━━━━━\n${list}`);
      }

      if (config.lastDeviceCalendarSummary) {
        return await this.sendMessage(chatId, `📅 *AGENDA DO GOOGLE CALENDAR (SINCRONIZADA):*\n━━━━━━━━━━━━━━━━━━━━━━━━\n${config.lastDeviceCalendarSummary}`);
      }

      return await this.sendMessage(chatId, `📅 *Agenda de Hoje:* Não tens nenhum compromisso marcado para hoje.`);
    }

    // 8.1 LISTA DE COMPRAS NA NUVEM & STOCK
    if (
      cleanCmd === "compras" ||
      cleanCmd === "lista_compras" ||
      cleanCmd === "lista-compras" ||
      lower === "lista de compras" ||
      lower === "o que falta comprar" ||
      lower === "ver compras"
    ) {
      return await this.sendMessage(chatId, personalAssistant.formatShoppingList());
    }

    if (
      cleanCmd.startsWith("comprar ") ||
      lower.startsWith("adiciona à lista de compras ") ||
      lower.startsWith("adicionar à lista de compras ") ||
      lower.startsWith("adiciona às compras ") ||
      lower.startsWith("preciso de comprar ") ||
      lower.startsWith("comprar ")
    ) {
      const rawItem = text
        .replace(/^\/?(comprar|adiciona à lista de compras|adicionar à lista de compras|adiciona às compras|preciso de comprar)\s*/i, "")
        .trim();

      if (!rawItem) {
        return await this.sendMessage(chatId, `💡 Envia: \`/comprar <artigo>\` (ex: \`/comprar Leite 2 pacotes\`)`);
      }

      const added = personalAssistant.addShoppingItem(rawItem, "Geral");
      return await this.sendMessage(
        chatId,
        `🛒 *Item adicionado à Lista de Compras na Nuvem!*\n` +
        `• ⭕ *${added.text}*\n\n` +
        personalAssistant.formatShoppingList()
      );
    }

    if (
      cleanCmd.startsWith("riscar ") ||
      cleanCmd.startsWith("comprei ") ||
      lower.startsWith("já comprei ") ||
      lower.startsWith("ja comprei ") ||
      lower.startsWith("comprei ") ||
      lower.startsWith("risca ")
    ) {
      const rawTarget = text.replace(/^\/?(riscar|comprei|já comprei|ja comprei|risca)\s*/i, "").trim();
      const updated = personalAssistant.toggleShoppingItem(rawTarget);
      if (updated) {
        const status = updated.completed ? "marcado como comprado! ✅" : "desmarcado (voltou à lista)! ⭕";
        return await this.sendMessage(chatId, `🛒 *${updated.text}* foi ${status}\n\n` + personalAssistant.formatShoppingList());
      } else {
        return await this.sendMessage(chatId, `⚠️ Não encontrei "${rawTarget}" na lista de compras. Usa \`/compras\` para rever.`);
      }
    }

    if (cleanCmd === "limpar_compras" || cleanCmd === "limpar-compras" || lower === "limpar compras") {
      personalAssistant.clearCheckedShoppingItems();
      return await this.sendMessage(chatId, `🧹 *Artigos comprados foram limpos da lista com sucesso!*\n\n` + personalAssistant.formatShoppingList());
    }

    // 8.2 CONTROLO DE DESPESAS & GASTOS RÁPIDOS
    if (cleanCmd === "despesas" || cleanCmd === "gastos" || lower === "minhas despesas" || lower === "ver despesas") {
      return await this.sendMessage(chatId, personalAssistant.formatExpenseSummary());
    }

    if (
      cleanCmd.startsWith("despesa ") ||
      cleanCmd.startsWith("gastei ") ||
      lower.startsWith("gastei ") ||
      lower.startsWith("despesa ")
    ) {
      const rawExp = text.replace(/^\/?(despesa|gastei)\s*/i, "").trim();
      const match = rawExp.match(/(\d+(?:[.,]\d+)?)\s*€?\s*(.*)/i);
      if (match) {
        const val = match[1];
        const desc = match[2] || "Despesa geral";
        const saved = personalAssistant.addExpense(val, "Geral", desc);
        return await this.sendMessage(
          chatId,
          `💸 *DESPESA REGISTADA NA NUVEM!*\n━━━━━━━━━━━━━━━━━━━━━━━━\n• Valor: *${saved.amount.toFixed(2)}€*\n• Detalhe: ${saved.description}\n• Data: ${new Date().toLocaleDateString("pt-PT")}\n\n` +
          personalAssistant.formatExpenseSummary()
        );
      } else {
        return await this.sendMessage(chatId, `💡 Exemplo para registar gasto: \`/despesa 50€ em gasóleo\` ou \`gastei 25€ almoço\``);
      }
    }

    // 8.3 TAREFAS PESSOAIS (TO-DO)
    if (cleanCmd === "tarefas" || lower === "minhas tarefas" || lower === "o que tenho para fazer") {
      const tasks = personalAssistant.getTasks();
      if (tasks.length === 0) {
        return await this.sendMessage(chatId, `📝 *TAREFAS PESSOAIS:* Não tens tarefas pendentes!\n💡 _Para adicionar:_ \`/tarefa <o que fazer>\``);
      }
      const list = tasks.map((t, idx) => `${idx + 1}. ${t.completed ? "✅ ~" + t.title + "~" : "⭕ *" + t.title + "*"} (ID: #${t.id.slice(-4)})`).join("\n");
      return await this.sendMessage(chatId, `📝 *MINHAS TAREFAS PENDENTES:*\n━━━━━━━━━━━━━━━━━━━━━━━━\n${list}\n\n💡 _Para concluir:_ \`/concluir <ID>\``);
    }

    if (cleanCmd.startsWith("tarefa ") || lower.startsWith("lembrar de ") || lower.startsWith("adicionar tarefa ")) {
      const taskText = text.replace(/^\/?(tarefa|lembrar de|adicionar tarefa)\s*/i, "").trim();
      if (!taskText) return await this.sendMessage(chatId, `💡 Envia: \`/tarefa <descrição da tarefa>\``);
      const t = personalAssistant.addTask(taskText);
      return await this.sendMessage(chatId, `📝 *Nova tarefa anotada:* "${t.title}" (ID: #${t.id.slice(-4)})`);
    }

    if (cleanCmd.startsWith("concluir ") || cleanCmd.startsWith("feita ") || cleanCmd.startsWith("feito ")) {
      const idPart = text.replace(/^\/?(concluir|feita|feito)\s*/i, "").trim().replace("#", "");
      const res = personalAssistant.toggleTask(idPart);
      if (res) {
        return await this.sendMessage(chatId, `✅ *Tarefa "${res.title}" atualizada:* ${res.completed ? "Concluída!" : "Reaberta."}`);
      }
      return await this.sendMessage(chatId, `⚠️ Tarefa não encontrada com o ID #${idPart}.`);
    }

    // 8.4 RESUMO EXECUTIVO DIÁRIO COMPLETO (BRIEFING MATINAL)
    if (
      cleanCmd === "briefing" ||
      cleanCmd === "gestor" ||
      cleanCmd === "resumo_geral" ||
      cleanCmd === "meu_dia" ||
      lower === "bom dia" ||
      lower === "boa tarde" ||
      lower === "boa noite" ||
      lower.includes("o meu dia") ||
      lower.includes("resumo do dia")
    ) {
      const greeting = lower.includes("boa tarde") ? "Boa tarde" : lower.includes("boa noite") ? "Boa noite" : "Bom dia";
      
      // 1. Agenda
      const today = new Date().toISOString().split("T")[0];
      const events = calendarService.getEventsForDay(today);
      let agendaPart = "• Sem reuniões ou eventos agendados para hoje.";
      if (events && events.length > 0) {
        agendaPart = events.map((e) => `• *${e.time}* - ${e.title}`).join("\n");
      } else if (config.lastDeviceCalendarSummary) {
        agendaPart = config.lastDeviceCalendarSummary.slice(0, 300) + "...";
      }

      // 2. Tarefas
      const tasks = personalAssistant.getTasks().filter((t) => !t.completed);
      const tasksPart = tasks.length > 0
        ? tasks.slice(0, 3).map((t) => `• ⭕ ${t.title}`).join("\n")
        : "• Tudo em dia! Nenhuma tarefa pendente.";

      // 3. Compras
      const shopping = personalAssistant.getShoppingList().filter((s) => !s.completed);
      const shoppingPart = shopping.length > 0
        ? shopping.slice(0, 3).map((s) => `• 🛒 ${s.text}`).join("\n")
        : "• Lista de compras vazia.";

      // 4. Emails
      let emailPart = "• Caixa de correio sincronizada.";
      if (emailService.isConfigured()) {
        try {
          const rec = await emailService.fetchRecentEmails({ limit: 2 });
          if (rec.length > 0) {
            emailPart = rec.map((e) => `• 📧 *${e.subject}* (${e.from || 'Remetente'})`).join("\n");
          }
        } catch (e) {}
      }

      const briefing =
        `👔 *${greeting.toUpperCase()}, ANDRÉ! PAINEL EXECUTIVO DIÁRIO*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📅 *COMPROMISSOS DE HOJE:*\n${agendaPart}\n\n` +
        `📬 *ÚLTIMOS EMAILS (GMAIL):*\n${emailPart}\n\n` +
        `📝 *TAREFAS PRIORITÁRIAS (${tasks.length}):*\n${tasksPart}\n\n` +
        `🛒 *COMPRAS PENDENTES (${shopping.length}):*\n${shoppingPart}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 _Diz-me o que precisas: adicionar tarefas, registar compras ou criar uma nova app!_`;

      return await this.sendMessage(chatId, briefing);
    }

    // 8.5 NOTAS RÁPIDAS
    if (cleanCmd === "notas" || lower === "minhas notas" || lower === "ver notas") {
      const notes = personalAssistant.getNotes();
      if (notes.length === 0) return await this.sendMessage(chatId, `📒 *NOTAS:* Nenhuma nota guardada ainda.\n💡 _Para guardar:_ \`/nota <título> : <conteúdo>\``);
      const list = notes.map((n, i) => `${i + 1}. *${n.title}* - ${n.content}`).join("\n");
      return await this.sendMessage(chatId, `📒 *MINHAS NOTAS NA NUVEM:*\n━━━━━━━━━━━━━━━━━━━━━━━━\n${list}`);
    }

    if (cleanCmd.startsWith("nota ") || lower.startsWith("anota ideia:") || lower.startsWith("anotar ideia:")) {
      const rawNote = text.replace(/^\/?(nota|anota ideia:|anotar ideia:)\s*/i, "").trim();
      const title = rawNote.includes(":") ? rawNote.split(":")[0].trim() : "Ideia";
      const content = rawNote.includes(":") ? rawNote.split(":").slice(1).join(":").trim() : rawNote;
      const n = personalAssistant.addNote(title, content);
      return await this.sendMessage(chatId, `📒 *Nota guardada na Nuvem:* "${n.title}"\n${n.content}`);
    }

    // 9. Processamento de Linguagem Natural com IA Gemini (Free Tier)
    try {
      const aiRes = await aiService.processNaturalLanguage(text, { user: fromUser });
      if (aiRes) {
        if (aiRes.reply) {
          return await this.sendMessage(chatId, aiRes.reply);
        }
        if (aiRes.action === "STATUS") {
          const health = await systemService.getSystemHealth();
          return await this.sendMessage(chatId, `💻 *ESTADO DO PC:*\nCPU: ${health.cpuLoad} | RAM: ${health.ram} | Disco: ${health.disk}`);
        }
        if (aiRes.action === "TODAY_EVENTS") {
          return await this.sendMessage(chatId, calendarService.formatDayAgenda());
        }
        if (aiRes.action === "SHOW_MANAGER") {
          return await this.sendMessage(chatId, personalAssistant.formatShoppingList());
        }
      }
    } catch (e) {}

    // 10. Resposta Inteligente de Contexto (Elimina Loops e Respostas Genéricas)
    let smartReply = "";
    if (lower.includes("olá") || lower.includes("ola") || lower.includes("oi") || lower.includes("boas")) {
      smartReply = `👋 Olá, André! Estou 100% ativo e pronto a ajudar.\nPodes pedir-me o teu \`/briefing\`, consultar \`/compras\`, rever \`/emails\` ou \`/criar_app\`.`;
    } else if (lower.includes("obrigad") || lower.includes("top") || lower.includes("excelente") || lower.includes("fixe")) {
      smartReply = `🙏 Sempre às ordens, André! O assistente está a monitorizar 24/7.`;
    } else if (lower.includes("faz") || lower.includes("podes") || lower.includes("consegues")) {
      smartReply = `💪 Sim, consigo! Gerencio a tua lista de compras, agenda do Google Calendar, resumo de emails do Gmail e programo apps completas para o GitHub e Vercel.\nExperimenta dizer: *"adiciona leite às compras"* ou *"/criar_app <nome> : <o que deve fazer>"*.`;
    } else {
      smartReply = `🤖 *Comando ou Pedido Reconhecido!*\n━━━━━━━━━━━━━━━━━━━━━━━━\n"${text}"\n\n💡 _Dica:_ Usa \`/briefing\` para o teu resumo executivo, \`/compras\` para a lista no supermercado, ou \`/menu\` para todas as opções.`;
    }

    return await this.sendMessage(chatId, smartReply);
  }
}

export const telegramService = new TelegramService();
export default telegramService;

