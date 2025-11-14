export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      chiefComplaint, 
      medicalHistory, 
      patientInfo, 
      allergies, 
      currentMedications,
      patientAge,
      patientGender 
    } = body || {};

    if (!chiefComplaint || typeof chiefComplaint !== "string" || chiefComplaint.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Missing required field: chiefComplaint" }), {
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

    // Build prompt for prescription generation - SHORT AND CONCISE
    const systemPrompt =
      "You are a clinical decision support assistant for licensed physicians in India. " +
      "Generate SHORT, CONCISE prescriptions. " +
      "CRITICAL: You MUST output ONLY medicines in the exact format below. DO NOT include notes, diagnosis, or any other text. " +
      "RULES: " +
      "1. Only medications available in India. " +
      "2. NEVER suggest medications patient is allergic to. " +
      "3. Check current medications for interactions. " +
      "4. Format: Medicine Name [Dosage] - Frequency for Duration (one medicine per line). " +
      "5. Keep prescription SHORT (max 3-4 medicines). " +
      "6. Output ONLY the medicine list, nothing else. " +
      "Output format (ONLY medicines, no other text):\n" +
      "Medicine Name [Dosage] - Frequency for Duration\n" +
      "Medicine Name [Dosage] - Frequency for Duration\n" +
      "Medicine Name [Dosage] - Frequency for Duration";

    let userPrompt = `Generate a prescription for the following patient:\n\n`;
    userPrompt += `Chief Complaint: ${chiefComplaint}\n\n`;
    
    if (patientInfo) {
      userPrompt += `Patient Information: ${patientInfo}\n\n`;
    }
    
    if (patientAge) {
      userPrompt += `Age: ${patientAge} years\n`;
    }
    
    if (patientGender) {
      userPrompt += `Gender: ${patientGender}\n`;
    }
    
    if (medicalHistory) {
      userPrompt += `Medical History: ${medicalHistory}\n\n`;
    }
    
    if (allergies) {
      userPrompt += `⚠️ CRITICAL - PATIENT ALLERGIES (DO NOT PRESCRIBE THESE): ${allergies}\n\n`;
    }
    
    if (currentMedications) {
      userPrompt += `Current Medications (check for interactions): ${currentMedications}\n\n`;
    }
    
    userPrompt += `\nGenerate an appropriate prescription considering all the above information.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        max_tokens: 500,
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

    // Clean the content - remove any "NOTES:" or "MEDICINES:" labels and everything after them
    let medicine = content.trim();
    
    // Remove "MEDICINES:" or "MEDICINE:" prefix if present
    medicine = medicine.replace(/^MEDICINES?:?\s*/i, "");
    
    // Remove everything after "NOTES:" or "NOTE:" if present
    const notesIndex = medicine.search(/NOTES?:/i);
    if (notesIndex !== -1) {
      medicine = medicine.substring(0, notesIndex).trim();
    }
    
    // Remove everything after "GENERAL ADVICE:" or "FOLLOW-UP:" if present
    const adviceIndex = medicine.search(/GENERAL ADVICE:|FOLLOW-UP:/i);
    if (adviceIndex !== -1) {
      medicine = medicine.substring(0, adviceIndex).trim();
    }
    
    // Clean up any extra whitespace or newlines
    medicine = medicine.split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && !line.match(/^(NOTES?|MEDICINES?|GENERAL ADVICE|FOLLOW-UP):?$/i))
      .join('\n')
      .trim();

    // Return only medicine - notes will be left for doctor to write
    return new Response(JSON.stringify({ 
      medicine: medicine || content.trim(),
      notes: "" // Empty - doctor writes notes based on their preference
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: (e as Error)?.message || "Unexpected server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

