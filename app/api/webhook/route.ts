import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

// ============================================================================
// META WEBHOOK TYPE DEFINITIONS
// ============================================================================

interface MetaWebhookMessageText {
  body: string;
}

interface MetaWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: MetaWebhookMessageText;
}

interface MetaWebhookContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

interface MetaWebhookValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: MetaWebhookContact[];
  messages?: MetaWebhookMessage[];
  statuses?: unknown[];
}

interface MetaWebhookChange {
  field: string;
  value: MetaWebhookValue;
}

interface MetaWebhookEntry {
  id: string;
  changes: MetaWebhookChange[];
}

interface MetaWebhookPayload {
  object: string;
  entry?: MetaWebhookEntry[];
}

// ============================================================================
// 1. GET: WEBHOOK CHALLENGE VERIFICATION (Meta Graph API)
// ============================================================================

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!expectedToken) {
    console.error("[Webhook Verification Error] WHATSAPP_VERIFY_TOKEN is not configured.");
    return new Response("Internal Server Error: Missing verification token", { status: 500 });
  }

  // Meta Webhook subscription handshake
  if (mode === "subscribe" && token === expectedToken) {
    console.log("[Webhook Verification] Challenge verified successfully.");
    return new Response(challenge || "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn(`[Webhook Verification Failed] Mode: ${mode}, Token mismatch.`);
  return new Response("Forbidden", { status: 403 });
}

// ============================================================================
// 2. POST: INCOMING MESSAGE INGESTION & DISPATCH PIPELINE
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: MetaWebhookPayload = await request.json();

    // Verify root object
    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ error: "Invalid webhook object" }, { status: 400 });
    }

    const entries = body.entry || [];

    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value;
        const messages = value.messages || [];

        for (const message of messages) {
          // Process only incoming user text messages (ignore delivery receipts, status updates)
          if (message.type !== "text" || !message.text?.body) {
            continue;
          }

          const senderPhone = message.from;
          const rawText = message.text.body.trim();

          await processIncomingMessage(senderPhone, rawText);
        }
      }
    }

    // Acknowledge event receipt to Meta immediately (200 OK prevents webhook retry loops)
    return NextResponse.json({ status: "EVENT_RECEIVED" }, { status: 200 });
  } catch (error) {
    console.error("[Webhook Pipeline Error]", error instanceof Error ? error.message : error);
    // Return 200 even on handling failure to satisfy Meta webhook acknowledgment
    return NextResponse.json({ status: "EVENT_HANDLED_WITH_ERROR" }, { status: 200 });
  }
}

// ============================================================================
// CORE MESSAGE PROCESSING PIPELINE (Router: PC Bridge vs. Cloud 24/7)
// ============================================================================

async function processIncomingMessage(sender: string, messageText: string): Promise<void> {
  const isPcCommand = messageText.toLowerCase().startsWith("/pc");

  if (isPcCommand) {
    // ------------------------------------------------------------------------
    // BRANCH A: PC Command Bridge
    // ------------------------------------------------------------------------
    const commandPayload = messageText.slice(3).trim();

    console.log(`[PC Bridge] Captured command from ${sender}: "${commandPayload}"`);

    // In a full cloud setup, commandPayload can be persisted to a KV/Database (e.g. Vercel KV, Redis, Supabase)
    // for polling or WebSocket dispatch by the local environment.
    const replyText = commandPayload
      ? `🖥️ *[PC Bridge]* Ordem registada para execução local:\n\`${commandPayload}\`\n\n_A aguardar sincronização com o ambiente de desenvolvimento local._`
      : `🖥️ *[PC Bridge]* Comando vazio. Formato esperado: \`/pc <comando ou instrução>\``;

    await sendWhatsAppMessage(sender, replyText);
  } else {
    // ------------------------------------------------------------------------
    // BRANCH B: Cloud Assistant (24/7)
    // ------------------------------------------------------------------------
    console.log(`[Cloud Assistant] Processing query from ${sender}: "${messageText}"`);

    const cloudReply = await handleCloudQuery(messageText);
    await sendWhatsAppMessage(sender, cloudReply);
  }
}

/**
 * Handles autonomous cloud assistant queries (AI, general assistance, task capture).
 */
async function handleCloudQuery(query: string): Promise<string> {
  // If a cloud AI key is configured (e.g. GEMINI_API_KEY), route dynamically
  if (process.env.GEMINI_API_KEY) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Você é um assistente pessoal inteligente na nuvem (24/7). Seja conciso, prestativo e use markdown suportado pelo WhatsApp (*negrito*, _itálico_, \`código\`). Mensagem do utilizador: ${query}`,
                  },
                ],
              },
            ],
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidate) {
          return candidate.trim();
        }
      }
    } catch (e) {
      console.error("[Cloud AI Error]", e);
    }
  }

  // Deterministic Cloud Fallback (no conversational fluff)
  const lower = query.toLowerCase();
  if (lower === "/ajuda" || lower === "/help" || lower === "ajuda") {
    return (
      `🤖 *Assistente WhatsApp (Nuvem 24/7)*\n━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Comandos Cloud:* Envie qualquer pergunta, tarefa ou lembrete diretamente.\n` +
      `• *Ponte PC:* Envie \`/pc <ordem>\` para direcionar a execução para o computador de desenvolvimento.\n` +
      `━━━━━━━━━━━━━━━━━━━━`
    );
  }

  return (
    `☁️ *[Cloud Assistant]* Recebido: "${query}"\n\n` +
    `_Para enviar comandos ao computador de desenvolvimento use o prefixo \`/pc <ordem>\`._`
  );
}

