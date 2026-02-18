import { NextRequest, NextResponse } from 'next/server'

/**
 * Azure Speech Services API endpoint
 * 
 * Alternative to Google Cloud with better pricing:
 * - Real-time: $0.0167/min ($1/hour)
 * - Batch: $0.006/min ($0.36/hour) 
 * - Free tier: 5 hours/month (better than Google's 60 minutes)
 * 
 * Setup Instructions:
 * 1. Create Azure Speech resource in Azure Portal
 * 2. Get subscription key and region
 * 3. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION environment variables
 */

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File
    const language = (formData.get('language') as string) || 'en-IN'

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    const subscriptionKey = process.env.AZURE_SPEECH_KEY
    const region = process.env.AZURE_SPEECH_REGION || 'eastus'

    if (!subscriptionKey) {
      return NextResponse.json(
        { 
          error: 'Azure Speech Services not configured. Please set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION environment variables.',
          fallback: 'Use Google Cloud Speech-to-Text instead'
        },
        { status: 503 }
      )
    }

    // Convert audio file to array buffer
    const arrayBuffer = await audioFile.arrayBuffer()
    const audioData = Buffer.from(arrayBuffer)

    // Get access token
    const tokenResponse = await fetch(
      `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          'Content-Length': '0'
        }
      }
    )

    if (!tokenResponse.ok) {
      throw new Error('Failed to get Azure access token')
    }

    const accessToken = await tokenResponse.text()

    // Convert audio to base64 for Azure API
    const base64Audio = audioData.toString('base64')

    // Azure Speech-to-Text API endpoint
    const apiUrl = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${language}&format=detailed`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'audio/webm; codecs=opus',
        'Accept': 'application/json'
      },
      body: audioData
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Azure Speech API error:', errorText)
      return NextResponse.json(
        { error: `Azure Speech API error: ${errorText}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    if (data.RecognitionStatus !== 'Success' || !data.DisplayText) {
      return NextResponse.json(
        { text: '', message: data.RecognitionStatus || 'No speech detected' },
        { status: 200 }
      )
    }

    return NextResponse.json({
      text: data.DisplayText,
      confidence: data.Confidence || 0
    })
  } catch (error) {
    console.error('Azure Speech-to-text error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
