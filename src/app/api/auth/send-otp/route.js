import twilio from "twilio";
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

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER; //  Twilio phone number

// Helper to get Twilio client
function getTwilioClient() {
  if (!accountSid || !authToken) {
    throw new Error(
      "Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables."
    );
  }
  return twilio(accountSid, authToken);
}

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/auth/send-otp - Send OTP via SMS
export async function POST(request) {
  try {
    // Apply rate limiting
    const { applyRateLimit } = await import("@/utils/rateLimit");
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

    // Check if Twilio is configured
    if (!twilioPhoneNumber) {
      return Response.json(
        { error: "Twilio phone number not configured. Please set TWILIO_PHONE_NUMBER environment variable." },
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

    // Send OTP via Twilio SMS
    const client = getTwilioClient();
    const message = await client.messages.create({
      body: `Your HMS verification code is: ${otp}. This code will expire in 10 minutes. Do not share this code with anyone.`,
      from: twilioPhoneNumber,
      to: cleanedPhone, // Phone number with country code (e.g., +1234567890)
    });

    // Log audit event
    const { logAuthEvent } = await import("@/utils/auditLog");
    await logAuthEvent("otp_sent", request, undefined, undefined, undefined, undefined, {
      phoneNumber: cleanedPhone,
      messageSid: message.sid,
    });

    // Return success (don't return OTP in response for security)
    return Response.json({
      success: true,
      message: "OTP sent successfully",
      messageSid: message.sid,
      // In production, don't return messageSid or any OTP-related info
    });
  } catch (error) {
    console.error("Error sending OTP:", error);

    // Log audit event for failure
    const { logAuthEvent } = await import("@/utils/auditLog");
    await logAuthEvent("otp_failed", request, undefined, undefined, undefined, error?.message || "Failed to send OTP", {
      errorCode: error?.code,
    });

    // Handle Twilio-specific errors
    if (error.code === 21211) {
      return Response.json(
        { error: "Invalid phone number. Please check and try again." },
        { status: 400 }
      );
    } else if (error.code === 21614) {
      return Response.json(
        { error: "This phone number is not registered with Twilio. Please contact support." },
        { status: 400 }
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

