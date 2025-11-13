

export const dynamic = 'force-dynamic' // Prevent caching for cron jobs
export const revalidate = 0

import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import {
  getHealthAwarenessDaysForToday,
  getHealthAwarenessDaysForTomorrow,
} from "@/server/healthAwarenessDays"
import { generateAdvertisements } from "@/server/groqAdvertisementGenerator"
import { sendWhatsAppNotification } from "@/server/whatsapp"
import { slugify } from "@/utils/campaigns"


export async function GET(request: Request) {
  const startTime = Date.now()
  const isCronTrigger = request.headers.get("x-vercel-cron") !== null
  const triggerSource = isCronTrigger ? "cron" : "manual"
  
  console.log(`[auto-campaigns-generate] ${triggerSource.toUpperCase()} trigger at ${new Date().toISOString()}`)
  
  try {
    const initResult = initFirebaseAdmin("auto-campaigns-generate API")
    if (!initResult.ok) {
      console.error("[auto-campaigns-generate] Firebase Admin initialization failed:", initResult.error)
      return NextResponse.json(
        { error: "Server not configured for admin" },
        { status: 500 }
      )
    }

    const url = new URL(request.url)
    const checkParam = url.searchParams.get("check") || "today"
    const publishParam = url.searchParams.get("publish") !== "false"
    // Enable WhatsApp by default for cron jobs, but allow override via query param
    // For manual testing, default to false unless explicitly set to true
    const sendWhatsAppParam = url.searchParams.get("sendWhatsApp") === "true" || 
                             (url.searchParams.get("sendWhatsApp") !== "false" && isCronTrigger)
    // Test mode: Create a fake awareness day for today (for testing purposes only)
    const testMode = url.searchParams.get("test") === "true"
    // Random mode: Create a random awareness day (for testing with variety)
    const randomMode = url.searchParams.get("random") === "true"

    console.log(`[auto-campaigns-generate] Parameters: check=${checkParam}, publish=${publishParam}, sendWhatsApp=${sendWhatsAppParam}, test=${testMode}, random=${randomMode} (trigger: ${triggerSource})`)

    // Get health awareness days based on check parameter
    let healthDays =
      checkParam === "tomorrow"
        ? getHealthAwarenessDaysForTomorrow()
        : getHealthAwarenessDaysForToday()

    // RANDOM MODE: Create a random awareness day with random health topics
    if (randomMode && checkParam === "today") {
      console.log(`[auto-campaigns-generate] RANDOM MODE: Creating random awareness day`)
      const now = new Date()
      const istOffset = 5.5 * 60 * 60 * 1000
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000)
      const istTime = new Date(utcTime + istOffset)
      const month = String(istTime.getUTCMonth() + 1).padStart(2, '0')
      const day = String(istTime.getUTCDate()).padStart(2, '0')
      const randomDate = `${month}-${day}`
      
      // Random health topics for variety
      const randomTopics = [
        { name: "Heart Health Awareness Day", keywords: ["heart", "cardiac", "cardiovascular", "bp"], specialization: ["Cardiology"] },
        { name: "Mental Wellness Day", keywords: ["mental", "wellness", "stress", "anxiety"], specialization: ["Psychiatry"] },
        { name: "Diabetes Prevention Day", keywords: ["diabetes", "sugar", "blood glucose", "prevention"], specialization: ["Endocrinology"] },
        { name: "Women's Health Day", keywords: ["women", "gynecology", "reproductive", "health"], specialization: ["Gynecology"] },
        { name: "Child Health Day", keywords: ["children", "pediatrics", "vaccination", "growth"], specialization: ["Pediatrics"] },
        { name: "Eye Care Awareness Day", keywords: ["eye", "vision", "ophthalmology", "sight"], specialization: ["Ophthalmology"] },
        { name: "Bone Health Day", keywords: ["bone", "orthopedic", "fracture", "calcium"], specialization: ["Orthopedics"] },
        { name: "Skin Health Day", keywords: ["skin", "dermatology", "acne", "dermatitis"], specialization: ["Dermatology"] },
        { name: "Digestive Health Day", keywords: ["digestive", "gastroenterology", "stomach", "gut"], specialization: ["Gastroenterology"] },
        { name: "Respiratory Health Day", keywords: ["respiratory", "lungs", "breathing", "asthma"], specialization: ["Pulmonology"] },
      ]
      
      const randomTopic = randomTopics[Math.floor(Math.random() * randomTopics.length)]
      
      healthDays = [{
        name: randomTopic.name,
        date: randomDate,
        description: `A special awareness day focused on ${randomTopic.name.toLowerCase()}. Take care of your health and schedule a checkup today.`,
        keywords: randomTopic.keywords,
        targetAudience: "all",
        priority: Math.floor(Math.random() * 3) + 3, // Priority 3-5
        specialization: randomTopic.specialization,
      }]
      console.log(`[auto-campaigns-generate] RANDOM MODE: Created random awareness day: ${healthDays[0].name} (${randomDate})`)
    }
    // TEST MODE: If test mode is enabled and no awareness days found, create a fake one for today
    else if (testMode && healthDays.length === 0 && checkParam === "today") {
      console.log(`[auto-campaigns-generate] TEST MODE: Creating fake awareness day for testing`)
      const now = new Date()
      const istOffset = 5.5 * 60 * 60 * 1000
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000)
      const istTime = new Date(utcTime + istOffset)
      const month = String(istTime.getUTCMonth() + 1).padStart(2, '0')
      const day = String(istTime.getUTCDate()).padStart(2, '0')
      const testDate = `${month}-${day}`
      
      healthDays = [{
        name: "Test Health Awareness Day",
        date: testDate,
        description: "This is a test awareness day created for testing the auto-campaign system. It will be automatically generated when test mode is enabled.",
        keywords: ["test", "health", "awareness", "testing"],
        targetAudience: "all",
        priority: 5,
        specialization: ["General Physician"],
      }]
      console.log(`[auto-campaigns-generate] TEST MODE: Created fake awareness day: ${healthDays[0].name} (${testDate})`)
    }

    console.log(`[auto-campaigns-generate] Found ${healthDays.length} health awareness day(s) for ${checkParam}`)
    if (healthDays.length > 0) {
      console.log(`[auto-campaigns-generate] Health days: ${healthDays.map(d => d.name).join(", ")}`)
    }

    if (healthDays.length === 0) {
      const message = `No health awareness days found for ${checkParam}`
      console.log(`[auto-campaigns-generate] ${message}`)
      
      // Log to Firestore even when no campaigns are generated
      try {
        const db = admin.firestore()
        await db.collection("cron_logs").add({
          executedAt: admin.firestore.FieldValue.serverTimestamp(),
          checkParam,
          success: true,
          campaignsGenerated: 0,
          message,
          healthDaysChecked: [],
          triggeredBy: triggerSource,
          executionTimeMs: Date.now() - startTime,
        })
      } catch (logError) {
        console.error("[auto-campaigns-generate] Error logging execution:", logError)
      }
      
      return NextResponse.json({
        success: true,
        message,
        campaignsGenerated: 0,
        campaigns: [],
        triggeredBy: triggerSource,
      })
    }

    // Determine the target date for campaigns (in IST)
    // CRON SCHEDULE: "30 00 * * *" (00:30 AM UTC = 6:00 AM IST)
    // IST is UTC+5:30, so 6:00 AM IST = 00:30 AM UTC (00:30 UTC)
    // Example: 6:00 AM IST on Jan 2 = 00:30 AM UTC on Jan 2
    const istOffset = 5.5 * 60 * 60 * 1000 // IST offset in milliseconds (5 hours 30 minutes)
    const now = new Date()
    // Get current UTC time
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000)
    // Get current IST time
    const istTime = new Date(utcTime + istOffset)
    
    // Calculate target date (today or tomorrow in IST)
    const targetIST = checkParam === "tomorrow"
      ? new Date(istTime.getTime() + 24 * 60 * 60 * 1000) // Tomorrow in IST
      : new Date(istTime) // Today in IST
    
    // Set to midnight IST (00:00 IST)
    targetIST.setUTCHours(0, 0, 0, 0)
    targetIST.setUTCMinutes(0)
    targetIST.setUTCSeconds(0)
    targetIST.setUTCMilliseconds(0)
    
    // Convert IST time to UTC for Firestore storage
    // CRON SCHEDULE: "30 00 * * *" (00:30 AM UTC = 6:00 AM IST)
    // Note: Campaigns are created for today's date in IST
    const targetDateUTC = new Date(targetIST.getTime() - istOffset)

    // Generate advertisements using Groq API
    const hospitalName = process.env.HOSPITAL_NAME || "Harmony Medical Services"
    const advertisements = await generateAdvertisements(healthDays, hospitalName)

    const db = admin.firestore()
    const campaignsCreated: Array<{
      id: string
      title: string
      healthDay: string
      status: string
    }> = []

    // Create and publish campaigns
    for (const healthDay of healthDays) {
      const advertisement = advertisements.get(healthDay.name)

      if (!advertisement) {
        console.error(`Failed to generate advertisement for ${healthDay.name}`)
        continue
      }

      try {
        console.log(`[auto-campaigns-generate] Processing ${healthDay.name} (date: ${healthDay.date})`)
        
        // Check if campaign already exists for this health day and target date
        // We check both the healthDayDate and the target date to avoid duplicates
        const targetISTMonth = targetIST.getUTCMonth() + 1
        const targetISTDay = targetIST.getUTCDate()
        const targetDateStringIST = `${String(targetISTMonth).padStart(2, '0')}-${String(targetISTDay).padStart(2, '0')}`
        
        console.log(`[auto-campaigns-generate] Target date (IST): ${targetDateStringIST}, Health day date: ${healthDay.date}`)
        
        // Check if campaign already exists for this health day date and target date
        // This prevents creating duplicate campaigns for the same health awareness day on the same date
        let alreadyExists = false
        try {
          const existingCampaigns = await db
            .collection("campaigns")
            .where("metadata.healthDayDate", "==", healthDay.date)
            .where("metadata.autoGenerated", "==", true)
            .get()

          console.log(`[auto-campaigns-generate] Found ${existingCampaigns.size} existing campaign(s) for ${healthDay.name}`)
          
          // Check if we already created a campaign for this health day date and target date (compare in IST)
          existingCampaigns.forEach((doc) => {
            const data = doc.data()
            // Check if campaign exists for the target date (compare in IST)
            if (data.startAt) {
              const startAtUTC = data.startAt?.toDate?.() || new Date(data.startAt)
              // Convert UTC to IST for comparison
              const startAtUTC_Time = startAtUTC.getTime() + (startAtUTC.getTimezoneOffset() * 60 * 1000)
              const startAtIST = new Date(startAtUTC_Time + istOffset)
              const startISTMonth = startAtIST.getUTCMonth() + 1
              const startISTDay = startAtIST.getUTCDate()
              const startDateStringIST = `${String(startISTMonth).padStart(2, '0')}-${String(startISTDay).padStart(2, '0')}`
              
              console.log(`[auto-campaigns-generate] Existing campaign start date (IST): ${startDateStringIST}, Target: ${targetDateStringIST}`)
              
              if (startDateStringIST === targetDateStringIST) {
                alreadyExists = true
                console.log(`[auto-campaigns-generate] Campaign for ${healthDay.name} already exists for ${targetDateStringIST}`)
              }
            }
          })
        } catch (queryError) {
          // If query fails (e.g., missing Firestore index), log error but continue to create campaign
          // This ensures campaigns are created even if duplicate check fails
          console.error(`[auto-campaigns-generate] Error checking for existing campaigns for ${healthDay.name}:`, queryError)
          console.log(`[auto-campaigns-generate] Continuing to create campaign despite query error (may create duplicate if one exists)`)
          // Set alreadyExists to false to allow campaign creation
          alreadyExists = false
        }

        // Store advertisement data for WhatsApp sending (even if campaign already exists)
        let whatsAppAdvertisement = advertisement
        let whatsAppCampaignTitle = advertisement.title
        let campaignRef: admin.firestore.DocumentReference | null = null

        if (alreadyExists) {
          console.log(
            `[auto-campaigns-generate] Campaign for ${healthDay.name} already exists for ${checkParam} (${targetDateStringIST}), skipping creation...`
          )
          
          // If campaign already exists but WhatsApp is requested, get existing campaign data for WhatsApp
          if (sendWhatsAppParam && checkParam === "today") {
            try {
              // Try to get existing campaign data for WhatsApp message
              const existingCampaignsList = await db
                .collection("campaigns")
                .where("metadata.healthDayDate", "==", healthDay.date)
                .where("metadata.autoGenerated", "==", true)
                .limit(1)
                .get()
              
              if (!existingCampaignsList.empty) {
                const existingCampaignDoc = existingCampaignsList.docs[0]
                campaignRef = existingCampaignsList.docs[0].ref
                const existingCampaign = existingCampaignDoc.data()
                whatsAppCampaignTitle = existingCampaign.title || advertisement.title
                // Use existing campaign's content if available, otherwise use generated advertisement
                if (existingCampaign.content) {
                  // Extract plain text from HTML content for WhatsApp
                  const plainText = existingCampaign.content
                    .replace(/<[^>]*>/g, "")
                    .replace(/&nbsp;/g, " ")
                    .replace(/&amp;/g, "&")
                    .replace(/&lt;/g, "<")
                    .replace(/&gt;/g, ">")
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .trim()
                  
                  // Use existing campaign's short message if available, otherwise use generated
                  whatsAppAdvertisement = {
                    ...advertisement,
                    title: whatsAppCampaignTitle,
                    shortMessage: existingCampaign.metadata?.shortMessage || plainText.substring(0, 200) || advertisement.shortMessage,
                    ctaHref: existingCampaign.ctaHref || advertisement.ctaHref,
                    ctaText: existingCampaign.ctaText || advertisement.ctaText,
                  }
                }
                console.log(`[auto-campaigns-generate] Using existing campaign data for WhatsApp: ${whatsAppCampaignTitle}`)
              }
            } catch (error) {
              console.error(`[auto-campaigns-generate] Error getting existing campaign data for WhatsApp:`, error)
              // Continue with generated advertisement data
            }
          } else {
            // Campaign exists and WhatsApp is not requested, skip entirely
            continue
          }
        } else {
          // Campaign doesn't exist, create it
          console.log(`[auto-campaigns-generate] Creating new campaign for ${healthDay.name}`)

          // Create campaign document
          const campaignData = {
            title: advertisement.title,
            slug: slugify(healthDay.name),
            content: advertisement.content,
            imageUrl: "", // Can be enhanced later to generate or fetch images
            ctaText: advertisement.ctaText,
            ctaHref: advertisement.ctaHref,
            audience: healthDay.targetAudience,
            status: publishParam ? "published" : "draft",
            priority: healthDay.priority,
            startAt: admin.firestore.Timestamp.fromDate(targetDateUTC),
            endAt: null, // Campaign doesn't expire by default
            createdBy: "auto-campaign-system",
            updatedBy: "auto-campaign-system",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            metadata: {
              healthAwarenessDay: healthDay.name,
              healthDayDate: healthDay.date,
              autoGenerated: true,
              generatedAt: new Date().toISOString(),
              targetDate: targetIST.toISOString(), // Target date in IST
              targetDateUTC: targetDateUTC.toISOString(), // Target date in UTC (for Firestore)
              shortMessage: advertisement.shortMessage, // Store short message in metadata for later use
            },
          }

          campaignRef = await db.collection("campaigns").add(campaignData)
          
          console.log(`[auto-campaigns-generate] Created campaign with ID: ${campaignRef.id} for ${healthDay.name}`)

          campaignsCreated.push({
            id: campaignRef.id,
            title: advertisement.title,
            healthDay: healthDay.name,
            status: campaignData.status,
          })
        }


        // Only send notifications if the campaign is for today (not tomorrow)
        if (sendWhatsAppParam && whatsAppAdvertisement.shortMessage && checkParam === "today") {
          try {
            // Get base URL for building full links
            // Try VERCEL_URL first (for Vercel deployments), then NEXT_PUBLIC_BASE_URL, then request origin
            const requestUrl = new URL(request.url)
            const baseUrl = 
              process.env.VERCEL_URL 
                ? `https://${process.env.VERCEL_URL}`
                : process.env.NEXT_PUBLIC_BASE_URL 
                ? process.env.NEXT_PUBLIC_BASE_URL
                : requestUrl.origin || request.headers.get("origin") || "https://your-domain.com"
            
            let appointmentUrl = whatsAppAdvertisement.ctaHref || "/patient-dashboard/book-appointment"
            if (!appointmentUrl.startsWith("http")) {
              const normalizedPath = (appointmentUrl.startsWith("/") ? appointmentUrl : `/${appointmentUrl}`)
                .replace(/\/{2,}/g, "/")
                .replace("/patient-dashboard/patient-dashboard/", "/patient-dashboard/")

              let origin = baseUrl
              try {
                origin = new URL(baseUrl).origin
              } catch {
                // baseUrl might already be an origin string; leave as-is
              }

              appointmentUrl = `${origin}${normalizedPath}`
            }
            
            // Use approved WhatsApp template with Content SID
            // Content SID: HX21c0a92f2073af6a3102564e0e7c1141
            const whatsAppContentSid = process.env.WHATSAPP_CONTENT_SID || "HX42269b25d07c88206e6f00f2bfdddbd4"
            
            // Prepare content variables for the template
            // Using numbered variables as per Twilio Content Template format
            // Variable mapping: "1" = name, "2" = campaignTitle, "3" = campaignMessage, "4" = appointmentUrl, "6" = appointmentUrl (for button)
            // Note: Variables will be populated per patient in the loop below
            const baseContentVariables: Record<string, string> = {
              "2": whatsAppCampaignTitle,
              "3": whatsAppAdvertisement.shortMessage,
              "4": appointmentUrl,
              "6": appointmentUrl, // For button URL
            }
            
            // Fallback message (used if template fails)
            const whatsAppMessage = `🏥 *${whatsAppCampaignTitle}*

${whatsAppAdvertisement.shortMessage}

To book an appointment or learn more, please use the options below:`

            const messageWithLink = `${whatsAppMessage}\n\nBook Appointment: ${appointmentUrl}`

            // Get all active patients with phone numbers
            const patientsSnapshot = await db
              .collection("patients")
              .where("status", "in", ["active"])
              .get()

            const whatsAppPromises: Promise<void>[] = []

            patientsSnapshot.forEach((doc) => {
              const patientData = doc.data()
              const phone = patientData.phone || patientData.phoneNumber || patientData.contact
              const patientName = patientData.name || patientData.fullName || "Patient"

              if (phone && phone.trim() !== "") {
                // Include patient name in content variables (variable "1")
                const contentVariables = {
                  ...baseContentVariables,
                  "1": patientName, // Patient name for personalization
                }
                
                whatsAppPromises.push(
                  sendWhatsAppNotification({
                    to: phone,
                    message: messageWithLink, // Fallback message if template fails
                    contentSid: whatsAppContentSid, // Use approved template
                    contentVariables: contentVariables, // Template variables with numbered keys
                  })
                    .then((result) => {
                      if (!result.success) {
                        console.error(
                          `Failed to send WhatsApp to ${phone}:`,
                          result.error
                        )
                      } else {
                        console.log(`Successfully sent WhatsApp to ${phone} for campaign: ${whatsAppCampaignTitle}`)
                      }
                    })
                    .catch((error) => {
                      console.error(`Error sending WhatsApp to ${phone}:`, error)
                    })
                )
              }
            })

            // Send WhatsApp messages in parallel (but don't wait for all to complete)
            Promise.all(whatsAppPromises).catch((error) => {
              console.error("Error sending WhatsApp notifications:", error)
            })

            console.log(
              `[auto-campaigns-generate] Queued WhatsApp notifications for ${whatsAppPromises.length} patients for campaign: ${whatsAppCampaignTitle}${alreadyExists ? " (existing campaign)" : " (newly created)"}`
            )
          } catch (error) {
            console.error("Error sending WhatsApp notifications:", error)
            // Don't fail the entire request if WhatsApp fails
          }
        } else if (sendWhatsAppParam && checkParam === "tomorrow") {
          console.log(
            `WhatsApp notifications will be sent tomorrow when campaigns go live for ${healthDay.name}`
          )
        }

        if (!alreadyExists) {
          console.log(
            `[auto-campaigns-generate] Successfully created campaign "${advertisement.title}" for ${healthDay.name} (ID: ${campaignRef ? campaignRef.id : "N/A"})`
          )
        } else {
          console.log(
            `[auto-campaigns-generate] Campaign for ${healthDay.name} already exists, WhatsApp notification sent (if enabled)`
          )
        }
      } catch (error) {
        console.error(
          `Error creating campaign for ${healthDay.name}:`,
          error
        )
        // Continue with other campaigns even if one fails
      }
    }

    // Log cron execution to Firestore
    const executionTimeMs = Date.now() - startTime
    const executionLog = {
      executedAt: admin.firestore.FieldValue.serverTimestamp(),
      checkParam,
      success: true,
      campaignsGenerated: campaignsCreated.length,
      campaigns: campaignsCreated,
      healthDaysChecked: healthDays.map((d) => d.name),
      message: `Generated ${campaignsCreated.length} campaigns for ${checkParam}`,
      triggeredBy: triggerSource,
      executionTimeMs,
    }
    
    console.log(`[auto-campaigns-generate] Execution completed in ${executionTimeMs}ms. Generated ${campaignsCreated.length} campaign(s).`)

    try {
      await db.collection("cron_logs").add(executionLog)
    } catch (logError) {
      console.error("Error logging cron execution:", logError)
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${campaignsCreated.length} campaigns for ${checkParam}`,
      campaignsGenerated: campaignsCreated.length,
      campaigns: campaignsCreated,
      healthDaysChecked: healthDays.map((d) => d.name),
      triggeredBy: triggerSource,
      executionTimeMs: Date.now() - startTime,
    })
  } catch (error: any) {
    console.error("[auto-campaigns-generate] Error:", error)
    console.error("[auto-campaigns-generate] Error stack:", error?.stack)
    
    // Log failed execution to Firestore
    try {
      const initResult = initFirebaseAdmin("auto-campaigns-generate API (error logging)")
      if (initResult.ok) {
        const db = admin.firestore()
        const url = new URL(request.url)
        const checkParam = url.searchParams.get("check") || "today"
        const isCronTrigger = request.headers.get("x-vercel-cron") !== null
        const triggerSource = isCronTrigger ? "cron" : "manual"
        
        await db.collection("cron_logs").add({
          executedAt: admin.firestore.FieldValue.serverTimestamp(),
          checkParam,
          success: false,
          campaignsGenerated: 0,
          error: error?.message || "Failed to generate campaigns",
          triggeredBy: triggerSource,
          executionTimeMs: Date.now() - startTime,
        })
        
        console.log(`[auto-campaigns-generate] Logged failed execution to Firestore (triggered by: ${triggerSource})`)
      }
    } catch (logError) {
      console.error("[auto-campaigns-generate] Error logging failed cron execution:", logError)
      // Don't fail the request if logging fails
    }

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to generate campaigns",
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/auto-campaigns/generate
 * Body: { check?: "today" | "tomorrow", publish?: boolean, sendWhatsApp?: boolean }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const check = body.check || "today"
    const publish = body.publish !== false
    const sendWhatsApp = body.sendWhatsApp === true

    // Create a new request URL with query params
    const url = new URL(request.url)
    url.searchParams.set("check", check)
    url.searchParams.set("publish", String(publish))
    url.searchParams.set("sendWhatsApp", String(sendWhatsApp))

    // Call GET handler with modified URL
    return GET(new Request(url.toString()))
  } catch (error: any) {
    console.error("auto-campaigns generate POST error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to generate campaigns",
      },
      { status: 500 }
    )
  }
}

