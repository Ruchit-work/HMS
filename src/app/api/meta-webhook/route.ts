import { NextRequest, NextResponse } from "next/server";

const VERIFY_TOKEN = "harmony_verify_token_97431d8b";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  } else {
    return new NextResponse("Forbidden", { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("🔔 Incoming Webhook:", body);

    return NextResponse.json({ status: "received" }, { status: 200 });
  } catch (error) {
    console.error("❌ Webhook Error:", error);
    return new NextResponse("Error", { status: 500 });
  }
}
