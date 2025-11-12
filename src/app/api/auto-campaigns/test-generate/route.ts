/**
 * Test endpoint to manually generate a test campaign
 * This endpoint creates a test campaign regardless of health awareness days
 * Useful for testing if campaigns are being created and displayed correctly
 */

import { NextResponse } from "next/server"
import admin from "firebase-admin"
import { generateAdvertisements } from "@/server/groqAdvertisementGenerator"
import { getHealthAwarenessDaysForDate } from "@/server/healthAwarenessDays"
import { slugify } from "@/utils/campaigns"

function initAdmin() {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    let privateKey = process.env.FIREBASE_PRIVATE_KEY

    if (privateKey && privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1)
    }
    if (privateKey) {
      privateKey = privateKey.replace(/\\n/g, "\n")
    }

    if (!projectId || !clientEmail || !privateKey) {
      console.error("Firebase Admin env vars missing for test-generate API.")
      return false
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    })
  }
  return true
}

/**
 * POST /api/auto-campaigns/test-generate
 * Body: { healthDayName?: string, date?: string }
 * 
 * This endpoint generates a test campaign for a specific health awareness day
 * If no healthDayName is provided, it uses World Heart Day as default
 * If date is provided (format: "MM-DD"), it uses that date for testing
 */
export async function POST(request: Request) {
  try {
    console.log("[test-generate] Starting test campaign generation...")
    
    // Check environment variables
    if (!process.env.GROQ_API_KEY) {
      console.error("[test-generate] GROQ_API_KEY is not set")
      return NextResponse.json(
        { 
          success: false,
          error: "GROQ_API_KEY is not set in environment variables",
          hint: "Please set GROQ_API_KEY in your .env.local file"
        },
        { status: 500 }
      )
    }

    const ok = initAdmin()
    if (!ok) {
      console.error("[test-generate] Firebase Admin initialization failed")
      return NextResponse.json(
        { 
          success: false,
          error: "Server not configured for admin",
          hint: "Please check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in your .env.local file"
        },
        { status: 500 }
      )
    }

    console.log("[test-generate] Firebase Admin initialized successfully")

    const body = await request.json().catch((err) => {
      console.error("[test-generate] Error parsing request body:", err)
      return {}
    })
    const healthDayName = body.healthDayName || "World Heart Day"
    const dateStr = body.date // Format: "MM-DD" (e.g., "09-29")

    console.log(`[test-generate] Health day name: ${healthDayName}, Date: ${dateStr || "not provided"}`)

    // Import health awareness days
    let healthDay
    try {
      const { HEALTH_AWARENESS_DAYS } = await import("@/server/healthAwarenessDays")
      healthDay = HEALTH_AWARENESS_DAYS.find((day) => day.name === healthDayName)
      console.log(`[test-generate] Found health day in database: ${!!healthDay}`)
    } catch (err) {
      console.error("[test-generate] Error importing health awareness days:", err)
      throw new Error(`Failed to import health awareness days: ${err instanceof Error ? err.message : "Unknown error"}`)
    }

    // If not found or date is provided, create a test day
    if (!healthDay || dateStr) {
      const testDate = dateStr || "09-29" // Default to World Heart Day date
      healthDay = {
        name: healthDayName,
        date: testDate,
        description: `Test campaign for ${healthDayName}`,
        keywords: ["test", "campaign", "health"],
        targetAudience: "all" as const,
        priority: 5,
        specialization: ["General Physician"],
      }
      console.log(`[test-generate] Created test health day: ${healthDay.name}`)
    }

    // Generate advertisement using Groq API
    console.log("[test-generate] Generating advertisement using Groq API...")
    const hospitalName = process.env.HOSPITAL_NAME || "Harmony Medical Services"
    let advertisements
    try {
      advertisements = await generateAdvertisements([healthDay], hospitalName)
      console.log("[test-generate] Advertisement generated successfully")
    } catch (err) {
      console.error("[test-generate] Error generating advertisement:", err)
      throw new Error(`Failed to generate advertisement: ${err instanceof Error ? err.message : "Unknown error"}`)
    }

    const advertisement = advertisements.get(healthDay.name)

    if (!advertisement) {
      console.error("[test-generate] No advertisement found in results")
      console.error("[test-generate] Generated advertisements:", Array.from(advertisements.keys()))
      console.error("[test-generate] Looking for:", healthDay.name)
      return NextResponse.json(
        { 
          success: false,
          error: "Failed to generate advertisement",
          hint: "Check Groq API response and logs. The advertisement may have failed to generate.",
          details: {
            healthDayName: healthDay.name,
            generatedKeys: Array.from(advertisements.keys()),
            mapSize: advertisements.size,
          }
        },
        { status: 500 }
      )
    }

    console.log(`[test-generate] Advertisement title: ${advertisement.title}`)

    const db = admin.firestore()
    const targetDate = new Date()
    targetDate.setHours(0, 0, 0, 0)

    // Check if campaign already exists (simplified query to avoid index issues)
    console.log("[test-generate] Checking for existing campaigns...")
    let existingCampaigns
    try {
      // Try with metadata query first
      existingCampaigns = await db
        .collection("campaigns")
        .where("metadata.healthAwarenessDay", "==", healthDay.name)
        .where("metadata.autoGenerated", "==", true)
        .limit(1)
        .get()
    } catch (queryError: any) {
      console.warn("[test-generate] Metadata query failed, trying alternative approach:", queryError.message)
      // If metadata query fails (index issue), just check by slug
      try {
        existingCampaigns = await db
          .collection("campaigns")
          .where("slug", "==", slugify(healthDay.name))
          .limit(5)
          .get()
        // Filter for auto-generated campaigns
        existingCampaigns = {
          ...existingCampaigns,
          docs: existingCampaigns.docs.filter((doc) => {
            const data = doc.data()
            return data.metadata?.autoGenerated === true
          }),
          empty: existingCampaigns.docs.filter((doc) => {
            const data = doc.data()
            return data.metadata?.autoGenerated === true
          }).length === 0,
        } as any
      } catch (altError) {
        console.error("[test-generate] Alternative query also failed:", altError)
        // Continue anyway - we'll create a new campaign
        existingCampaigns = { empty: true, docs: [] } as any
      }
    }

    if (!existingCampaigns.empty) {
      const existingDoc = existingCampaigns.docs[0]
      const existingData = existingDoc.data()
      const existingStartAt = existingData.startAt?.toDate?.() || new Date(existingData.startAt)
      const existingDateString = existingStartAt.toISOString().split("T")[0]
      const targetDateString = targetDate.toISOString().split("T")[0]

      if (existingDateString === targetDateString) {
        console.log("[test-generate] Campaign already exists for today")
        return NextResponse.json({
          success: true,
          message: "Campaign already exists for today",
          campaignId: existingDoc.id,
          campaign: {
            id: existingDoc.id,
            title: existingData.title,
            status: existingData.status,
          },
        })
      }
    }

    // Create campaign document
    console.log("[test-generate] Creating campaign document in Firestore...")
    const campaignData = {
      title: advertisement.title,
      slug: slugify(healthDay.name),
      content: advertisement.content,
      imageUrl: "",
      ctaText: advertisement.ctaText,
      ctaHref: advertisement.ctaHref,
      audience: healthDay.targetAudience,
      status: "published" as const,
      priority: healthDay.priority,
      startAt: admin.firestore.Timestamp.fromDate(targetDate),
      endAt: null,
      createdBy: "test-auto-campaign-system",
      updatedBy: "test-auto-campaign-system",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {
        healthAwarenessDay: healthDay.name,
        healthDayDate: healthDay.date,
        autoGenerated: true,
        generatedAt: new Date().toISOString(),
        targetDate: targetDate.toISOString(),
        testCampaign: true,
      },
    }

    let campaignRef
    try {
      campaignRef = await db.collection("campaigns").add(campaignData)
      console.log(`[test-generate] Campaign created successfully with ID: ${campaignRef.id}`)
    } catch (firestoreError) {
      console.error("[test-generate] Error creating campaign in Firestore:", firestoreError)
      throw new Error(`Failed to create campaign in Firestore: ${firestoreError instanceof Error ? firestoreError.message : "Unknown error"}`)
    }

    return NextResponse.json({
      success: true,
      message: `Test campaign generated successfully for ${healthDay.name}`,
      campaignId: campaignRef.id,
      campaign: {
        id: campaignRef.id,
        title: advertisement.title,
        status: "published",
        healthDay: healthDay.name,
      },
    })
  } catch (error: any) {
    console.error("[test-generate] Error:", error)
    console.error("[test-generate] Error stack:", error?.stack)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to generate test campaign",
        details: process.env.NODE_ENV === "development" ? error?.stack : undefined,
        hint: error?.message?.includes("GROQ_API_KEY") 
          ? "Please set GROQ_API_KEY in your .env.local file"
          : error?.message?.includes("Firebase") 
          ? "Please check your Firebase Admin credentials in .env.local"
          : "Check server logs for more details",
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/auto-campaigns/test-generate
 * Query params: healthDayName, date
 * 
 * This endpoint generates a test campaign using GET method
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const healthDayName = url.searchParams.get("healthDayName") || "World Heart Day"
    const date = url.searchParams.get("date") || null

    // Create a POST request body
    const body: any = { healthDayName }
    if (date) {
      body.date = date
    }

    // Create a new request with POST body
    const postRequest = new Request(request.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    return POST(postRequest)
  } catch (error: any) {
    console.error("test-generate GET error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to generate test campaign",
      },
      { status: 500 }
    )
  }
}

