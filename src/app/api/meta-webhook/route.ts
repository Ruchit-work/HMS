import { NextRequest, NextResponse } from "next/server";

const VERIFY_TOKEN = "harmony_verify_token_97431d8b";

// =====================================================
// GET → For VERIFY & SAVE
// =====================================================
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Invalid token", { status: 403 });
}

// =====================================================
// POST → Incoming messages
// =====================================================
export async function POST(req: NextRequest) {
  const body = await req.json();
  console.log("WEBHOOK EVENT:", JSON.stringify(body, null, 2));

  return NextResponse.json({ status: "received" }, { status: 200 });
}
