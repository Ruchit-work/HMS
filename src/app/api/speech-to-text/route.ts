import { NextRequest, NextResponse } from 'next/server'

/**
 * Google Cloud Speech-to-Text API endpoint
 *
 * Supports:
 * - Medical dictation (high accuracy, en-US only)
 * - General speech with Indian accent + Hinglish
 */

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const audioFile = formData.get('audio') as File | null
    const language = (formData.get('language') as string) || 'en-IN'
    const useMedicalModelParam = formData.get('useMedicalModel') === 'true'

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    // Credentials
    const apiKey = process.env.GOOGLE_CLOUD_SPEECH_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'Google Cloud Speech-to-Text not configured. Set GOOGLE_CLOUD_SPEECH_API_KEY.',
          fallback: 'Set useGoogleCloud={false} to use browser speech API'
        },
        { status: 503 }
      )
    }

    // Convert audio → base64
    const buffer = await audioFile.arrayBuffer()
    const base64Audio = Buffer.from(buffer).toString('base64')

    // Decide model
    const useMedicalModel =
      useMedicalModelParam || process.env.USE_MEDICAL_MODEL === 'true'

    const model = useMedicalModel ? 'medical_dictation' : 'latest_long'

    // Medical models only support en-US
    const effectiveLanguage =
      useMedicalModel && language === 'en-IN' ? 'en-US' : language

    /**
     * IMPORTANT:
     * - medical_* models ❌ DO NOT support:
     *   - alternativeLanguageCodes
     *   - useEnhanced
     */
    const config: any = {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 48000,
      languageCode: effectiveLanguage,
      enableAutomaticPunctuation: true,
      enableSpokenPunctuation: true,
      enableSpokenEmojis: false
    }

    if (useMedicalModel) {
      // ✅ Medical-safe config
      config.model = 'medical_dictation'
    } else {
      // ✅ General speech (Indian accent + Hinglish)
      config.model = 'latest_long'
      config.useEnhanced = true

      if (language === 'en-IN') {
        config.alternativeLanguageCodes = ['hi-IN']
      }
    }

    const requestBody = {
      config,
      audio: {
        content: base64Audio
      }
    }

    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Google Cloud Speech API error:', errorData)

      return NextResponse.json(
        { error: errorData.error?.message || 'Speech recognition failed' },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (!data.results || data.results.length === 0) {
      return NextResponse.json(
        { text: '', message: 'No speech detected' },
        { status: 200 }
      )
    }

    const bestResult = data.results[0].alternatives[0]

    return NextResponse.json({
      text: bestResult.transcript,
      confidence: bestResult.confidence ?? 0
    })
  } catch (error) {
    console.error('Speech-to-text error:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Internal server error'
      },
      { status: 500 }
    )
  }
}
