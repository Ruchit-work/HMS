import { authenticateRequest } from "@/utils/firebase/apiAuth"

export async function POST(req) {
  try {
    // Authenticate request - requires doctor role
    const auth = await authenticateRequest(req, "doctor")
    if (!auth.success) {
      // Return more detailed error response with the actual error message
      return Response.json(
        { 
          error: auth.error || "Authentication failed",
          details: {
            statusCode: auth.statusCode,
            reason: auth.error || "Unknown authentication error"
          }
        },
        { status: auth.statusCode || 403 }
      )
    }

    try {
    const body = await req.json();
    const { symptoms, patientInfo, medicalHistory } = body || {};

    if (!symptoms || typeof symptoms !== "string" || symptoms.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Missing required field: symptoms" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server misconfiguration: GROQ_API_KEY is not set" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build strict prompt instructing the model to output only what it is confident about
    const systemPrompt =
      "note that : you are in india and the patient is also from india" +"show data according to indian patient"+
      "You are a clinical decision support assistant for licensed physicians. " +
      "Output only evidence-based, non-fabricated information. If uncertain or not enough information, explicitly write 'Not generated'. " +
      "Never invent tests, diagnoses, or treatments. Do not include any placeholders except 'Not generated'. " +
      "Structure the output with the following exact section headings in bold: **PRELIMINARY DIAGNOSIS:**, **RECOMMENDED TESTS:**, **TREATMENT RECOMMENDATIONS:**, **WHEN TO SEEK IMMEDIATE CARE:**, **ADDITIONAL NOTES:**. " +
      "List tests as a numbered list. Keep language concise and clinical.";

    const userPrompt = `Patient presentation:\n- Symptoms: ${symptoms}\n- Medical history: ${medicalHistory || ""}\n- Patient info: ${patientInfo || ""}\n\nRespond with the exact sections as instructed.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        max_tokens: 800,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: err?.error?.message || "Groq API error" }), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content || "";

    // Keep the existing frontend contract: array with { generated_text }
    return new Response(JSON.stringify([{ generated_text: content }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    } catch (e) {
      return new Response(JSON.stringify({ error: e?.message || "Unexpected server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (outerError) {
    return Response.json(
      { 
        error: "Authentication setup failed. Please check server configuration.",
        details: {
          message: outerError?.message || "Unknown error",
          type: outerError?.name || "Error"
        }
      },
      { status: 500 }
    )
  }
}


