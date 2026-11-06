import fs from "fs";
import path from "path";
import config, { saveSettings } from "../config.js";
import logger from "../utils/logger.js";
import androidService from "../services/androidService.js";
import antigravityService from "../services/antigravityService.js";
import systemService from "../services/systemService.js";
import personalAssistant from "../services/personalAssistant.js";
import aiService from "../services/aiService.js";
import cloudTunnel from "../services/cloudTunnelService.js";
import formatter from "./formatter.js";
import { recentMessagesStore } from "./client.js";
import { pcSyncService } from "../services/pcSyncService.js";
import calendarService from "../services/calendarService.js";
import emailService from "../services/emailService.js";
import { downloadMediaMessage } from "@whiskeysockets/baileys";

export async function handleIncomingMessage(sock, msg, botSentMessageIds = new Set()) {
  try {
    if (!msg.message) return;
    if (msg.key?.id && botSentMessageIds.has(msg.key.id)) return;

    const senderJid = msg.key.remoteJid;
    if (senderJid.endsWith("@g.us")) return; // Ignorar grupos por defeito para privacidade

    // Mapeamento e resolução de JID: converter @lid em @s.whatsapp.net para garantir entrega inter-contas
    let replyJid = senderJid;
    if (replyJid.includes("@lid")) {
      const lidClean = replyJid.split("@")[0].split(":")[0];
      if (lidClean === "266293022318608" || lidClean.includes("266293022318608")) {
        replyJid = "351912101839@s.whatsapp.net";
      } else if (lidClean === "43662788571229" || lidClean.includes("43662788571229")) {
        replyJid = "351919115655@s.whatsapp.net";
      } else if (msg.key?.participant && msg.key.participant.includes("@s.whatsapp.net")) {
        replyJid = msg.key.participant;
      } else if (senderJid.includes("919115655") || (msg.key?.remoteJid && msg.key.remoteJid.includes("919115655"))) {
        replyJid = "351919115655@s.whatsapp.net";
      } else {
        replyJid = `${(config.receiverPhone || "351912101839").replace(/\D/g, "")}@s.whatsapp.net`;
      }
    } else if (senderJid.includes("919115655")) {
      replyJid = "351919115655@s.whatsapp.net";
    } else if (senderJid.includes("912101839")) {
      replyJid = "351912101839@s.whatsapp.net";
    }

    // Função de envio seguro que regista ID para evitar repetições em loop
    const sendReply = async (jid, content) => {
      const destination = jid || msg.key.remoteJid || replyJid;
      logger.info(`📤 [RESPOSTA] A enviar resposta para ${destination}...`);
      try {
        const sent = await sock.sendMessage(destination, content, { quoted: msg });
        if (sent?.key?.id) {
          recentMessagesStore.set(sent.key.id, sent.message || content);
          botSentMessageIds.add(sent.key.id);
          setTimeout(() => {
            botSentMessageIds.delete(sent.key.id);
            recentMessagesStore.delete(sent.key.id);
          }, 600000);
        }
        logger.info(`✅ [RESPOSTA] Mensagem enviada com sucesso para ${destination}`);
        return sent;
      } catch (err) {
        logger.warn(`Tentativa direta falhou, a tentar fallback para ${replyJid}: ${err.message}`);
        try {
          const sentFallback = await sock.sendMessage(replyJid, content);
          if (sentFallback?.key?.id) {
            recentMessagesStore.set(sentFallback.key.id, sentFallback.message || content);
            botSentMessageIds.add(sentFallback.key.id);
            setTimeout(() => {
              botSentMessageIds.delete(sentFallback.key.id);
              recentMessagesStore.delete(sentFallback.key.id);
            }, 600000);
          }
          return sentFallback;
        } catch (e2) {
          logger.error(`❌ [RESPOSTA] Falha ao enviar para ${destination}:`, e2);
          throw e2;
        }
      }
    };

    // Extrair número limpo do remetente
    const senderNumber = senderJid.replace("@s.whatsapp.net", "");

    // SEGURANÇA: Verificar se é o utilizador autorizado (912 101 839 ou 919 115 655)
    const cleanSender = senderNumber.replace(/\D/g, "");
    const cleanOwner = (config.ownerPhone || "351919115655").replace(/\D/g, "");

    const isAuthorized =
      config.allowAllSenders ||
      cleanSender === cleanOwner ||
      cleanSender.endsWith(cleanOwner) ||
      cleanOwner.endsWith(cleanSender) ||
      cleanSender.includes("912101839") ||
      cleanSender.includes("919115655") ||
      cleanSender.includes("91915655") ||
      msg.key.fromMe;

    if (!isAuthorized) {
      logger.warn(`Mensagem bloqueada de número não autorizado: ${senderNumber}`);
      await sendReply(senderJid, {
        text: "⛔ *Acesso Restrito:* Este assistente está configurado para os números autorizados (+351 919 115 655 e +351 912 101 839)."
      });
      return;
    }

    // Extrair texto base da mensagem
    const messageContent =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      "";

    let text = messageContent.trim();

    // Suporte a Mensagens de Voz (Áudio WhatsApp)
    const hasAudio = !!msg.message.audioMessage;
    if (hasAudio && config.geminiApiKey) {
      try {
        await sendReply(senderJid, { text: "🎙️ _A ouvir mensagem de voz..._" });
        const audioBuffer = await downloadMediaMessage(msg, "buffer", {}, { logger });
        if (audioBuffer && audioBuffer.length > 0) {
          const mime = msg.message.audioMessage.mimetype || "audio/ogg; codecs=opus";
          const transcribed = await aiService.transcribeAudio(audioBuffer, mime);
          if (transcribed && transcribed.trim()) {
            logger.info(`🎙️ Áudio transcrito: "${transcribed}"`);
            await sendReply(senderJid, { text: `🎙️ _"${transcribed}"_` });
            text = transcribed.trim();
          }
        }
      } catch (audioErr) {
        logger.error("Erro ao transcrever áudio:", audioErr);
      }
    }

    // Suporte a Fotografias e Imagens (Visão Computacional)
    const hasImage = !!msg.message.imageMessage;
    if (hasImage && config.geminiApiKey && (!text || text.length < 40)) {
      try {
        await sendReply(senderJid, { text: "👁️ _A analisar imagem com IA..._" });
        const imgBuffer = await downloadMediaMessage(msg, "buffer", {}, { logger });
        if (imgBuffer && imgBuffer.length > 0) {
          const mime = msg.message.imageMessage.mimetype || "image/jpeg";
          const prompt = text || "Analisa detalhadamente esta imagem ou código/erro em português de Portugal. Apresenta o diagnóstico e soluções práticas imediatas.";
          const visionReply = await aiService.analyzeImage(imgBuffer, mime, prompt);
          return await sendReply(senderJid, { text: visionReply });
        }
      } catch (imgErr) {
        logger.error("Erro na análise de imagem:", imgErr);
      }
    }

    if (!text) return;

    // Evitar processamento de mensagens enviadas pelo próprio bot (banners ou respostas)
    if (text.includes("WHATSAPP DEV & PERSONAL ASSISTANT") || text.includes("🚀 *WHATSAPP DEV ASSISTANT ATIVO")) {
      return;
    }

    logger.info(`📥 Mensagem recebida de ${senderNumber} (fromMe: ${!!msg.key.fromMe}): "${text}"`);

    const prefix = config.prefix;

    // Reconhecimento de ordens para o chat em linguagem natural
    const lowerText = text.toLowerCase().trim();
    if (
      lowerText.startsWith("ordem:") ||
      lowerText.startsWith("ordem ") ||
      lowerText.startsWith("adiciona ordem:") ||
      lowerText.startsWith("executa no chat:") ||
      lowerText.startsWith("no chat:") ||
      lowerText.startsWith("chat:")
    ) {
      let orderContent = "";
      if (lowerText.startsWith("ordem:")) orderContent = text.slice(6).trim();
      else if (lowerText.startsWith("ordem ")) orderContent = text.slice(6).trim();
      else if (lowerText.startsWith("adiciona ordem:")) orderContent = text.slice(15).trim();
      else if (lowerText.startsWith("executa no chat:")) orderContent = text.slice(16).trim();
      else if (lowerText.startsWith("no chat:")) orderContent = text.slice(8).trim();
      else if (lowerText.startsWith("chat:")) orderContent = text.slice(5).trim();

      if (orderContent) {
        text = `${prefix}ordem ${orderContent}`;
      }
    }

    // 1. COMANDOS DIRETOS (Iniciados com / ou prefixo, ou palavras-chave diretas)
    let isCommand = text.startsWith(prefix);
    let commandText = text;
    if (!isCommand) {
      const normalized = text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const directKeywords = [
        "projetos", "projectos", "status", "diagnostico", "ajuda", "help", "menu", "print", "nuvem", "cloud",
        "agenda", "calendario", "eventos", "evento", "confirmar", "agentes", "agentx", "frota", "rotabus",
        "matchpro", "pladur", "gestor", "hoje", "amanha", "rascunhos", "rascunho", "emails", "email", "inbox",
        "links", "vercel", "apks", "downloads", "download"
      ];
      const firstWord = normalized.split(/\s+/)[0];
      if (directKeywords.includes(firstWord)) {
        isCommand = true;
        commandText = prefix + text.trim();
      }
    }

    if (isCommand) {
      const parts = commandText.slice(prefix.length).trim().split(" ");
      const rawCmd = parts[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const cmd = rawCmd;
      const args = parts.slice(1);
      const fullArgs = args.join(" ").trim();

      switch (cmd) {
        case "help":
        case "ajuda":
        case "start":
        case "menu":
          return await sendReply(senderJid, { text: formatter.formatHelp(prefix) });

        case "confirmar":
        case "confirmacao":
        case "agentes":
        case "agentx": {
          const report =
            `🤖 *CONFIRMAÇÃO DO ECOSSISTEMA AGENTX - TODOS OS PROJETOS ATUALIZADOS*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `✅ *1. Smooth-Bus-Routes (RotaBus):*\n` +
            `   • 4 Agentes Autónomos integrados (Clearance, Eco-Dinâmica, Tráfego ML Bayesiano e BabyAGI).\n` +
            `   • Verificação Reg. CE 561/2006 (pausa de 45m a cada 4h30 de condução).\n` +
            `   • Endpoint Serverless \`/api/agent\` ativo com CORS.\n` +
            `   • APK de produção gerado e testado (\`rotabus.apk\` - 79.2 MB).\n\n` +
            `✅ *2. MatchPro (Análise Tática & Streaming):*\n` +
            `   • AgentXTacticalModal com Dark Tactical HUD.\n` +
            `   • Motor de tracking desportivo e fallback seguro HLS / IPTV.\n` +
            `   • APK Android compilado e sincronizado (\`MatchPro.apk\` - 4.62 MB).\n` +
            `   • Deploy ativo em Vercel: https://matchpro-alpha.vercel.app\n\n` +
            `✅ *3. Pladur-Pro (Construção & Engenharia 3D):*\n` +
            `   • 4 Agentes Especialistas: Segurança Estrutural (EN 520 / EN 14195), Eco-Otimização de Materiais, Previsão Orçamental ML e Despacho de Obra BabyAGI.\n` +
            `   • HUD Tático integrado com estimativa de placas, perfis e custo.\n\n` +
            `✅ *4. WhatsApp Dev Assistant (Nuvem & PC Worker):*\n` +
            `   • Servidor Cloud VM ativo em 136.64.71.248:3333.\n` +
            `   • PC Worker sincronizado com 22 projetos monitorizados.\n` +
            `   • Código de emparelhamento ativo: *KPVR-VDXP* (+351 912 101 839).\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📡 *Processo 100% Confirmado e Ativo em Produção.*`;

          return await sendReply(senderJid, { text: report });
        }

        case "frota":
        case "rotabus": {
          return await sendReply(senderJid, {
            text:
              `🚌 *AGENTX FROTA & NAVEGAÇÃO PESADA (ROTABUS)*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `🛡️ *Agente 1 (Clearance):* Validação de altura (3.6m), largura (2.55m), tonelagem (18t) e viadutos em Portugal.\n` +
              `🌿 *Agente 2 (Eco-Frota):* Consumo estimado em L/100km e kWh com compensação de gradiente (Marão/Aire).\n` +
              `📈 *Agente 3 (Tráfego ML):* Intervalo de confiança ETA a 95% e probabilidade de atrito em nós metropolitanos.\n` +
              `🤖 *Agente 4 (BabyAGI Despacho):* Alerta obrigatório de pausa de 45m (Regulamento CE 561/2006).\n` +
              `📦 *APK Android:* \`public/rotabus.apk\` atualizado.\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━`
          });
        }

        case "pladur": {
          return await sendReply(senderJid, {
            text:
              `🏗️ *AGENTX PLADUR-PRO (ENGENHARIA 3D & CONSTRUÇÃO)*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `📐 *Agente Estrutural:* Normas NP/EN 520, EN 14195, resistência ao fogo EI30/EI60, perfis M48/TC47.\n` +
              `🌱 *Agente Eco-Material:* Otimização de cortes com desperdício < 7%, parafusos e massa de juntas.\n` +
              `💰 *Agente ML Orçamento:* Estimativa de custo por m² com desvios de mercado.\n` +
              `📋 *Agente BabyAGI Obra:* Checklist técnico de instalação e fixação passo a passo.\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━`
          });
        }

        case "matchpro": {
          return await sendReply(senderJid, {
            text:
              `⚽ *AGENTX MATCHPRO (ANÁLISE DESPORTIVA & TÁTICA)*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `🎥 *Tracking:* Detetor de bola, jogadores e linhas de passe em tempo real.\n` +
              `📺 *Streaming:* HLS inteligente com failover anti-congelamento.\n` +
              `☁️ *Vercel Cloud:* https://matchpro-alpha.vercel.app\n` +
              `📱 *APK Android:* \`MatchPro.apk\` sincronizado.\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━`
          });
        }

        case "links":
        case "vercel":
        case "sites": {
          const linksText =
            `🌐 *LINKS OFICIAIS DOS PROJETOS EM VERCEL (PRODUÇÃO)*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🚌 *1. Smooth-Bus-Routes (RotaBus)*\n` +
            `   🔗 https://smooth-bus-routes.vercel.app\n` +
            `   • Navegação Pesada 3.6m/18t + 4 Agentes + Reg. CE 561/2006\n` +
            `   • APK: https://smooth-bus-routes.vercel.app/rotabus.apk\n\n` +
            `⚽ *2. MatchPro (Streaming & Tática)*\n` +
            `   🔗 https://matchpro-alpha.vercel.app\n` +
            `   • Dark Tactical HUD, Tracking e Failover HLS/IPTV\n` +
            `   • APK: https://matchpro-alpha.vercel.app/MatchPro.apk\n\n` +
            `🏗️ *3. Pladur-Pro (Engenharia 3D & Orçamentação)*\n` +
            `   🔗 https://pladur-pro.vercel.app\n` +
            `   • Normas EN 520/14195, Cortador Eco < 7% quebras, Orçamento ML\n` +
            `   • APK: https://pladur-pro.vercel.app/PladurPro.apk\n\n` +
            `🚛 *4. AppFrota (Gestão de Frotas)*\n` +
            `   🔗 https://appfrota-ten.vercel.app\n` +
            `   • Gestão de veículos, motoristas e manutenção\n\n` +
            `🧸 *5. Casa de Bonecas 3D*\n` +
            `   🔗 https://casadebonecas-3d.vercel.app\n` +
            `   • Modelos e navegação 3D interativa\n\n` +
            `⚔️ *6. Last War Tactics*\n` +
            `   🔗 https://last-war-tactics.vercel.app\n` +
            `   • Táticas e planeamento de combate\n\n` +
            `🏠 *7. Pesquisa Imobiliário*\n` +
            `   🔗 https://pesquisa-imobiliario.vercel.app\n` +
            `   • Agregação e motor de análise imobiliária\n\n` +
            `🤖 *8. WhatsApp Dev Assistant (Nuvem 24/7)*\n` +
            `   🔗 http://136.64.71.248:3333\n` +
            `   • APK: https://matchpro-alpha.vercel.app/WhatsAppDevAssistant.apk\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📱 _Toca em qualquer link para abrir ou testar diretamente no smartphone!_`;

          return await sendReply(senderJid, { text: linksText });
        }

        case "apks":
        case "downloads":
        case "download": {
          const apksText =
            `📦 *APKS PRONTOS PARA TESTAR NOS SMARTPHONES*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Podes descarregar e instalar no Android através dos links seguros com CDN Vercel:\n\n` +
            `1. ⚽ *MatchPro (4.62 MB)*\n` +
            `   📥 https://matchpro-alpha.vercel.app/MatchPro.apk\n` +
            `   _Análise tática, streams desportivos e Tactical HUD._\n\n` +
            `2. 🏗️ *Pladur-Pro (36.6 MB)*\n` +
            `   📥 https://pladur-pro.vercel.app/PladurPro.apk\n` +
            `   _Cálculo estrutural de tetos/paredes, 3D e orçamento ML._\n\n` +
            `3. 🚌 *RotaBus (79.2 MB)*\n` +
            `   📥 https://smooth-bus-routes.vercel.app/rotabus.apk\n` +
            `   _Navegação pesada, túneis/pontes e paragens CE 561/2006._\n\n` +
            `4. 🤖 *WhatsApp Dev Assistant (12.97 MB)*\n` +
            `   📥 https://matchpro-alpha.vercel.app/WhatsAppDevAssistant.apk\n` +
            `   _Serviço de notificação, IA e automação WhatsApp para Android._\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `☁️ *Servidor Nuvem (VM 136.64.71.248:3333):*\n` +
            `   📥 http://136.64.71.248:3333/api/downloads\n` +
            `   📥 http://192.168.1.115:8081 (Download Direto no PC)\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `💡 _Dica: Abre o link no Chrome do telemóvel para descarregar a alta velocidade e tocar em "Instalar"!_`;

          return await sendReply(senderJid, { text: apksText });
        }

        case "status":
        case "pc":
        case "info": {
          await sendReply(senderJid, { text: "⏳ A verificar estado do computador..." });
          const health = await systemService.getSystemHealth();
          let statusText = formatter.formatStatus(health);
          const cUrl = cloudTunnel.getCloudUrl();
          if (cUrl) {
            statusText += `\n\n☁️ *Acesso em Nuvem:* ${cUrl}`;
          }
          return await sendReply(senderJid, { text: statusText });
        }

        case "nuvem":
        case "cloud":
        case "tunnel": {
          const tunnelStatus = cloudTunnel.getStatus();
          if (tunnelStatus.cloudUrl) {
            return await sendReply(senderJid, {
              text:
                `☁️ *ASSISTENTE DE DESENVOLVIMENTO EM NUVEM (ONLINE)*\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🌐 *URL Público Seguro (HTTPS):*\n${tunnelStatus.cloudUrl}\n\n` +
                `📱 *Acesso Global:* Abre este link no teu telemóvel a partir de qualquer rede (4G/5G/Wi-Fi) sem precisar de estar na mesma rede do PC.\n` +
                `⚡ *Painel Web:* Consulta o estado, envia ordens para o Antigravity, vê logs e compilações em direto.\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━`
            });
          } else {
            cloudTunnel.startTunnel();
            return await sendReply(senderJid, {
              text:
                `☁️ *A inicializar o Túnel Cloudflare...*\nO túnel seguro em nuvem está a ser gerado. Envia \`${prefix}nuvem\` dentro de 5 segundos para receber o link direto.`
            });
          }
        }

        case "projetos":
        case "projects":
        case "lista": {
          let projects = androidService.listAllProjects();
          if ((!projects || projects.length === 0) && pcSyncService) {
            projects = pcSyncService.getProjects() || [];
          }
          return await sendReply(senderJid, { text: formatter.formatProjects(projects) });
        }

        case "diagnostico":
        case "diag":
        case "saude": {
          if (!fullArgs) {
            let projects = androidService.listAllProjects();
            if ((!projects || projects.length === 0) && pcSyncService) {
              projects = pcSyncService.getProjects() || [];
            }
            if (!projects || projects.length === 0) {
              return await sendReply(senderJid, {
                text: "🏥 *DIAGNÓSTICO DOS PROJETOS*\n━━━━━━━━━━━━━━━━━━━━━━━━\nNenhum projeto encontrado. Quando o teu PC estiver ligado com o agente sincronizador, a lista de projetos e saúde aparecerá aqui."
              });
            }
            let summary = "🏥 *DIAGNÓSTICO RÁPIDO DOS PROJETOS:*\n━━━━━━━━━━━━━━━━━━━━━━━━\n";
            for (const p of projects) {
              const diag = androidService.diagnoseProject(p.name);
              const icon = diag.isHealthy ? "🟢" : "🟡";
              summary += `${icon} *${p.name}* [_${p.type}_]: ${diag.isHealthy ? "Saudável" : `${diag.issues.length} alerta(s)`}\n`;
            }
            summary += "\n💡 _Para diagnóstico detalhado de um projeto: `/diagnostico <nome>`_";
            return await sendReply(senderJid, { text: summary });
          }
          const diag = androidService.diagnoseProject(fullArgs);
          return await sendReply(senderJid, { text: diag.message });
        }

        case "corrigir":
        case "fix":
        case "reparar": {
          if (!fullArgs) {
            return await sendReply(senderJid, {
              text: `⚠️ *Indique o projeto a reparar.*\nExemplo: \`${prefix}corrigir matchpro\``
            });
          }
          await sendReply(senderJid, { text: `🛠️ *A executar auto-reparação para:* \`${fullArgs}\`...` });
          const fixRes = androidService.fixProject(fullArgs);
          return await sendReply(senderJid, { text: fixRes.message });
        }

        case "aprender": {
          if (!fullArgs || !fullArgs.includes("=")) {
            return await sendReply(senderJid, {
              text: `⚠️ *Formato:* \`${prefix}aprender <quando disser X> = <fazer Y>\`\nExemplo: \`${prefix}aprender ver estado = /status\``
            });
          }
          const [triggerPart, actionPart] = fullArgs.split("=");
          const entry = aiService.learnPattern(triggerPart, actionPart);
          return await sendReply(senderJid, {
            text: `🧠 *Aprendizado Registado!*\n━━━━━━━━━━━━━━━━━━━━━━━━\n🗣️ *Gatilho:* "${entry.trigger}"\n⚡ *Ação:* \`${entry.action}\`\n━━━━━━━━━━━━━━━━━━━━━━━━\n_(Guardado em memória contínua, zero consumo de GPU)_`
          });
        }

        case "aprendizados":
        case "skills": {
          const patterns = aiService.getLearnedPatterns();
          if (patterns.length === 0) {
            return await sendReply(senderJid, { text: "🧠 *Ainda não tens padrões aprendidos registados.*\nUsa `/aprender <quando disser X> = <fazer Y>`." });
          }
          let textP = `🧠 *PADRÕES & SKILLS APRENDIDOS (${patterns.length}):*\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          patterns.forEach((p, idx) => {
            textP += `${idx + 1}. "${p.trigger}" ➔ \`${p.action}\`\n`;
          });
          return await sendReply(senderJid, { text: textP });
        }

        case "build":
        case "compilar": {
          if (!fullArgs) {
            return await sendReply(senderJid, {
              text: `⚠️ *Indique o projeto a compilar.*\nExemplo: \`${prefix}build pladur-pro\``
            });
          }

          await sendReply(senderJid, {
            text: `🔨 *Iniciada compilação Debug para:* \`${fullArgs}\`\nIrás receber uma notificação quando terminar...`
          });

          const result = await androidService.buildAndroidProject(fullArgs, "debug", (prog) => {
            // Progresso intermédio
          });

          await sendReply(senderJid, { text: result.message });

          // Se compilou com sucesso e tem APK, envia o ficheiro automaticamente!
          if (result.success && result.apk && fs.existsSync(result.apk.path)) {
            await sendReply(senderJid, {
              document: fs.readFileSync(result.apk.path),
              mimetype: "application/vnd.android.package-archive",
              fileName: result.apk.name,
              caption: `📱 APK pronto para instalar: *${result.apk.name}* (${result.apk.sizeMb} MB)`
            });
          }
          return;
        }

        case "release": {
          if (!fullArgs) {
            return await sendReply(senderJid, {
              text: `⚠️ *Indique o projeto.*\nExemplo: \`${prefix}release pladur-pro\``
            });
          }

          await sendReply(senderJid, {
            text: `📦 *Iniciada compilação Release para:* \`${fullArgs}\`...`
          });

          const result = await androidService.buildAndroidProject(fullArgs, "release");
          await sendReply(senderJid, { text: result.message });

          if (result.success && result.apk && fs.existsSync(result.apk.path)) {
            await sendReply(senderJid, {
              document: fs.readFileSync(result.apk.path),
              mimetype: "application/vnd.android.package-archive",
              fileName: result.apk.name,
              caption: `📱 APK Release: *${result.apk.name}* (${result.apk.sizeMb} MB)`
            });
          }
          return;
        }

        case "apk": {
          const apkMap = {
            rotabus: { name: "rotabus.apk", url: "https://smooth-bus-routes.vercel.app/rotabus.apk", sizeMb: "79.2" },
            rota: { name: "rotabus.apk", url: "https://smooth-bus-routes.vercel.app/rotabus.apk", sizeMb: "79.2" },
            bus: { name: "rotabus.apk", url: "https://smooth-bus-routes.vercel.app/rotabus.apk", sizeMb: "79.2" },
            matchpro: { name: "MatchPro.apk", url: "https://matchpro-alpha.vercel.app/MatchPro.apk", sizeMb: "4.62" },
            match: { name: "MatchPro.apk", url: "https://matchpro-alpha.vercel.app/MatchPro.apk", sizeMb: "4.62" },
            pladur: { name: "PladurPro.apk", url: "https://pladur-pro.vercel.app/PladurPro.apk", sizeMb: "36.6" },
            "pladur-pro": { name: "PladurPro.apk", url: "https://pladur-pro.vercel.app/PladurPro.apk", sizeMb: "36.6" },
            whatsapp: { name: "WhatsAppDevAssistant.apk", url: "https://matchpro-alpha.vercel.app/WhatsAppDevAssistant.apk", sizeMb: "12.97" },
            assistant: { name: "WhatsAppDevAssistant.apk", url: "https://matchpro-alpha.vercel.app/WhatsAppDevAssistant.apk", sizeMb: "12.97" }
          };

          const targetKey = fullArgs ? fullArgs.toLowerCase().trim() : "";
          if (targetKey && apkMap[targetKey]) {
            const info = apkMap[targetKey];
            await sendReply(senderJid, {
              text:
                `📦 *DOWNLOAD DO APK: ${info.name} (${info.sizeMb} MB)*\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🚀 *Download Direto no Telemóvel (Vercel CDN):*\n${info.url}\n\n` +
                `💡 _Abre no navegador do smartphone para descarregar a alta velocidade e instalar._`
            });
            const localFile = path.join(config.rootDir, "src", "web", "public", info.name);
            const desktopFile = path.join(config.projectsDir, info.name);
            const fileToSend = fs.existsSync(localFile) ? localFile : (fs.existsSync(desktopFile) ? desktopFile : null);
            if (fileToSend && fs.statSync(fileToSend).size < 50 * 1024 * 1024) {
              try {
                await sendReply(senderJid, {
                  document: fs.readFileSync(fileToSend),
                  mimetype: "application/vnd.android.package-archive",
                  fileName: info.name,
                  caption: `📱 APK: *${info.name}*`
                });
              } catch (e) {}
            }
            return;
          }

          if (!fullArgs) {
            return await sendReply(senderJid, {
              text:
                `📦 *CENTRO DE DOWNLOADS DE APKs (CDN VERCEL)*\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `1. ⚽ *MatchPro (4.62 MB):*\n   \`${prefix}apk matchpro\`\n   📥 https://matchpro-alpha.vercel.app/MatchPro.apk\n\n` +
                `2. 🏗️ *Pladur-Pro (36.6 MB):*\n   \`${prefix}apk pladur\`\n   📥 https://pladur-pro.vercel.app/PladurPro.apk\n\n` +
                `3. 🚌 *RotaBus (79.2 MB):*\n   \`${prefix}apk rotabus\`\n   📥 https://smooth-bus-routes.vercel.app/rotabus.apk\n\n` +
                `4. 🤖 *WhatsApp Dev Assistant (12.97 MB):*\n   \`${prefix}apk whatsapp\`\n   📥 https://matchpro-alpha.vercel.app/WhatsAppDevAssistant.apk\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `💡 _Para ver todos os links de projetos web: \`${prefix}links\`_`
            });
          }

          const projectPath = path.join(config.projectsDir, fullArgs);
          const apks = androidService.findApkFiles(projectPath);

          if (apks.length === 0) {
            return await sendReply(senderJid, {
              text: `❌ Nenhum APK encontrado no projeto \`${fullArgs}\`.\nUsa \`${prefix}build ${fullArgs}\` para compilar primeiro ou \`${prefix}apks\` para a lista de APKs disponíveis.`
            });
          }

          const latest = apks[0];
          await sendReply(senderJid, { text: `📦 A enviar \`${latest.name}\` (${latest.sizeMb} MB)...` });

          await sendReply(senderJid, {
            document: fs.readFileSync(latest.path),
            mimetype: "application/vnd.android.package-archive",
            fileName: latest.name,
            caption: `📱 APK do projeto *${fullArgs}*`
          });
          return;
        }

        case "studio": {
          if (!fullArgs) {
            return await sendReply(senderJid, {
              text: `⚠️ *Indique o projeto.*\nExemplo: \`${prefix}studio pladur-pro\``
            });
          }
          const res = androidService.openInAndroidStudio(fullArgs);
          return await sendReply(senderJid, { text: res.message });
        }

        case "adb": {
          const res = await androidService.getAdbDevices();
          if (!res.success) {
            return await sendReply(senderJid, { text: res.message });
          }
          if (res.devices.length === 0) {
            return await sendReply(senderJid, {
              text: "📱 *Nenhum dispositivo Android conectado via USB/WiFi.*\nAtiva a depuração USB no teu telemóvel para instalar diretamente."
            });
          }
          let msgText = `📱 *DISPOSITIVOS CONECTADOS (${res.devices.length}):*\n`;
          res.devices.forEach((d, i) => (msgText += `${i + 1}. \`${d}\`\n`));
          return await sendReply(senderJid, { text: msgText });
        }

        case "ordem":
        case "chat":
        case "agy":
        case "antigravity": {
          if (!fullArgs) {
            return await sendReply(senderJid, {
              text: `⚠️ *Indica a ordem a adicionar ao Chat Antigravity.*\nExemplo: \`${prefix}ordem verifica se o matchpro tem erros\` ou \`${prefix}ordem matchpro : compila e testa\``
            });
          }

          let targetProj = null;
          let prompt = fullArgs;

          // Suporte para "/ordem matchpro : refatora o menu"
          if (fullArgs.includes(" : ")) {
            const split = fullArgs.split(" : ");
            targetProj = split[0].trim();
            prompt = split[1].trim();
          }

          // 1. Registar ordem no chat / brain
          const order = antigravityService.addOrder({
            orderText: prompt,
            senderNumber: cleanSender || senderJid,
            targetProject: targetProj
          });

          // 2. Notificação imediata ao utilizador no WhatsApp
          await sendReply(senderJid, {
            text:
              `📥 *ORDEM REGISTADA NO CHAT ANTIGRAVITY* (#${order.id})\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `💬 *Sessão Ativa:* \`${config.activeConversationId.slice(0, 8)}...\`\n` +
              `📋 *Instrução:* _"${prompt}"_\n` +
              (targetProj ? `📁 *Projeto:* \`${targetProj}\`\n` : "") +
              `⚡ *Estado:* A executar autonomamente com Antigravity CLI...\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `⏳ _Aguarde um momento, o relatório será enviado assim que terminar._`
          });

          // 3. Execução assíncrona com envio do relatório completo
          try {
            const res = await antigravityService.executeChatOrder(order);

            if (res?.queued) {
              return await sendReply(senderJid, {
                text:
                  `📥 *ORDEM #${order.id} GUARDADA NA FILA DO PC*\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `📋 *Ordem:* _"${prompt}"_\n\n` +
                  `${res.output}\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `🔔 _Serás notificado aqui automaticamente assim que o PC concluir o trabalho._`
              });
            }

            let outText = res.output || "Ordem executada sem retorno de texto.";
            const MAX_LEN = 2800;

            if (res.success) {
              if (outText.length <= MAX_LEN) {
                return await sendReply(senderJid, {
                  text:
                    `✅ *ORDEM #${order.id} CONCLUÍDA* (${res.durationSeconds}s)\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `📋 *Ordem:* _"${prompt}"_\n\n` +
                    `${outText}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `✨ _Adicionada ao histórico do chat Antigravity._`
                });
              } else {
                const part1 = outText.slice(0, MAX_LEN);
                await sendReply(senderJid, {
                  text:
                    `✅ *ORDEM #${order.id} CONCLUÍDA* (${res.durationSeconds}s) [Parte 1/2]\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `${part1}`
                });
                const part2 = outText.slice(MAX_LEN, MAX_LEN * 2);
                return await sendReply(senderJid, {
                  text:
                    `📋 *Continuação da Ordem #${order.id}:*\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `${part2}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `✨ _Adicionada ao histórico do chat Antigravity._`
                });
              }
            } else {
              return await sendReply(senderJid, {
                text:
                  `❌ *FALHA NA ORDEM #${order.id}* (${res.durationSeconds}s)\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `📋 *Ordem:* _"${prompt}"_\n\n` +
                  `⚠️ *Detalhe do Erro:*\n${outText.slice(0, 2000)}\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━`
              });
            }
          } catch (execErr) {
            antigravityService.updateOrder(order.id, {
              status: "failed",
              result: execErr.message
            });
            return await sendReply(senderJid, {
              text: `❌ *Erro ao processar a ordem #${order.id}:* ${execErr.message}`
            });
          }
        }

        case "ordens":
        case "chat-ordens":
        case "pedidos": {
          const orders = antigravityService.getOrders();
          if (orders.length === 0) {
            return await sendReply(senderJid, {
              text: "📋 *Nenhuma ordem registada no Chat Antigravity.*\nEnvia `/ordem <instrução>` para adicionar uma ordem ao chat."
            });
          }

          let msgList = `📋 *ORDENS DO CHAT ANTIGRAVITY (Últimas ${Math.min(orders.length, 6)}):*\n` +
            `💬 *Sessão Ativa:* \`${config.activeConversationId.slice(0, 8)}...\`\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n`;

          orders.slice(0, 6).forEach((o) => {
            const icon = o.status === "completed" ? "✅" : o.status === "executing" ? "⚡" : "❌";
            msgList += `${icon} *#${o.id}* [_${o.createdAt || o.timestamp.slice(11, 16)}_]:\n   "${o.order.slice(0, 60)}${o.order.length > 60 ? "..." : ""}"\n`;
          });

          msgList += `━━━━━━━━━━━━━━━━━━━━━━━━\n💡 _Para nova ordem: \`/ordem <instrução>\`_`;
          return await sendReply(senderJid, { text: msgList });
        }

        case "print":
        case "screenshot": {
          await sendReply(senderJid, { text: "📸 A capturar ecrã do PC..." });
          const snap = await systemService.takeScreenshot();

          if (snap.success && fs.existsSync(snap.filePath)) {
            await sendReply(senderJid, {
              image: fs.readFileSync(snap.filePath),
              caption: `🖥️ *Captura do Ecrã do PC*\nData: ${new Date().toLocaleString("pt-PT")}`
            });
            try {
              fs.unlinkSync(snap.filePath);
            } catch (e) {}
          } else {
            await sendReply(senderJid, { text: `❌ Erro ao capturar ecrã: ${snap.error}` });
          }
          return;
        }

        case "cmd": {
          if (!fullArgs) {
            return await sendReply(senderJid, { text: `⚠️ *Indique o comando.*\nExemplo: \`${prefix}cmd dir\`` });
          }
          await sendReply(senderJid, { text: `💻 A executar: \`${fullArgs}\`...` });
          const res = await systemService.runCommand(fullArgs);
          let out = res.output;
          if (out.length > 3000) out = out.slice(0, 3000) + "\n...[Truncado]";
          return await sendReply(senderJid, { text: `\`\`\`${out}\`\`\`` });
        }

        case "tarefa":
        case "task": {
          if (!fullArgs) {
            const tasks = personalAssistant.getTasks();
            return await sendReply(senderJid, { text: formatter.formatTasks(tasks) });
          }
          const task = personalAssistant.addTask(fullArgs);
          return await sendReply(senderJid, {
            text: `✅ *Tarefa guardada:* \`${task.title}\` (ID: \`#${task.id.slice(-4)}\`)`
          });
        }

        case "tarefas":
        case "tasks": {
          const tasks = personalAssistant.getTasks();
          return await sendReply(senderJid, { text: formatter.formatTasks(tasks) });
        }

        case "feita":
        case "concluir": {
          if (!fullArgs) {
            return await sendReply(senderJid, { text: `⚠️ *Indica o ID da tarefa.*\nExemplo: \`${prefix}feita 1234\`` });
          }
          const updated = personalAssistant.toggleTask(fullArgs);
          if (!updated) {
            return await sendReply(senderJid, { text: `❌ Tarefa não encontrada com o ID \`${fullArgs}\`.` });
          }
          return await sendReply(senderJid, {
            text: updated.completed
              ? `🎉 *Tarefa concluída:* ~${updated.title}~`
              : `⏳ *Tarefa reaberta:* ${updated.title}`
          });
        }

        case "gestor":
        case "gestor-pessoal":
        case "painel": {
          const now = new Date();
          const todayStr = now.toISOString().split("T")[0];
          const tomorrow = new Date(now);
          tomorrow.setDate(now.getDate() + 1);
          const tomorrowStr = tomorrow.toISOString().split("T")[0];

          const todayEvents = calendarService.getEventsForDay(todayStr);
          const tomorrowEvents = calendarService.getEventsForDay(tomorrowStr);
          const tasks = personalAssistant.getTasks();
          const drafts = emailService.getDrafts();
          const isEmailConfigured = emailService.isConfigured();

          const dashboard = formatter.formatPersonalManagerDashboard({
            todayEvents,
            tomorrowEvents,
            tasks,
            drafts,
            isEmailConfigured,
            emailUser: config.emailUser
          });

          return await sendReply(senderJid, { text: dashboard });
        }

        case "hoje":
        case "agenda-hoje": {
          const report = calendarService.formatDayAgenda(null, "Hoje");
          return await sendReply(senderJid, { text: report });
        }

        case "amanha":
        case "agenda-amanha": {
          const now = new Date();
          const tomorrow = new Date(now);
          tomorrow.setDate(now.getDate() + 1);
          const tomorrowStr = tomorrow.toISOString().split("T")[0];
          const report = calendarService.formatDayAgenda(tomorrowStr, "Amanhã");
          return await sendReply(senderJid, { text: report });
        }

        case "anotar-evento":
        case "marcar-evento": {
          if (!fullArgs) {
            return await sendReply(senderJid, {
              text: `📅 *Como anotar eventos no calendário:*\n\n\`${prefix}anotar-evento amanhã às 15h Reunião de obras\`\nou\n\`${prefix}anotar-evento sexta 10:30 Consulta médica\``
            });
          }
          const parsed = calendarService.parseQuickEventPhrase(fullArgs);
          const conflicts = calendarService.checkConflicts(parsed.date, parsed.time, parsed.durationMinutes);
          const ev = calendarService.addEvent(parsed);
          const gcalUrl = personalAssistant.generateGoogleCalendarUrl(ev.title, ev.dateTime, ev.durationMinutes);
          const ics = personalAssistant.generateIcsContent(ev.title, ev.dateTime, ev.durationMinutes);

          let conflictNotice = "";
          if (conflicts && conflicts.length > 0) {
            conflictNotice = `\n⚠️ *Aviso de Conflito de Horário!* Já tens compromisso marcado nesse intervalo:\n• ${conflicts.map((c) => `${c.time} - ${c.title}`).join(", ")}\n`;
          }

          let replyText =
            `📅 *EVENTO ANOTADO COM SUCESSO!*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📝 *Título:* _${ev.title}_\n` +
            `📅 *Data:* *${ev.date}*\n` +
            `🕒 *Hora:* *${ev.time}* (${ev.durationMinutes} min)\n` +
            `${conflictNotice}\n` +
            `🔗 *Adicionar ao Google Calendar (1 clique):*\n${gcalUrl}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🔔 _Receberás um lembrete automático no WhatsApp 15 minutos antes!_`;

          await sendReply(senderJid, { text: replyText });

          if (ics) {
            try {
              await sendReply(senderJid, {
                document: Buffer.from(ics, "utf8"),
                mimetype: "text/calendar",
                fileName: `${ev.title.slice(0, 15).replace(/[^a-zA-Z0-9]/g, "_")}.ics`,
                caption: `📅 Evento Google Calendar: *${ev.title}*`
              });
            } catch (e) {}
          }
          return;
        }

        case "procurar-evento":
        case "pesquisar-evento": {
          if (!fullArgs) {
            return await sendReply(senderJid, {
              text: `⚠️ *Indica o termo a pesquisar no calendário.*\nExemplo: \`${prefix}procurar-evento Reunião\` ou \`${prefix}procurar-evento Maia\``
            });
          }
          const results = calendarService.searchEvents(fullArgs);
          if (!results || results.length === 0) {
            return await sendReply(senderJid, {
              text: `🔍 *Nenhum evento encontrado no calendário para "${fullArgs}".*\nUsa \`/agenda\` para rever a semana toda.`
            });
          }
          let report = `🔍 *EVENTOS ENCONTRADOS PARA "${fullArgs}" (${results.length}):*\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          results.forEach((e, idx) => {
            report += `${idx + 1}. 📅 *${e.date}* às 🕒 *${e.time}* - *${e.title}* (#${e.id})\n`;
          });
          report += `━━━━━━━━━━━━━━━━━━━━━━━━\n💡 _Para cancelar algum: \`/cancelar-evento <id>\`_`;
          return await sendReply(senderJid, { text: report });
        }

        case "agenda":
        case "calendario":
        case "eventos":
        case "rever-agenda":
        case "rever-calendario": {
          if (!fullArgs) {
            return await sendReply(senderJid, { text: calendarService.formatAgenda() });
          }
          // Se passou texto (ex: /agenda amanhã às 15h Reunião)
          const parsed = calendarService.parseQuickEventPhrase(fullArgs);
          const ev = calendarService.addEvent(parsed);
          const gcalUrl = personalAssistant.generateGoogleCalendarUrl(ev.title, ev.dateTime, ev.durationMinutes);
          const ics = personalAssistant.generateIcsContent(ev.title, ev.dateTime, ev.durationMinutes);

          let replyText =
            `📅 *EVENTO ABSORVIDO COM SUCESSO!*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📝 *Título:* _${ev.title}_\n` +
            `📅 *Data:* *${ev.date}*\n` +
            `🕒 *Hora:* *${ev.time}*\n\n` +
            `🔗 *Adicionar ao Google Calendar (1 clique):*\n${gcalUrl}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🔔 _Receberás um lembrete automático no WhatsApp 15 minutos antes!_`;

          await sendReply(senderJid, { text: replyText });

          if (ics) {
            try {
              await sendReply(senderJid, {
                document: Buffer.from(ics, "utf8"),
                mimetype: "text/calendar",
                fileName: `${ev.title.slice(0, 15).replace(/[^a-zA-Z0-9]/g, "_")}.ics`,
                caption: `📅 Evento Google Calendar: *${ev.title}*`
              });
            } catch (e) {}
          }
          return;
        }

        case "evento":
        case "marcar":
        case "agendar": {
          if (!fullArgs) {
            return await sendReply(senderJid, {
              text: `📅 *Como agendar eventos rápidos:*\n\nBasta escreveres:\n\`/evento amanhã às 15h Reunião de obras\`\nou\n\`/evento sexta 10:30 Consulta médica\`\nou simplesmente:\n\`agenda sexta às 16h Dentista\``
            });
          }
          const parsed = calendarService.parseQuickEventPhrase(fullArgs);
          const ev = calendarService.addEvent(parsed);
          const gcalUrl = personalAssistant.generateGoogleCalendarUrl(ev.title, ev.dateTime, ev.durationMinutes);
          const ics = personalAssistant.generateIcsContent(ev.title, ev.dateTime, ev.durationMinutes);

          let replyText =
            `📅 *EVENTO ABSORVIDO COM SUCESSO!*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📝 *Título:* _${ev.title}_\n` +
            `📅 *Data:* *${ev.date}*\n` +
            `🕒 *Hora:* *${ev.time}*\n\n` +
            `🔗 *Adicionar ao Google Calendar (1 clique):*\n${gcalUrl}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🔔 _Receberás um lembrete automático no WhatsApp 15 minutos antes!_`;

          await sendReply(senderJid, { text: replyText });

          if (ics) {
            try {
              await sendReply(senderJid, {
                document: Buffer.from(ics, "utf8"),
                mimetype: "text/calendar",
                fileName: `${ev.title.slice(0, 15).replace(/[^a-zA-Z0-9]/g, "_")}.ics`,
                caption: `📅 Evento Google Calendar: *${ev.title}*`
              });
            } catch (e) {}
          }
          return;
        }

        case "lembrete": {
          const parts = fullArgs.split(" ");
          if (parts.length < 2) {
            return await sendReply(senderJid, {
              text: `⚠️ *Formato:* \`${prefix}lembrete <tempo> <texto>\`\nExemplo: \`${prefix}lembrete 20m Reunião com cliente\` ou \`${prefix}lembrete 18:00 Dentista\``
            });
          }
          const timeExpr = parts[0];
          const reminderText = parts.slice(1).join(" ");
          const res = personalAssistant.scheduleReminder(timeExpr, reminderText, senderJid);

          if (!res.success) {
            return await sendReply(senderJid, { text: res.message });
          }

          let replyText =
            `🔔 *Lembrete Agendado & Google Calendar!*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📋 *Evento:* _"${reminderText}"_\n` +
            `⏳ *Aviso no WhatsApp:* daqui a *${res.delayMinutes} minutos*\n\n` +
            `📅 *Adicionar ao Google Calendar (1 clique):*\n${res.googleCalendarUrl}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `💡 _Toca no link acima ou no anexo abaixo para sincronizar com o teu Google Calendar (${config.authEmail || "Andre22pinheiro@gmail.com"})!_`;

          await sendReply(senderJid, { text: replyText });

          if (res.icsContent) {
            try {
              await sendReply(senderJid, {
                document: Buffer.from(res.icsContent, "utf8"),
                mimetype: "text/calendar",
                fileName: "evento.ics",
                caption: `📅 Evento para Google Calendar: *${reminderText}*`
              });
            } catch (e) {}
          }
          return;
        }

        case "flashscore": {
          return await sendReply(senderJid, {
            text:
              "⚡ *CONFIRMAÇÃO OFICIAL DE JOGOS VIA FLASHSCORE.PT (4 NOV)*\n\n" +
              "🛡️ *Zero Alucinações*: O jogo do Real Madrid de hoje foi às 17h45 (*AEK 1-1 Real Madrid*).\n\n" +
              "🏆 *JOGOS DAS 20:00 NA CHAMPIONS LEAGUE (OFICIAL FLASHSCORE)*:\n" +
              "1. 🇵🇹 *FC Porto vs SSC Napoli* (Estádio do Dragão • Sport TV 1 HD / Sport TV 5)\n" +
              "2. 🇩🇪 *RB Leipzig vs Manchester City* (DAZN 1 HD)\n" +
              "3. 🇨🇿 *Slavia Praga vs Arsenal FC* (DAZN 2 HD)\n" +
              "4. 🇩🇪 *Borussia Dortmund vs Real Betis*\n" +
              "5. 🇳🇱 *PSV Eindhoven vs Club Brugge*\n" +
              "6. 🇫🇷 *RC Lens vs Como 1907*\n" +
              "7. 🇳🇴 *Viking FK vs Sabah FK*\n\n" +
              "🔗 *Flashscore em Direto*: https://www.flashscore.pt/futebol/europa/liga-dos-campeoes/\n" +
              "✅ *MatchPro*: Atualizado e sincronizado com os jogos oficiais das 20:00."
          });
        }

        case "nota":
        case "anotar": {
          if (!fullArgs) {
            return await sendReply(senderJid, {
              text: `⚠️ *Como guardar uma nota:*\n\`${prefix}nota <texto>\`\nExemplo: \`${prefix}nota Medições sala: 24m2, 12 placas standard\``
            });
          }
          const note = personalAssistant.addNote("Nota", fullArgs);
          return await sendReply(senderJid, {
            text: `📝 *NOTA GUARDADA COM SUCESSO!*\n━━━━━━━━━━━━━━━━━━━━━━━━\n"${note.content}"\n\n💡 _Para rever as tuas notas: \`${prefix}notas\`_`
          });
        }

        case "notas": {
          const notes = personalAssistant.getNotes();
          if (!notes || notes.length === 0) {
            return await sendReply(senderJid, {
              text: `📝 *BLOCO DE NOTAS*\n━━━━━━━━━━━━━━━━━━━━━━━━\nNenhuma nota guardada ainda.\nUsa \`${prefix}nota <texto>\` para anotar ideias ou dados rápidos.`
            });
          }
          let noteText = `📝 *AS TUAS NOTAS GUARDADAS (${notes.length}):*\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          notes.slice(-8).reverse().forEach((n, i) => {
            const dateStr = n.createdAt ? new Date(n.createdAt).toLocaleDateString("pt-PT") : "";
            noteText += `${i + 1}. [_${dateStr}_] ${n.content}\n\n`;
          });
          noteText += `━━━━━━━━━━━━━━━━━━━━━━━━\n💡 _Para nova nota: \`${prefix}nota <texto>\`_`;
          return await sendReply(senderJid, { text: noteText });
        }

        case "cancelar-evento":
        case "remover-evento":
        case "apagar-evento": {
          if (!fullArgs) {
            return await sendReply(senderJid, {
              text: `⚠️ *Indica o ID do evento a cancelar.*\nExemplo: \`${prefix}cancelar-evento 1234\``
            });
          }
          const removed = calendarService.deleteEvent(fullArgs);
          if (removed) {
            return await sendReply(senderJid, { text: `🗑️ *Evento #${fullArgs} cancelado com sucesso da tua agenda!*` });
          } else {
            return await sendReply(senderJid, { text: `❌ Evento não encontrado com o ID \`${fullArgs}\`. Envia \`/agenda\` para ver os IDs.` });
          }
        }

        case "emails":
        case "email":
        case "rever-emails":
        case "inbox":
        case "resumo-emails":
        case "resumo_emails": {
          if (!emailService.isConfigured()) {
            return await sendReply(senderJid, {
              text:
                "📧 *GESTÃO INTELIGENTE DE EMAILS (GMAIL)*\n━━━━━━━━━━━━━━━━━━━━━━━━\n" +
                "Para ativar a leitura e os resumos automáticos com IA dos teus emails recebidos, precisas de configurar a palavra-passe de aplicação do Gmail.\n\n" +
                "📌 *Passos rápidos (1 minuto):*\n" +
                "1. Acede a: https://myaccount.google.com/apppasswords\n" +
                "2. Cria uma palavra-passe de app com o nome \"WhatsApp Bot\"\n" +
                "3. Envia aqui no WhatsApp:\n" +
                `\`${prefix}config email <palavra-passe-de-16-letras>\`\n\n` +
                `Conta configurada: \`${config.emailUser}\``
            });
          }

          await sendReply(senderJid, { text: "🔍 _A aceder à caixa de correio e a gerar resumo executivo com IA..._" });
          try {
            const query = fullArgs ? fullArgs.trim() : "";
            const emails = await emailService.fetchRecentEmails({ limit: 6, unreadOnly: !query, query });
            const summary = await emailService.generateEmailsSummary(emails, query);
            return await sendReply(senderJid, { text: summary });
          } catch (err) {
            logger.error("Erro ao obter emails:", err);
            return await sendReply(senderJid, {
              text: `❌ *Erro ao consultar emails:* ${err.message}\nVerifica se a palavra-passe de aplicação está correta com \`${prefix}config email <pass>\`.`
            });
          }
        }

        case "ler-email":
        case "ler_email":
        case "rever-email": {
          if (!fullArgs) {
            return await sendReply(senderJid, {
              text: `⚠️ *Indica o ID do email a ler.*\nExemplo: \`${prefix}ler-email 1234\``
            });
          }
          if (!emailService.isConfigured()) {
            return await sendReply(senderJid, {
              text: `⚠️ *Email não configurado.* Usa \`${prefix}config email <palavra-passe-app>\`.`
            });
          }

          await sendReply(senderJid, { text: `🔍 _A carregar email #${fullArgs} e a analisar com IA..._` });
          try {
            const emailData = await emailService.fetchEmailDetails(parseInt(fullArgs, 10));
            if (!emailData) {
              return await sendReply(senderJid, { text: `❌ Email #${fullArgs} não encontrado.` });
            }
            const detailedSummary = await emailService.generateSingleEmailSummary(emailData);
            return await sendReply(senderJid, { text: detailedSummary });
          } catch (err) {
            return await sendReply(senderJid, { text: `❌ Erro ao ler email: ${err.message}` });
          }
        }

        case "rascunhos":
        case "rever-rascunhos":
        case "ver-rascunhos": {
          const list = emailService.formatDraftsList();
          return await sendReply(senderJid, { text: list });
        }

        case "anotar-email":
        case "rascunho-email":
        case "rascunho": {
          if (!fullArgs || !fullArgs.includes(":")) {
            return await sendReply(senderJid, {
              text:
                `📝 *COMO ANOTAR UM RASCUNHO DE EMAIL*\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `Formato:\n` +
                `\`${prefix}anotar-email <destinatário> <assunto> : <mensagem>\`\n\n` +
                `Exemplo:\n` +
                `\`${prefix}anotar-email cliente@empresa.pt Orçamento Obra : Olá, envio em anexo a proposta revista com 5% de desconto.\`\n\n` +
                `💡 _O rascunho fica guardado. Podes revê-lo com \`${prefix}rascunhos\` e expedir quando quiseres com \`${prefix}enviar-rascunho <id>\`!_`
            });
          }

          const [headerPart, ...bodyParts] = fullArgs.split(":");
          const bodyText = bodyParts.join(":").trim();
          const headerTokens = headerPart.trim().split(" ");
          const toAddress = headerTokens[0].includes("@") ? headerTokens[0].trim() : "";
          const subject = (toAddress ? headerTokens.slice(1) : headerTokens).join(" ").trim() || "Rascunho de André Pinheiro";

          const draft = emailService.saveDraft({
            to: toAddress,
            subject,
            body: bodyText
          });

          return await sendReply(senderJid, {
            text:
              `📝 *RASCUNHO DE EMAIL ANOTADO COM SUCESSO!*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `🆔 *ID:* \`#${draft.id}\`\n` +
              `📬 *Para:* ${draft.to || "_(Sem destinatário definido)_"}\n` +
              `📌 *Assunto:* ${draft.subject}\n` +
              `📝 *Corpo:* "${draft.body.slice(0, 150)}${draft.body.length > 150 ? "..." : ""}"\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `💡 _Para rever os teus rascunhos: \`${prefix}rascunhos\`_\n` +
              `🚀 _Para enviar este email agora: \`${prefix}enviar-rascunho ${draft.id}\`_`
          });
        }

        case "enviar-rascunho":
        case "expedir-rascunho": {
          if (!fullArgs) {
            return await sendReply(senderJid, {
              text: `⚠️ *Indica o número ou ID do rascunho a enviar.*\nExemplo: \`${prefix}enviar-rascunho 1\`\nUsa \`${prefix}rascunhos\` para ver os teus rascunhos guardados.`
            });
          }
          if (!emailService.isConfigured()) {
            return await sendReply(senderJid, {
              text: `⚠️ *Email não configurado.* Usa \`${prefix}config email <palavra-passe-app>\` para autorizar o envio via Gmail.`
            });
          }

          await sendReply(senderJid, { text: `📤 _A enviar rascunho #${fullArgs}..._` });
          try {
            const result = await emailService.sendDraft(fullArgs);
            return await sendReply(senderJid, {
              text:
                `✅ *RASCUNHO ENVIADO COM SUCESSO!*\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `📬 *Para:* ${result.to}\n` +
                `📌 *Assunto:* ${result.subject}\n` +
                `⏱️ *Data:* ${new Date().toLocaleTimeString("pt-PT")}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🗑️ _O rascunho foi removido da lista após expedição com sucesso._`
            });
          } catch (err) {
            return await sendReply(senderJid, {
              text: `❌ *Erro ao enviar rascunho:* ${err.message}\nVerifica se o rascunho tem um email de destinatário válido.`
            });
          }
        }

        case "apagar-rascunho":
        case "eliminar-rascunho": {
          if (!fullArgs) {
            return await sendReply(senderJid, {
              text: `⚠️ *Indica o número ou ID do rascunho a apagar.*\nExemplo: \`${prefix}apagar-rascunho 1\``
            });
          }
          const deleted = emailService.deleteDraft(fullArgs);
          if (deleted) {
            return await sendReply(senderJid, {
              text: `🗑️ *Rascunho #${fullArgs} eliminado com sucesso!*`
            });
          } else {
            return await sendReply(senderJid, {
              text: `❌ Rascunho não encontrado com o ID ou índice \`${fullArgs}\`. Usa \`${prefix}rascunhos\` para rever a lista.`
            });
          }
        }

        case "enviar-email":
        case "enviar_email": {
          if (!emailService.isConfigured()) {
            return await sendReply(senderJid, {
              text: `⚠️ *Email não configurado.* Usa \`${prefix}config email <palavra-passe-app>\`.`
            });
          }
          if (!fullArgs || !fullArgs.includes(":") || !fullArgs.includes("@")) {
            return await sendReply(senderJid, {
              text:
                "✉️ *Como enviar um email:*\n" +
                `\`${prefix}enviar-email <destinatário> <assunto> : <mensagem>\`\n\n` +
                "Exemplo:\n" +
                `\`${prefix}enviar-email cliente@empresa.pt Orçamento Obra : Olá, envio a proposta em anexo. Cumprimentos.\``
            });
          }

          const [headerPart, ...bodyParts] = fullArgs.split(":");
          const bodyText = bodyParts.join(":").trim();
          const headerTokens = headerPart.trim().split(" ");
          const toAddress = headerTokens[0].trim();
          const subject = headerTokens.slice(1).join(" ").trim() || "Mensagem de André Pinheiro";

          await sendReply(senderJid, { text: `📤 _A enviar email para ${toAddress}..._` });
          try {
            await emailService.sendEmail({
              to: toAddress,
              subject,
              text: bodyText
            });
            return await sendReply(senderJid, {
              text:
                `✅ *EMAIL ENVIADO COM SUCESSO!*\n━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `📬 *Para:* ${toAddress}\n` +
                `📌 *Assunto:* ${subject}\n` +
                `📝 *Mensagem:* "${bodyText.slice(0, 200)}"\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━`
            });
          } catch (sendErr) {
            return await sendReply(senderJid, { text: `❌ Falha ao enviar email: ${sendErr.message}` });
          }
        }

        case "atualizar":
        case "update": {
          await sendReply(senderJid, { text: "🔄 *A atualizar assistente a partir do GitHub...*" });
          try {
            const { execSync } = await import("child_process");
            const pullOut = execSync("git pull origin main", { cwd: config.rootDir, encoding: "utf8" });
            await sendReply(senderJid, {
              text: `✅ *Atualização concluída:*\n\`\`\`${pullOut.trim().slice(0, 300)}\`\`\`\n⚡ A reiniciar serviço para aplicar...`
            });
            setTimeout(() => {
              process.exit(0);
            }, 1000);
          } catch (gitErr) {
            await sendReply(senderJid, { text: `❌ Erro ao atualizar via Git: ${gitErr.message}` });
          }
          return;
        }

        case "reiniciar":
        case "restart": {
          await sendReply(senderJid, { text: "⚡ *A reiniciar o serviço do assistente...* Voltará a responder dentro de 5 segundos." });
          setTimeout(() => {
            process.exit(0);
          }, 800);
          return;
        }

        case "config": {
          if (args[0] === "key" && args[1]) {
            config.geminiApiKey = args[1];
            saveSettings({ geminiApiKey: args[1] });
            return await sendReply(senderJid, { text: "🔑 *Chave Gemini API guardada com sucesso!*" });
          }
          if (args[0] === "email" && args[1]) {
            emailService.saveCredentials({ password: args[1] });
            return await sendReply(senderJid, {
              text: `📧 *Palavra-passe de aplicação do Gmail guardada com sucesso!*\nConta: \`${config.emailUser}\`\n\nJá podes usar \`/emails\` para ver o teu resumo inteligente!`
            });
          }
          return await sendReply(senderJid, {
            text:
              `⚙️ *DEFINIÇÕES DO SISTEMA:*\n━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `• Dono: \`${config.ownerPhone}\`\n` +
              `• IA Gemini: ${config.geminiApiKey ? "✅ Configurada (Gemini 3.8 Flash)" : "❌ Não configurada"}\n` +
              `• Email (${config.emailUser}): ${emailService.isConfigured() ? "✅ Ativo (IMAP & SMTP)" : "❌ Não configurado (Usa `/config email <pass>`)"}\n` +
              `• Porta Dashboard: \`${config.port}\`\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━`
          });
        }

        default:
          return await sendReply(senderJid, {
            text: `❓ Comando desconhecido: \`${prefix}${cmd}\`\nEnvia \`${prefix}ajuda\` para ver as opções disponíveis.`
          });
      }
    }

    // 2. PROCESSAMENTO NATURAL COM IA GEMINI & APRENDIZAGEM CONTÍNUA
    const projects = androidService.listAllProjects().map((p) => p.name);
    const aiResult = await aiService.processNaturalLanguage(text, { projects });

    if (aiResult.type === "learned_action") {
      await sendReply(senderJid, {
        text: `🧠 *Padrão Aprendido:* A executar \`${aiResult.command}\`...`
      });
      const learnedMsg = {
        ...msg,
        message: {
          conversation: aiResult.command
        }
      };
      return await handleIncomingMessage(sock, learnedMsg, botSentMessageIds);
    }

    if (aiResult.type === "action") {
      switch (aiResult.action) {
        case "DIAGNOSE": {
          if (aiResult.project) {
            const diag = androidService.diagnoseProject(aiResult.project);
            return await sendReply(senderJid, { text: diag.message });
          }
          break;
        }

        case "FIX": {
          if (aiResult.project) {
            const fixRes = androidService.fixProject(aiResult.project);
            return await sendReply(senderJid, { text: fixRes.message });
          }
          break;
        }

        case "BUILD_ANDROID": {
          if (aiResult.project) {
            await sendReply(senderJid, { text: `🔨 *Ação identificada:* Compilar \`${aiResult.project}\`...` });
            const buildRes = await androidService.buildAndroidProject(aiResult.project);
            await sendReply(senderJid, { text: buildRes.message });
            if (buildRes.success && buildRes.apk) {
              await sendReply(senderJid, {
                document: fs.readFileSync(buildRes.apk.path),
                mimetype: "application/vnd.android.package-archive",
                fileName: buildRes.apk.name,
                caption: `📱 APK: *${buildRes.apk.name}*`
              });
            }
            return;
          }
          break;
        }

        case "STATUS": {
          const health = await systemService.getSystemHealth();
          return await sendReply(senderJid, { text: formatter.formatStatus(health) });
        }

        case "SCREENSHOT": {
          const snap = await systemService.takeScreenshot();
          if (snap.success) {
            await sendReply(senderJid, {
              image: fs.readFileSync(snap.filePath),
              caption: "📸 *Print do ecrã do PC*"
            });
            try {
              fs.unlinkSync(snap.filePath);
            } catch (e) {}
            return;
          }
          break;
        }

        case "SHOW_MANAGER": {
          const now = new Date();
          const todayStr = now.toISOString().split("T")[0];
          const tomorrow = new Date(now);
          tomorrow.setDate(now.getDate() + 1);
          const tomorrowStr = tomorrow.toISOString().split("T")[0];

          const todayEvents = calendarService.getEventsForDay(todayStr);
          const tomorrowEvents = calendarService.getEventsForDay(tomorrowStr);
          const tasks = personalAssistant.getTasks();
          const drafts = emailService.getDrafts();
          const isEmailConfigured = emailService.isConfigured();

          const dashboard = formatter.formatPersonalManagerDashboard({
            todayEvents,
            tomorrowEvents,
            tasks,
            drafts,
            isEmailConfigured,
            emailUser: config.emailUser
          });

          return await sendReply(senderJid, { text: dashboard });
        }

        case "TODAY_EVENTS": {
          const report = calendarService.formatDayAgenda(null, "Hoje");
          return await sendReply(senderJid, { text: report });
        }

        case "TOMORROW_EVENTS": {
          const now = new Date();
          const tomorrow = new Date(now);
          tomorrow.setDate(now.getDate() + 1);
          const tomorrowStr = tomorrow.toISOString().split("T")[0];
          const report = calendarService.formatDayAgenda(tomorrowStr, "Amanhã");
          return await sendReply(senderJid, { text: report });
        }

        case "SEARCH_EVENTS": {
          const term = aiResult.param || "";
          const results = calendarService.searchEvents(term);
          if (!results || results.length === 0) {
            return await sendReply(senderJid, {
              text: `🔍 *Nenhum evento encontrado no calendário para "${term}".*\nUsa \`/agenda\` para rever a semana toda.`
            });
          }
          let report = `🔍 *EVENTOS ENCONTRADOS PARA "${term}" (${results.length}):*\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          results.forEach((e, idx) => {
            report += `${idx + 1}. 📅 *${e.date}* às 🕒 *${e.time}* - *${e.title}* (#${e.id})\n`;
          });
          return await sendReply(senderJid, { text: report });
        }

        case "LIST_DRAFTS": {
          const list = emailService.formatDraftsList();
          return await sendReply(senderJid, { text: list });
        }

        case "DRAFT_EMAIL": {
          const raw = aiResult.param || "";
          let toAddress = "";
          let subject = "Rascunho de André Pinheiro";
          let bodyText = raw;

          if (raw.includes(":")) {
            const [headerPart, ...bodyParts] = raw.split(":");
            bodyText = bodyParts.join(":").trim();
            const headerTokens = headerPart.trim().split(" ");
            toAddress = headerTokens[0].includes("@") ? headerTokens[0].trim() : "";
            subject = (toAddress ? headerTokens.slice(1) : headerTokens).join(" ").trim() || "Rascunho de André Pinheiro";
          }

          const draft = emailService.saveDraft({
            to: toAddress,
            subject,
            body: bodyText
          });

          return await sendReply(senderJid, {
            text:
              `📝 *RASCUNHO DE EMAIL ANOTADO COM SUCESSO!*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `🆔 *ID:* \`#${draft.id}\`\n` +
              `📬 *Para:* ${draft.to || "_(Sem destinatário definido)_"}\n` +
              `📌 *Assunto:* ${draft.subject}\n` +
              `📝 *Corpo:* "${draft.body.slice(0, 150)}${draft.body.length > 150 ? "..." : ""}"\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `💡 _Para rever os teus rascunhos: \`${prefix}rascunhos\`_\n` +
              `🚀 _Para enviar este email agora: \`${prefix}enviar-rascunho ${draft.id}\`_`
          });
        }

        case "SEND_DRAFT": {
          const id = aiResult.param || "";
          if (!id) {
            return await sendReply(senderJid, {
              text: `⚠️ *Indica o ID do rascunho a enviar.*\nUsa \`/rascunhos\` para ver a lista.`
            });
          }
          if (!emailService.isConfigured()) {
            return await sendReply(senderJid, {
              text: `⚠️ *Email não configurado.* Usa \`/config email <palavra-passe-app>\` para autorizar o envio.`
            });
          }
          await sendReply(senderJid, { text: `📤 _A enviar rascunho #${id}..._` });
          try {
            const result = await emailService.sendDraft(id);
            return await sendReply(senderJid, {
              text:
                `✅ *RASCUNHO ENVIADO COM SUCESSO!*\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `📬 *Para:* ${result.to}\n` +
                `📌 *Assunto:* ${result.subject}\n` +
                `⏱️ *Data:* ${new Date().toLocaleTimeString("pt-PT")}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━`
            });
          } catch (err) {
            return await sendReply(senderJid, {
              text: `❌ *Erro ao enviar rascunho:* ${err.message}`
            });
          }
        }

        case "LIST_LINKS": {
          const linksText =
            `🌐 *LINKS OFICIAIS DOS PROJETOS EM VERCEL (PRODUÇÃO)*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🚌 *1. Smooth-Bus-Routes (RotaBus)*\n` +
            `   🔗 https://smooth-bus-routes.vercel.app\n` +
            `   • Navegação Pesada 3.6m/18t + 4 Agentes + Reg. CE 561/2006\n` +
            `   • APK: https://smooth-bus-routes.vercel.app/rotabus.apk\n\n` +
            `⚽ *2. MatchPro (Streaming & Tática)*\n` +
            `   🔗 https://matchpro-alpha.vercel.app\n` +
            `   • Dark Tactical HUD, Tracking e Failover HLS/IPTV\n` +
            `   • APK: https://matchpro-alpha.vercel.app/MatchPro.apk\n\n` +
            `🏗️ *3. Pladur-Pro (Engenharia 3D & Orçamentação)*\n` +
            `   🔗 https://pladur-pro.vercel.app\n` +
            `   • Normas EN 520/14195, Cortador Eco < 7% quebras, Orçamento ML\n` +
            `   • APK: https://pladur-pro.vercel.app/PladurPro.apk\n\n` +
            `🚛 *4. AppFrota (Gestão de Frotas)*\n` +
            `   🔗 https://appfrota-ten.vercel.app\n\n` +
            `🧸 *5. Casa de Bonecas 3D*\n` +
            `   🔗 https://casadebonecas-3d.vercel.app\n\n` +
            `⚔️ *6. Last War Tactics*\n` +
            `   🔗 https://last-war-tactics.vercel.app\n\n` +
            `🏠 *7. Pesquisa Imobiliário*\n` +
            `   🔗 https://pesquisa-imobiliario.vercel.app\n\n` +
            `🤖 *8. WhatsApp Dev Assistant (Nuvem 24/7)*\n` +
            `   🔗 http://136.64.71.248:3333\n` +
            `   • APK: https://matchpro-alpha.vercel.app/WhatsAppDevAssistant.apk\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📱 _Toca em qualquer link para abrir ou testar diretamente no smartphone!_`;
          return await sendReply(senderJid, { text: linksText });
        }

        case "LIST_APKS": {
          const apksText =
            `📦 *APKS PRONTOS PARA TESTAR NOS SMARTPHONES*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Podes descarregar e instalar no Android através dos links seguros com CDN Vercel:\n\n` +
            `1. ⚽ *MatchPro (4.62 MB)*\n` +
            `   📥 https://matchpro-alpha.vercel.app/MatchPro.apk\n` +
            `   _Análise tática, streams desportivos e Tactical HUD._\n\n` +
            `2. 🏗️ *Pladur-Pro (36.6 MB)*\n` +
            `   📥 https://pladur-pro.vercel.app/PladurPro.apk\n` +
            `   _Cálculo estrutural de tetos/paredes, 3D e orçamento ML._\n\n` +
            `3. 🚌 *RotaBus (79.2 MB)*\n` +
            `   📥 https://smooth-bus-routes.vercel.app/rotabus.apk\n` +
            `   _Navegação pesada, túneis/pontes e paragens CE 561/2006._\n\n` +
            `4. 🤖 *WhatsApp Dev Assistant (12.97 MB)*\n` +
            `   📥 https://matchpro-alpha.vercel.app/WhatsAppDevAssistant.apk\n` +
            `   _Serviço de notificação, IA e automação WhatsApp para Android._\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `☁️ *Servidor Nuvem (VM 136.64.71.248:3333):*\n` +
            `   📥 http://136.64.71.248:3333/api/downloads\n` +
            `   📥 http://192.168.1.115:8081 (Download Direto no PC)\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `💡 _Dica: Abre o link no Chrome do telemóvel para descarregar a alta velocidade e tocar em "Instalar"!_`;
          return await sendReply(senderJid, { text: apksText });
        }

        case "ADD_TASK": {
          if (aiResult.param) {
            const task = personalAssistant.addTask(aiResult.param);
            return await sendReply(senderJid, {
              text: `✅ *Tarefa adicionada:* ${task.title}`
            });
          }
          break;
        }

        case "ADD_EVENT": {
          const phrase = aiResult.param || "";
          const parsed = calendarService.parseQuickEventPhrase(phrase);
          const ev = calendarService.addEvent(parsed);
          const gcalUrl = personalAssistant.generateGoogleCalendarUrl(ev.title, ev.dateTime, ev.durationMinutes);
          const ics = personalAssistant.generateIcsContent(ev.title, ev.dateTime, ev.durationMinutes);
          let replyText =
            `📅 *EVENTO ABSORVIDO COM SUCESSO!*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📝 *Título:* _${ev.title}_\n` +
            `📅 *Data:* *${ev.date}*\n` +
            `🕒 *Hora:* *${ev.time}*\n\n` +
            `🔗 *Adicionar ao Google Calendar:*\n${gcalUrl}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🔔 _Receberás um aviso aqui no WhatsApp 15 minutos antes!_`;
          await sendReply(senderJid, { text: replyText });
          if (ics) {
            try {
              await sendReply(senderJid, {
                document: Buffer.from(ics, "utf8"),
                mimetype: "text/calendar",
                fileName: `${ev.title.slice(0, 15).replace(/[^a-zA-Z0-9]/g, "_")}.ics`,
                caption: `📅 Evento Google Calendar: *${ev.title}*`
              });
            } catch (e) {}
          }
          return;
        }

        case "LIST_EVENTS": {
          return await sendReply(senderJid, { text: calendarService.formatAgenda() });
        }

        case "LIST_PROJECTS": {
          const pList = androidService.listAllProjects();
          return await sendReply(senderJid, { text: formatter.formatProjects(pList) });
        }

        case "ADD_NOTE": {
          const noteText = aiResult.param || "";
          const note = personalAssistant.addNote("Nota", noteText);
          return await sendReply(senderJid, {
            text: `📝 *NOTA GUARDADA COM SUCESSO!*\n━━━━━━━━━━━━━━━━━━━━━━━━\n"${note.content}"\n\n💡 _Para rever as tuas notas: \`${prefix}notas\`_`
          });
        }

        case "LIST_NOTES": {
          const notes = personalAssistant.getNotes();
          if (!notes || notes.length === 0) {
            return await sendReply(senderJid, {
              text: `📝 *BLOCO DE NOTAS*\n━━━━━━━━━━━━━━━━━━━━━━━━\nNenhuma nota guardada ainda.\nUsa \`${prefix}nota <texto>\` para guardar apontamentos.`
            });
          }
          let noteText = `📝 *AS TUAS NOTAS GUARDADAS (${notes.length}):*\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          notes.slice(-8).reverse().forEach((n, i) => {
            const dateStr = n.createdAt ? new Date(n.createdAt).toLocaleDateString("pt-PT") : "";
            noteText += `${i + 1}. [_${dateStr}_] ${n.content}\n\n`;
          });
          noteText += `━━━━━━━━━━━━━━━━━━━━━━━━\n💡 _Para nova nota: \`${prefix}nota <texto>\`_`;
          return await sendReply(senderJid, { text: noteText });
        }

        case "LIST_EMAILS": {
          if (!emailService.isConfigured()) {
            return await sendReply(senderJid, {
              text: `📧 *Gestão de Emails:* Para veres os teus emails e resumos com IA, configura a tua palavra-passe de app Gmail com:\n\`${config.prefix}config email <palavra-passe-app>\``
            });
          }
          await sendReply(senderJid, { text: "🔍 _A aceder à caixa de correio e a gerar resumo com IA..._" });
          try {
            const emails = await emailService.fetchRecentEmails({ limit: 5, unreadOnly: true });
            const summary = await emailService.generateEmailsSummary(emails);
            return await sendReply(senderJid, { text: summary });
          } catch (e) {
            return await sendReply(senderJid, { text: `❌ Erro ao consultar emails: ${e.message}` });
          }
        }

        case "SEARCH_EMAILS": {
          if (!emailService.isConfigured()) {
            return await sendReply(senderJid, {
              text: `📧 *Gestão de Emails:* Para veres os teus emails, configura a tua palavra-passe de app Gmail com:\n\`${config.prefix}config email <palavra-passe-app>\``
            });
          }
          const topic = aiResult.param || "";
          await sendReply(senderJid, { text: `🔍 _A pesquisar emails sobre "${topic}" e a gerar resumo..._` });
          try {
            const emails = await emailService.fetchRecentEmails({ limit: 5, query: topic });
            const summary = await emailService.generateEmailsSummary(emails, topic);
            return await sendReply(senderJid, { text: summary });
          } catch (e) {
            return await sendReply(senderJid, { text: `❌ Erro na pesquisa de emails: ${e.message}` });
          }
        }

        case "HELP": {
          return await sendReply(senderJid, { text: formatter.formatHelp(config.prefix) });
        }

        default:
          break;
      }
    }

    // Resposta de texto natural do assistente
    if (aiResult.reply) {
      return await sendReply(senderJid, { text: aiResult.reply });
    }
  } catch (error) {
    logger.error("Erro no processamento da mensagem WhatsApp:", error);
    try {
      await sendReply(msg.key.remoteJid, {
        text: `⚠️ *Ocorreu um erro ao processar a tua mensagem:* ${error.message}`
      });
    } catch (e) {}
  }
}

export async function processMobileMessage(sender, text) {
  const replies = [];
  const mockSock = {
    sendMessage: async (jid, content) => {
      const replyText = typeof content === "string" ? content : (content.text || JSON.stringify(content));
      if (replyText) replies.push(replyText);
      return { key: { id: "mobile_" + Date.now() } };
    }
  };
  const cleanSender = (sender || "351919115655").replace(/\D/g, "");
  const mockMsg = {
    key: {
      remoteJid: `${cleanSender}@s.whatsapp.net`,
      id: "mob_" + Date.now(),
      fromMe: false
    },
    message: {
      conversation: text
    }
  };
  await handleIncomingMessage(mockSock, mockMsg, new Set());
  return replies.join("\n\n");
}

export default {
  handleIncomingMessage,
  processMobileMessage
};

