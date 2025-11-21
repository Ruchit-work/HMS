export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WHATSAPP_ACCESS_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("WEBHOOK RECEIVED:", JSON.stringify(body, null, 2));

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body ?? "";

      const reply = text
        ? `How can I help you? You said: ${text}`
        : "Hi! How can I assist you today?";

      await sendWhatsAppMessage(from, reply);
    }

    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (err) {
    console.error("Webhook Error:", err);
    return new Response("Error", { status: 500 });
  }
}

async function sendWhatsAppMessage(rawTo: string, message: string) {
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.META_WHATSAPP_VERIFY_TOKEN;

  if (!phoneNumberId || !token) {
    console.error("Missing WhatsApp credentials: WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_TOKEN");
    return;
  }

  const to = rawTo.startsWith("+") ? rawTo : `+${rawTo}`;
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      text: { body: message },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Error sending WhatsApp message:", data);
  } else {
    console.log("Outbound WhatsApp message sent:", data);
  }
}

function formatPhoneNumber(phone: string) {
  if (!phone) return phone;
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return trimmed;
  return `+${trimmed}`;
}
