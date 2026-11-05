/**
 * WhatsApp Cloud API Client (Meta Graph API v18.0+)
 * Handles dispatching outbound messages via the configured Sender Phone Number.
 */

export interface WhatsAppTextMessagePayload {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "text";
  text: {
    preview_url?: boolean;
    body: string;
  };
}

export interface WhatsAppApiResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

export interface WhatsAppApiError {
  error: {
    message: string;
    type: string;
    code: number;
    error_data?: {
      messaging_product: string;
      details: string;
    };
    error_subcode?: number;
    fbtrace_id: string;
  };
}

/**
 * Sends a text message to a WhatsApp user using Meta Cloud API.
 *
 * @param to Recipient phone number in E.164 format without '+' or special characters (e.g. "351912101839")
 * @param text Content of the message to be delivered
 * @returns WhatsAppApiResponse
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string
): Promise<WhatsAppApiResponse> {
  const token = process.env.WHATSAPP_SENDER_TOKEN;
  const phoneId = process.env.WHATSAPP_SENDER_PHONE_ID;

  if (!token) {
    throw new Error("Missing required environment variable: WHATSAPP_SENDER_TOKEN");
  }
  if (!phoneId) {
    throw new Error("Missing required environment variable: WHATSAPP_SENDER_PHONE_ID");
  }

  const cleanRecipient = to.replace(/\D/g, "");
  if (!cleanRecipient) {
    throw new Error(`Invalid recipient phone number: ${to}`);
  }

  const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`;

  const payload: WhatsAppTextMessagePayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanRecipient,
    type: "text",
    text: {
      preview_url: false,
      body: text,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseData = await response.json();

  if (!response.ok) {
    const errorData = responseData as WhatsAppApiError;
    const errorMessage =
      errorData.error?.message || `WhatsApp Cloud API request failed with status ${response.status}`;
    console.error("[WhatsApp Cloud API Error]", JSON.stringify(errorData, null, 2));
    throw new Error(`WhatsApp API Error (${response.status}): ${errorMessage}`);
  }

  return responseData as WhatsAppApiResponse;
}

