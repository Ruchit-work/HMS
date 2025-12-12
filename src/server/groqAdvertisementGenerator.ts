/**
 * Groq API Service for Generating Advertisements
 * Uses Groq API to generate compelling advertisements for health awareness days
 */

import type { HealthAwarenessDay } from "./healthAwarenessDays"

export interface GeneratedAdvertisement {
  title: string
  content: string
  ctaText: string
  ctaHref: string
  shortMessage?: string // For WhatsApp notifications
}

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
// Try multiple models in order of preference - if one fails with 403, try the next
// Updated list based on available models (some models have been decommissioned)
const GROQ_MODELS = [
  "llama-3.1-8b-instant",      // Most commonly available - WORKING ✅
  "llama-3.3-70b-versatile",   // Latest model - WORKING ✅
  // Deprecated models removed:
  // - llama-3.2-11b-v2.1 (does not exist)
  // - llama-3.2-90b-v2.1 (does not exist)
  // - llama-3.1-70b-versatile (decommissioned)
  // - mixtral-8x7b-32768 (decommissioned)
  // - gemma-7b-it (decommissioned)
  // - gemma2-9b-it (decommissioned)
]
// Allow override via environment variable
// const GROQ_MODEL = process.env.GROQ_MODEL || GROQ_MODELS[0] // Not currently used

/**
 * Generate an advertisement using Groq API for a health awareness day
 */
export async function generateAdvertisement(
  healthDay: HealthAwarenessDay,
  hospitalName: string = "Harmony Medical Services"
): Promise<GeneratedAdvertisement> {
  const apiKey = process.env.GROQ_API_KEY

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set in environment variables")
  }

  const systemPrompt = `You are a marketing expert for a healthcare organization in India. Your task is to create compelling, informative, and engaging advertisements for health awareness days.

Guidelines:
1. Keep the tone professional yet friendly and approachable
2. Use simple, clear language that is easy to understand
3. Focus on prevention, early detection, and available services
4. Include a clear call-to-action
5. Make it relevant to Indian patients and healthcare context
6. Emphasize the importance of the health issue and encourage action
7. Keep content concise but informative
8. Use appropriate medical terminology but explain when needed

Format your response as JSON with the following structure:
{
  "title": "Campaign title (max 60 characters, keep it concise and engaging)",
  "content": "Main advertisement content in HTML format (2-3 short paragraphs max, keep it concise - first paragraph should be the most important, can include <p>, <strong>, <em> tags but avoid long lists)",
  "ctaText": "Call-to-action button text (e.g., 'Book Appointment', 'Learn More', 'Get Checked Today')",
  "ctaHref": "URL path for the CTA (e.g., '/patient-dashboard/book-appointment')",
  "shortMessage": "Short WhatsApp message version (max 200 characters, plain text, no HTML)"
}

IMPORTANT: Keep the content concise and engaging. The first paragraph should summarize the key message. Avoid long paragraphs or excessive details. Focus on the most important information that will encourage action.`

  const userPrompt = `Create an advertisement for ${healthDay.name} (${healthDay.description}).

Context:
- Hospital Name: ${hospitalName}
- Date: ${healthDay.date}
- Keywords: ${healthDay.keywords.join(", ")}
- Target Audience: ${healthDay.targetAudience}
${healthDay.specialization ? `- Related Specializations: ${healthDay.specialization.join(", ")}` : ""}

The advertisement should:
1. Raise awareness about ${healthDay.name}
2. Explain why this health issue is important
3. Encourage patients to take preventive action or get checked
4. Highlight available services at ${hospitalName}
5. Include a clear call-to-action to book an appointment or learn more

Make it engaging, informative, and actionable. Remember, this is for Indian patients, so use relevant examples and context.`

  // Try models in order until one works
  let lastError: Error | null = null
  const modelsToTry = process.env.GROQ_MODEL 
    ? [process.env.GROQ_MODEL, ...GROQ_MODELS.filter(m => m !== process.env.GROQ_MODEL)]
    : GROQ_MODELS
  
  for (const model of modelsToTry) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          temperature: 0.7,
          max_tokens: 1000,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error")
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: { message: errorText } }
        }
        const errorMessage = errorData?.error?.message || response.statusText || errorText
        console.error(`[groq] API error (${response.status}) for model ${model}:`, errorMessage)
        
        // For 401 errors (Invalid API Key), throw immediately - no point trying other models
        if (response.status === 401) {
          throw new Error(
            `Groq API error (401): Invalid API Key. This means:\n` +
            `1. Your API key is incorrect or invalid\n` +
            `2. Your API key may have been revoked or expired\n` +
            `3. Check your .env.local file - make sure GROQ_API_KEY is set correctly\n` +
            `4. Verify your API key in Groq Console: https://console.groq.com/keys\n` +
            `5. Create a new API key if needed: https://console.groq.com/keys\n` +
            `6. Make sure there are no extra spaces or quotes around the API key\n` +
            `7. Restart your dev server after updating .env.local`
          )
        }
        
        // For 404 errors or decommissioned models, try next model
        if (response.status === 404 || 
            errorMessage?.includes("does not exist") || 
            errorMessage?.includes("decommissioned") ||
            errorMessage?.includes("model_not_found") ||
            errorMessage?.includes("model_decommissioned")) {
          console.warn(`[groq] Model ${model} not available (${response.status}): ${errorMessage}`)
          if (model === modelsToTry[modelsToTry.length - 1]) {
            // Last model, don't try again
            lastError = new Error(`Model ${model} not available: ${errorMessage}`)
          } else {
            lastError = new Error(`Model ${model} not available: ${errorMessage}`)
            continue // Try next model
          }
        }
        
        // For 403 errors, try next model (access denied - key valid but no access to model)
        if (response.status === 403) {
          console.warn(`[groq] Model ${model} access denied (403), trying next model...`)
          lastError = new Error(`Model ${model} access denied (403): ${errorMessage}`)
          continue // Try next model
        }
        
        // For other errors, throw immediately
        throw new Error(
          `Groq API error (${response.status}) for model ${model}: ${errorMessage}`
        )
      }

      // Success! Parse the response
      const data = await response.json()
      const content = data?.choices?.[0]?.message?.content

      if (!content) {
        console.error("[groq] No content in response:", JSON.stringify(data, null, 2))
        throw new Error("No content received from Groq API")
      }

      // Parse JSON response
      let advertisement: GeneratedAdvertisement
      try {
        advertisement = JSON.parse(content)
      } catch {
        // If JSON parsing fails, try to extract JSON from markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
        if (jsonMatch) {
          advertisement = JSON.parse(jsonMatch[1])
        } else {
          throw new Error("Failed to parse JSON response from Groq API")
        }
      }

      // Validate required fields
      if (!advertisement.title || !advertisement.content) {
        throw new Error("Invalid advertisement format: missing required fields")
      }

      // Set defaults for optional fields
      advertisement.ctaText = advertisement.ctaText || "Book Appointment"
      advertisement.ctaHref = advertisement.ctaHref || "/patient-dashboard/book-appointment"
      advertisement.shortMessage = advertisement.shortMessage || advertisement.title

      return advertisement
    } catch (error) {
      // Check if this is the last model
      const isLastModel = model === modelsToTry[modelsToTry.length - 1]
      
      // For 401 errors (Invalid API Key), throw immediately
      if (error instanceof Error && error.message.includes("401")) {
        throw error
      }
      
      // For decommissioned or not found models, try next model (unless it's the last)
      if (error instanceof Error && (
        error.message.includes("does not exist") ||
        error.message.includes("decommissioned") ||
        error.message.includes("model_not_found") ||
        error.message.includes("model_decommissioned") ||
        error.message.includes("404")
      )) {
        lastError = error
        if (isLastModel) {
          throw error
        }
        continue
      }
      
      // For 403 errors on non-last model, try next model
      if (error instanceof Error && (error.message.includes("403") || error.message.includes("access denied"))) {
        lastError = error
        if (isLastModel) {
          throw error
        }
        continue
      }
      
      // If this is the last model, throw the error
      if (isLastModel) {
        if (error instanceof Error) {
          throw error
        }
        throw new Error("Unknown error while generating advertisement")
      }
      
      // For other errors on non-last model, try next model
      if (error instanceof Error) {
        lastError = error
        continue
      }
      
      throw new Error("Unknown error while generating advertisement")
    }
  }

  // If we get here, all models failed with 403
  if (lastError) {
    throw new Error(
      `All models failed with access denied (403). This usually means:\n` +
      `1. Your API key doesn't have access to any of the models: ${modelsToTry.join(", ")}\n` +
      `2. Your API key might be invalid or expired\n` +
      `3. Your account might have restrictions\n` +
      `4. Check your Groq Console for model permissions: https://console.groq.com/docs/model-permissions\n` +
      `5. Verify your API key is correct in .env.local\n` +
      `6. Try creating a new API key in Groq Console: https://console.groq.com/keys\n` +
      `7. You can set GROQ_MODEL environment variable to specify which model to use`
    )
  }
  
  throw new Error("Failed to generate advertisement: Unknown error")
}

/**
 * Generate multiple advertisements for multiple health awareness days
 */
export async function generateAdvertisements(
  healthDays: HealthAwarenessDay[],
  hospitalName: string = "Harmony Medical Services"
): Promise<Map<string, GeneratedAdvertisement>> {
  const results = new Map<string, GeneratedAdvertisement>()
  const errors: Array<{ day: string; error: string }> = []

  // Generate advertisements in parallel (with rate limiting consideration)
  const promises = healthDays.map(async (day) => {
    try {
      const advertisement = await generateAdvertisement(day, hospitalName)
      results.set(day.name, advertisement)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error(`Failed to generate advertisement for ${day.name}:`, errorMessage)
      errors.push({ day: day.name, error: errorMessage })
      // Continue with other days even if one fails
    }
  })

  await Promise.all(promises)

  // If all advertisements failed, throw an error with details
  if (results.size === 0 && errors.length > 0) {
    const errorMessages = errors.map((e) => `${e.day}: ${e.error}`).join("; ")
    throw new Error(`Failed to generate any advertisements. Errors: ${errorMessages}`)
  }

  // If some failed but not all, log a warning
  if (errors.length > 0 && results.size > 0) {
    console.warn(`Generated ${results.size} advertisements, but ${errors.length} failed:`, errors)
  }

  return results
}
