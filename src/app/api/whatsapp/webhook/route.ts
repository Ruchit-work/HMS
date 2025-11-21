import { NextResponse } from "next/server";

const VERIFY_TOKEN = process.env.META_WHATSAPP_VERIFY_TOKEN || "harmony_verify_token_97431d8b";

// GET → Meta verification
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified successfully!");
    return new NextResponse(challenge || "", { status: 200 });
  } else {
    console.log("❌ Webhook verification failed");
    return new NextResponse("Forbidden", { status: 403 });
  }
}

// POST → Receive incoming messages
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("Incoming webhook:", JSON.stringify(body, null, 2));

    // Here you can handle messages, button clicks, etc.

    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("Webhook POST error:", error);
    return new NextResponse("Error", { status: 500 });
  }
}
