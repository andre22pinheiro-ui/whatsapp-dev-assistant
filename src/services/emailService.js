import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import config, { saveSettings } from "../config.js";
import logger from "../utils/logger.js";
import { readData, writeData } from "../utils/storage.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import appScaffoldService from "./appScaffoldService.js";
import telegramService from "./telegramService.js";

class EmailService {
  constructor() {
    this.emailNotifier = null;
    this.schedulerInterval = null;
    this.seenUids = new Set();
  }

  isConfigured() {
    return Boolean(config.emailUser && config.emailPassword);
  }

  setEmailNotifier(notifier) {
    this.emailNotifier = notifier;
  }

  saveCredentials({ email, password, imapHost, smtpHost }) {
    const updates = {};
    if (email) {
      config.emailUser = email.trim();
      updates.emailUser = config.emailUser;
    }
    if (password) {
      config.emailPassword = password.trim().replace(/\s+/g, "");
      updates.emailPassword = config.emailPassword;
    }
    if (imapHost) {
      config.imapHost = imapHost.trim();
      updates.imapHost = config.imapHost;
    }
    if (smtpHost) {
      config.smtpHost = smtpHost.trim();
      updates.smtpHost = config.smtpHost;
    }
    saveSettings(updates);
    logger.info(`📧 Credenciais de email atualizadas para ${config.emailUser}`);
    return { success: true, email: config.emailUser };
  }

  getImapClient() {
    if (!this.isConfigured()) {
      throw new Error(
        "Email não configurado. Use `/config email <palavra-passe-app>` para configurar o acesso ao Gmail."
      );
    }

    return new ImapFlow({
      host: config.imapHost || "imap.gmail.com",
      port: config.imapPort || 993,
      secure: true,
      auth: {
        user: config.emailUser,
        pass: config.emailPassword
      },
      logger: false,
      emitLogs: false
    });
  }

  getSmtpTransporter() {
    if (!this.isConfigured()) {
      throw new Error(
        "Email não configurado. Use `/config email <palavra-passe-app>` para configurar o acesso ao Gmail."
      );
    }

    return nodemailer.createTransport({
      host: config.smtpHost || "smtp.gmail.com",
      port: config.smtpPort || 465,
      secure: true,
      auth: {
        user: config.emailUser,
        pass: config.emailPassword
      }
    });
  }

  // Obter emails recentes (não lidos ou gerais)
  async fetchRecentEmails({ limit = 5, unreadOnly = false, query = "" } = {}) {
    const client = this.getImapClient();
    const emails = [];

    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");

      try {
        let searchCriteria = unreadOnly ? { seen: false } : { all: true };
        if (query && query.trim()) {
          searchCriteria = {
            or: [
              { subject: query.trim() },
              { from: query.trim() },
              { body: query.trim() }
            ]
          };
        }

        const searchResult = await client.search(searchCriteria, { uid: true });
        const uids = Array.isArray(searchResult) ? searchResult : [];

        if (uids.length === 0) {
          return [];
        }

        // Obter os últimos N emails (mais recentes primeiro)
        const targetUids = uids.slice(-limit).reverse();

        for (const uid of targetUids) {
          try {
            const msg = await client.fetchOne(uid, {
              envelope: true,
              flags: true,
              uid: true,
              bodyStructure: true,
              headers: ["from", "to", "subject", "date"]
            }, { uid: true });

            if (msg && msg.envelope) {
              const env = msg.envelope;
              const senderObj = env.from?.[0] || {};
              const senderName = senderObj.name || senderObj.address || "Desconhecido";
              const senderAddr = senderObj.address || "";
              const subject = env.subject || "(Sem Assunto)";
              const isUnread = !msg.flags || !msg.flags.has("\\Seen");

              // Obter pequeno excerto
              let snippet = "";
              try {
                const downloadData = await client.download(uid, "1", { uid: true, maxBytes: 2000 });
                if (downloadData && downloadData.content) {
                  const chunks = [];
                  for await (const chunk of downloadData.content) {
                    chunks.push(chunk);
                  }
                  const rawText = Buffer.concat(chunks).toString("utf8");
                  snippet = rawText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 300).trim();
                }
              } catch (e) {
                snippet = "";
              }

              emails.push({
                uid,
                subject,
                sender: senderName,
                senderAddress: senderAddr,
                date: env.date ? new Date(env.date) : new Date(),
                dateFormatted: env.date ? new Date(env.date).toLocaleString("pt-PT") : "Recentemente",
                isUnread,
                snippet
              });
            }
          } catch (fetchErr) {
            logger.warn(`Erro ao obter email UID ${uid}: ${fetchErr.message}`);
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
      return emails;
    } catch (err) {
      logger.error("Erro na ligação IMAP:", err);
      throw err;
    }
  }

  // Obter conteúdo completo de um email específico
  async fetchEmailDetails(targetUid) {
    const client = this.getImapClient();
    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      let emailData = null;

      try {
        const msg = await client.fetchOne(targetUid, {
          envelope: true,
          flags: true,
          uid: true,
          source: true
        }, { uid: true });

        if (msg) {
          const rawSource = msg.source ? msg.source.toString("utf8") : "";
          const cleanBody = rawSource
            .replace(/Content-Type:[\s\S]*?\r?\n\r?\n/, "")
            .replace(/<[^>]*>/g, " ")
            .replace(/\r?\n\s*\r?\n/g, "\n")
            .slice(0, 5000);

          emailData = {
            uid: msg.uid,
            subject: msg.envelope.subject || "(Sem Assunto)",
            sender: msg.envelope.from?.[0]?.name || msg.envelope.from?.[0]?.address || "Desconhecido",
            senderAddress: msg.envelope.from?.[0]?.address || "",
            to: msg.envelope.to?.map((t) => t.address).join(", ") || "",
            date: msg.envelope.date ? new Date(msg.envelope.date).toLocaleString("pt-PT") : "Data desconhecida",
            body: cleanBody
          };
        }
      } finally {
        lock.release();
      }

      await client.logout();
      return emailData;
    } catch (err) {
      logger.error(`Erro ao obter detalhes do email ${targetUid}:`, err);
      throw err;
    }
  }

  // Enviar email via SMTP
  async sendEmail({ to, subject, body, text }) {
    const transporter = this.getSmtpTransporter();
    const mailOptions = {
      from: `"${config.authEmail ? 'André Pinheiro' : 'Assistente'}" <${config.emailUser}>`,
      to,
      subject: subject || "Mensagem de WhatsApp Dev Assistant",
      text: text || body || "",
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">${(body || text || "").replace(/\n/g, "<br>")}</div>`
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`✉️ Email enviado com sucesso para ${to} (ID: ${info.messageId})`);
    return {
      success: true,
      messageId: info.messageId,
      to,
      subject
    };
  }

  // Gerar resumo executivo inteligente de emails com IA Gemini
  async generateEmailsSummary(emails, filterTopic = "") {
    if (!emails || emails.length === 0) {
      return "📭 *Caixa de entrada limpa!* Não foram encontrados novos emails " + (filterTopic ? `sobre *"${filterTopic}"*.` : "não lidos.");
    }

    const emailListContext = emails.map((e, idx) => `
[Email #${idx + 1} | UID: ${e.uid}]
- Remetente: ${e.sender} <${e.senderAddress}>
- Data: ${e.dateFormatted}
- Estado: ${e.isUnread ? "NÃO LIDO" : "Lido"}
- Assunto: ${e.subject}
- Excerto: ${e.snippet || "Sem excerto de texto"}
`).join("\n");

    const apiKey = config.geminiApiKey;
    if (!apiKey) {
      // Fallback formatado sem IA
      let simpleSummary = `📬 *RESUMO DOS ÚLTIMOS EMAILS (${emails.length}):*\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      emails.forEach((e, idx) => {
        const statusIcon = e.isUnread ? "🔵 *NOVO*" : "⚪ Lido";
        simpleSummary += `${idx + 1}. ${statusIcon} *${e.sender}*\n   📌 _${e.subject}_\n   🕒 ${e.dateFormatted} • ID: \`#${e.uid}\`\n\n`;
      });
      simpleSummary += `━━━━━━━━━━━━━━━━━━━━━━━━\n💡 _Para ler um email específico: \`/ler-email <ID>\`_`;
      return simpleSummary;
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const CANDIDATE_MODELS = [
        "gemini-3.8-flash",
        "gemini-3.5-flash",
        "gemini-flash-latest"
      ];

      for (const modelName of CANDIDATE_MODELS) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: `
Você é o assistente executivo sénior do engenheiro André Pinheiro.
Sua missão é analisar os emails fornecidos e gerar um RESUMO EXECUTIVO estruturado e direto para o WhatsApp em português de Portugal.
Estrutura obrigatória:
1. 📬 Visão geral rápida (quantos emails e se há urgências).
2. 📌 Destaques por email:
   - Quem enviou & Assunto
   - Resumo claro em 1 ou 2 frases do que trata
   - ⚠️ Ações necessárias / Prazos / Valores se houver
3. 💡 Próximos passos sugeridos.
Mantenha o tom profissional, limpo e objetivo, perfeito para leitura rápida no telemóvel.
`
          });

          const prompt = `Analisa os seguintes emails recebidos ${filterTopic ? `(foco no tema: "${filterTopic}")` : ""}:\n${emailListContext}`;
          const res = await model.generateContent(prompt);
          const reply = res.response.text().trim();
          if (reply) {
            return `📬 *RESUMO EXECUTIVO DE EMAILS (${emails.length}):*\n━━━━━━━━━━━━━━━━━━━━━━━━\n${reply}\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n💡 _Para ver o email completo: \`/ler-email <UID>\`_`;
          }
        } catch (e) {
          logger.warn(`Modelo ${modelName} falhou no resumo de emails: ${e.message}`);
        }
      }
    } catch (err) {
      logger.error("Erro ao gerar resumo com IA:", err);
    }

    // Fallback formatado se a IA falhar
    let simpleSummary = `📬 *EMAILS RECEBIDOS (${emails.length}):*\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    emails.forEach((e, idx) => {
      const statusIcon = e.isUnread ? "🔵 *NOVO*" : "⚪ Lido";
      simpleSummary += `${idx + 1}. ${statusIcon} *${e.sender}*\n   📌 _${e.subject}_\n   🕒 ${e.dateFormatted} • ID: \`#${e.uid}\`\n\n`;
    });
    simpleSummary += `━━━━━━━━━━━━━━━━━━━━━━━━\n💡 _Para ler um email específico: \`/ler-email <ID>\`_`;
    return simpleSummary;
  }

  // Resumo profundo de um email específico
  async generateSingleEmailSummary(email) {
    if (!email) return "❌ Email não encontrado.";

    const apiKey = config.geminiApiKey;
    if (!apiKey) {
      return (
        `✉️ *EMAIL #${email.uid}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *De:* ${email.sender} (${email.senderAddress})\n` +
        `📌 *Assunto:* _${email.subject}_\n` +
        `🕒 *Data:* ${email.date}\n\n` +
        `📝 *Conteúdo:*\n${email.body.slice(0, 1500)}${email.body.length > 1500 ? "\n...[Truncado]" : ""}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━`
      );
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-3.8-flash",
        systemInstruction: `
Você é o assistente executivo sénior do André Pinheiro.
Analise detalhadamente este email específico e apresente:
1. 📌 Assunto e Remetente
2. 📝 Resumo conciso dos pontos principais
3. ⚠️ Prazos, compromissos ou ações exigidas
4. ✍️ Rascunho de resposta sugerida (se fizer sentido responder)
Formate em Markdown para WhatsApp em português de Portugal.
`
      });

      const prompt = `Analisa este email:\nRemetente: ${email.sender} <${email.senderAddress}>\nData: ${email.date}\nAssunto: ${email.subject}\n\nConteúdo:\n${email.body.slice(0, 4000)}`;
      const res = await model.generateContent(prompt);
      const aiText = res.response.text().trim();
      return `✉️ *ANÁLISE DO EMAIL #${email.uid}*\n━━━━━━━━━━━━━━━━━━━━━━━━\n${aiText}`;
    } catch (e) {
      return (
        `✉️ *EMAIL #${email.uid}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *De:* ${email.sender} (${email.senderAddress})\n` +
        `📌 *Assunto:* _${email.subject}_\n` +
        `🕒 *Data:* ${email.date}\n\n` +
        `📝 *Conteúdo:*\n${email.body.slice(0, 1500)}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━`
      );
    }
  }
  // -------------------------------------------------------------
  // GESTÃO DE RASCUNHOS DE EMAIL (Anotar e Rever antes de enviar)
  // -------------------------------------------------------------
  getDrafts() {
    return readData("email_drafts", []);
  }

  saveDraft({ to, subject, body }) {
    const drafts = this.getDrafts();
    const id = "draft_" + (drafts.length + 1) + "_" + Date.now().toString().slice(-4);
    const draft = {
      id,
      to: (to || "").trim(),
      subject: (subject || "Sem Assunto").trim(),
      body: (body || "").trim(),
      createdAt: new Date().toISOString(),
      createdAtFormatted: new Date().toLocaleString("pt-PT")
    };
    drafts.push(draft);
    writeData("email_drafts", drafts);
    logger.info(`📝 Rascunho de email anotado: [${id}] Para: ${draft.to}`);
    return draft;
  }

  getDraft(idOrIndex) {
    const drafts = this.getDrafts();
    if (!drafts.length) return null;
    const clean = idOrIndex.toString().trim().toLowerCase();
    const idx = parseInt(clean, 10);
    if (!isNaN(idx) && idx >= 1 && idx <= drafts.length) {
      return drafts[idx - 1];
    }
    return drafts.find((d) => d.id.toLowerCase() === clean || d.id.toLowerCase().includes(clean)) || null;
  }

  deleteDraft(idOrIndex) {
    const drafts = this.getDrafts();
    const target = this.getDraft(idOrIndex);
    if (!target) return false;
    const remaining = drafts.filter((d) => d.id !== target.id);
    writeData("email_drafts", remaining);
    return true;
  }

  async sendDraft(idOrIndex) {
    const draft = this.getDraft(idOrIndex);
    if (!draft) {
      throw new Error(`Rascunho não encontrado com a referência "${idOrIndex}".`);
    }
    if (!draft.to || !draft.to.includes("@")) {
      throw new Error(`O rascunho [${draft.id}] não tem um endereço de destinatário válido (${draft.to}).`);
    }
    const result = await this.sendEmail({
      to: draft.to,
      subject: draft.subject,
      text: draft.body
    });
    this.deleteDraft(draft.id);
    return { ...result, draft };
  }

  formatDraftsList() {
    const drafts = this.getDrafts();
    if (!drafts || drafts.length === 0) {
      return (
        "📝 *RASCUNHOS DE EMAIL*\n" +
        "━━━━━━━━━━━━━━━━━━━━━━━━\n" +
        "Nenhum rascunho de email guardado no momento.\n\n" +
        "💡 _Para anotar um rascunho para rever mais tarde:_\n" +
        "`/anotar-email cliente@empresa.pt Orçamento Obra : Olá, envio os valores acordados.`"
      );
    }
    let text = `📝 *OS TEUS RASCUNHOS DE EMAIL ANOTADOS (${drafts.length}):*\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    drafts.forEach((d, i) => {
      text += `${i + 1}. *[${d.id}]*\n   📬 *Para:* ${d.to || "Sem destinatário"}\n   📌 *Assunto:* ${d.subject}\n   📝 *Mensagem:* "${d.body.slice(0, 120)}${d.body.length > 120 ? "..." : ""}"\n   🕒 _${d.createdAtFormatted}_\n\n`;
    });
    text +=
      "━━━━━━━━━━━━━━━━━━━━━━━━\n" +
      "💡 _Para enviar agora:_ `/enviar-rascunho 1` ou `/enviar-rascunho <id>`\n" +
      "💡 _Para apagar:_ `/apagar-rascunho 1`";
    return text;
  }

  // -------------------------------------------------------------
  // PIPELINE AUTÓNOMA: EMAIL-TO-APP (Ler Prompt de Email e Desenvolver)
  // -------------------------------------------------------------
  async checkAppPromptEmails() {
    if (!this.isConfigured()) {
      return { checked: false, reason: "Email não configurado." };
    }

    logger.info("📬 A verificar caixa de correio à procura de prompts para criação de Apps...");
    const client = this.getImapClient();
    const processedApps = [];

    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");

      try {
        // Pesquisar emails não lidos
        const searchResult = await client.search({ seen: false }, { uid: true });
        const uids = Array.isArray(searchResult) ? searchResult : [];

        if (uids.length === 0) {
          return { checked: true, found: 0, processedApps: [] };
        }

        for (const uid of uids) {
          try {
            const msg = await client.fetchOne(uid, {
              envelope: true,
              flags: true,
              uid: true,
              source: true
            }, { uid: true });

            if (!msg || !msg.envelope) continue;

            const subject = (msg.envelope.subject || "").trim();
            const senderObj = msg.envelope.from?.[0] || {};
            const senderName = senderObj.name || senderObj.address || "André Pinheiro";
            const senderEmail = senderObj.address || config.authEmail || "Andre22pinheiro@gmail.com";

            // Padrões de deteção no assunto ou corpo
            // Ex: "[App] Gestor de Clientes", "Criar App: Rota Bus", "Projeto: Gestão de Obra"
            const appRegex = /^(?:\[app\]|criar\s+app|nova\s+app|desenvolver\s+app|projeto)\s*[:\-]?\s*(.+)/i;
            const match = subject.match(appRegex);

            let appName = "";
            let promptText = "";

            if (match) {
              appName = match[1].trim();
            }

            // Ler o corpo do email
            let bodyText = "";
            if (msg.source) {
              const raw = msg.source.toString("utf8");
              bodyText = raw
                .replace(/Content-Type:[\s\S]*?\r?\n\r?\n/, "")
                .replace(/<[^>]*>/g, " ")
                .replace(/\r?\n\s*\r?\n/g, "\n")
                .trim();
            }

            // Se o assunto não tinha prefixo explícito, verificar se o corpo começa com "Criar app:"
            if (!appName) {
              const bodyMatch = bodyText.match(/^(?:criar\s+app|nova\s+app|desenvolver\s+app)\s*[:\-]?\s*([^\n\r]+)/i);
              if (bodyMatch) {
                appName = bodyMatch[1].trim();
              }
            }

            // Se detetámos uma ordem de criação de App
            if (appName) {
              promptText = bodyText || subject;
              logger.info(`✨ [EMAIL-TO-APP] Novo prompt detetado no email UID #${uid}: "${appName}"`);

              // Marcar imediatamente como lido para não reprocessar
              await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });

              // 1. Notificar WhatsApp e Telegram que a ordem foi recebida
              const startNotice =
                `📨 *PROMPT DE APP RECEBIDO POR EMAIL!*\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `👤 *Remetente:* ${senderName} (${senderEmail})\n` +
                `📌 *Aplicação:* *${appName}*\n` +
                `📝 *Instruções:* "${promptText.slice(0, 180)}${promptText.length > 180 ? '...' : ''}"\n\n` +
                `⚡ _A pipeline autónoma está a gerar a aplicação (React + Vite + Tailwind + Capacitor), a criar o repositório GitHub e a publicar na nuvem (Vercel)..._`;

              if (this.emailNotifier && typeof this.emailNotifier === "function") {
                await this.emailNotifier(startNotice);
              }
              await telegramService.notifyOwner(startNotice);

              // 2. Executar pipeline autónoma
              const buildRes = await appScaffoldService.buildAndDeployApp({
                name: appName,
                prompt: promptText,
                sender: senderEmail
              });

              // 3. Responder por email com os links
              const emailReplySubject = `Re: [App Concluída] ${buildRes.title} - Links de Produção`;
              const emailReplyBody = `Olá ${senderName},\n\nA tua aplicação "${buildRes.title}" foi desenvolvida e publicada autonomamente com sucesso!\n\n` +
                `🌐 Vercel Web App (Produção): ${buildRes.vercelUrl}\n` +
                `🐙 Repositório GitHub: ${buildRes.githubUrl}\n` +
                `📦 Compilação Android (APK CI/CD): ${buildRes.actionsUrl}\n\n` +
                `Tempo de execução: ${buildRes.durationSeconds}s.\n\n` +
                `Cumprimentos,\nAssistente Autónomo de Desenvolvimento`;

              try {
                await this.sendEmail({
                  to: senderEmail,
                  subject: emailReplySubject,
                  text: emailReplyBody
                });
                logger.info(`✉️ Resposta por email enviada com sucesso para ${senderEmail}`);
              } catch (mailErr) {
                logger.warn(`Aviso ao enviar resposta por email: ${mailErr.message}`);
              }

              // 4. Notificar WhatsApp e Telegram com o resultado final
              const finishNotice =
                `🚀 *APP GERADA E PUBLICADA NA NUVEM!*\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `📱 *Aplicação:* *${buildRes.title}*\n` +
                `⏱️ *Tempo:* ${buildRes.durationSeconds} segundos\n\n` +
                `🌐 *Vercel (Web & Mobile):*\n${buildRes.vercelUrl}\n\n` +
                `🐙 *GitHub:* \n${buildRes.githubUrl}\n\n` +
                `📦 *Android APK (GitHub Actions):*\n${buildRes.actionsUrl}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `✅ _Email de confirmação enviado para ${senderEmail}._`;

              if (this.emailNotifier && typeof this.emailNotifier === "function") {
                await this.emailNotifier(finishNotice);
              }
              await telegramService.notifyOwner(finishNotice);

              processedApps.push(buildRes);
            }
          } catch (itemErr) {
            logger.error(`Erro ao processar email UID #${uid}:`, itemErr);
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
      return { checked: true, found: processedApps.length, processedApps };
    } catch (err) {
      logger.error("Erro ao verificar emails de prompts:", err);
      return { checked: false, error: err.message };
    }
  }

  // Iniciar escuta periódica de emails para desenvolvimento automático
  startEmailPoller(intervalMs = 60000) {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
    logger.info(`⏱️ Escuta periódica de emails de desenvolvimento ativa (intervalo: ${Math.round(intervalMs / 1000)}s)`);
    this.schedulerInterval = setInterval(async () => {
      try {
        if (this.isConfigured()) {
          await this.checkAppPromptEmails();
        }
      } catch (e) {
        logger.warn(`Aviso no ciclo do email poller: ${e.message}`);
      }
    }, intervalMs);
  }

  stopEmailPoller() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      logger.info("⏹️ Escuta periódica de emails parada.");
    }
  }
}

export const emailService = new EmailService();
export default emailService;

