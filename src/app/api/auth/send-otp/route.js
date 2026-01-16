import admin from "firebase-admin";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || "";
  const privateKey = rawPrivateKey.replace(/^"|"$/g, "").replace(/\\n/g, "\n");

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

// MIGRATED TO META WHATSAPP - Twilio code kept for rollback reference
// Twilio credentials kept in env but not used (for rollback if needed)
// const accountSid = process.env.TWILIO_ACCOUNT_SID;
// const authToken = process.env.TWILIO_AUTH_TOKEN;
// const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/auth/send-otp - Send OTP via SMS
export async function POST(request) {
  try {
    // Apply rate limiting
    const { applyRateLimit } = await import("@/utils/shared/rateLimit");
    const rateLimitResult = await applyRateLimit(request, "OTP");
    if (rateLimitResult instanceof Response) {
      return rateLimitResult; // Rate limited
    }

    const body = await request.json();
    const { phoneNumber } = body;

    // Validate phone number
    if (!phoneNumber) {
      return Response.json({ error: "Phone number is required" }, { status: 400 });
    }

    // Clean phone number (remove spaces, dashes, etc.) but preserve country code
    let cleanedPhone = phoneNumber.trim();
    
    // Remove all non-digit characters except the leading +
    if (cleanedPhone.startsWith("+")) {
      cleanedPhone = "+" + cleanedPhone.slice(1).replace(/\D/g, "");
    } else {
      // If no +, clean digits and add + prefix
      cleanedPhone = cleanedPhone.replace(/\D/g, "");
      cleanedPhone = "+" + cleanedPhone;
    }

    // Validate phone number format (should be 7-15 digits total including country code)
    const digitsOnly = cleanedPhone.replace(/\D/g, "");
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
      return Response.json(
        { error: `Invalid phone number format. Phone number should contain 7-15 digits (received ${digitsOnly.length} digits). Please provide a valid phone number with country code (e.g., +911234567890).` },
        { status: 400 }
      );
    }

    // Check if Meta WhatsApp is configured
    const metaAccessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
    if (!metaAccessToken) {
      return Response.json(
        { error: "Meta WhatsApp not configured. Please set META_WHATSAPP_ACCESS_TOKEN environment variable." },
        { status: 500 }
      );
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes

    // Store OTP in Firestore (use digits only as document ID for consistency)
    const phoneDocId = digitsOnly;
    const otpRef = admin.firestore().collection("otps").doc(phoneDocId);
    await otpRef.set({
      otp,
      phoneNumber: cleanedPhone,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      attempts: 0,
      verified: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send OTP via Meta WhatsApp
    // Try template message first (works outside 24-hour window), fallback to text message
    const { sendTemplateMessage, sendTextMessage } = await import("@/server/metaWhatsApp");
    
    // Check if OTP template is configured
    const otpTemplateName = process.env.META_WHATSAPP_OTP_TEMPLATE_NAME;
    let result;
    
    if (otpTemplateName) {
      // Use template message (can be sent outside 24-hour window)
      result = await sendTemplateMessage(
        cleanedPhone,
        otpTemplateName,
        "en_US", // Language code - adjust if needed
        [
          { type: "text", text: otp }, // OTP code as first parameter
          { type: "text", text: "10" }, // Expiry time in minutes (if template requires it)
        ]
      );
    } else {
      // Fallback to regular text message (only works within 24-hour window)
      const otpMessage = `🔐 *Your HMS Verification Code*\n\nYour verification code is: *${otp}*\n\nThis code will expire in 10 minutes.\n\n⚠️ *Do not share this code with anyone.*\n\nIf you didn't request this code, please ignore this message.`;
      result = await sendTextMessage(cleanedPhone, otpMessage);
    }

    if (!result.success) {
      // Log the error for debugging
      // Provide more specific error messages
      let errorMessage = result.error || "Failed to send OTP. Please try again.";
      
      // If error code 131047 or 131048, it means the number is outside 24-hour window
      if (result.errorCode === 131047 || result.errorCode === 131048) {
        if (!otpTemplateName) {
          errorMessage = "This phone number hasn't messaged our WhatsApp Business number in the last 24 hours. Please send a message to our WhatsApp number first, or contact support. An approved OTP template is required to send OTP to new numbers.";
        } else {
          errorMessage = "Failed to send OTP. The phone number may not be registered with WhatsApp or the template may not be approved. Please contact support.";
        }
      }

      return Response.json(
        { 
          error: errorMessage,
          errorCode: result.errorCode,
          requiresTemplate: !otpTemplateName && (result.errorCode === 131047 || result.errorCode === 131048),
        },
        { status: 500 }
      );
    }


    // Return success (don't return OTP in response for security)
    return Response.json({
      success: true,
      message: "OTP sent successfully via WhatsApp",
      messageId: result.messageId,
      // In production, don't return messageId or any OTP-related info
    });
  } catch (error) {
    // Handle Meta WhatsApp-specific errors
    if (error.code === 100 || error.message?.includes("Invalid phone number")) {
      return Response.json(
        { error: "Invalid phone number. Please check and try again." },
        { status: 400 }
      );
    } else if (error.code === 131047) {
      return Response.json(
        { error: "This phone number is not registered with WhatsApp Business. Please contact support." },
        { status: 400 }
      );
    } else if (error.code === 4 || error.message?.includes("rate limit")) {
      return Response.json(
        { error: "Too many requests. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    return Response.json(
      { error: error.message || "Failed to send OTP. Please try again." },
      { status: 500 }
    );
  }
}

// Force this route to run in Node.js runtime
export const runtime = "nodejs";

