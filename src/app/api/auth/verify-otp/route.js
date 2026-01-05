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

// POST /api/auth/verify-otp - Verify OTP
export async function POST(request) {
  try {
    // Apply rate limiting
    const { applyRateLimit } = await import("@/utils/rateLimit");
    const rateLimitResult = await applyRateLimit(request, "AUTH");
    if (rateLimitResult instanceof Response) {
      return rateLimitResult; // Rate limited
    }

    const body = await request.json();
    const { phoneNumber, otp } = body;

    // Validate inputs
    if (!phoneNumber || !otp) {
      return Response.json(
        { error: "Phone number and OTP are required" },
        { status: 400 }
      );
    }

    // Clean phone number (same logic as send-otp)
    let cleanedPhone = phoneNumber.trim();
    
    // Remove all non-digit characters except the leading +
    if (cleanedPhone.startsWith("+")) {
      cleanedPhone = "+" + cleanedPhone.slice(1).replace(/\D/g, "");
    } else {
      cleanedPhone = cleanedPhone.replace(/\D/g, "");
      if (!cleanedPhone.startsWith("+")) {
        cleanedPhone = "+" + cleanedPhone;
      }
    }

    // Get digits only for Firestore document ID (consistent with send-otp)
    const phoneDocId = cleanedPhone.replace(/\D/g, "");

    // Get OTP from Firestore
    const otpRef = admin.firestore().collection("otps").doc(phoneDocId);
    const otpDoc = await otpRef.get();

    if (!otpDoc.exists) {
      return Response.json(
        { error: "OTP not found. Please request a new OTP." },
        { status: 404 }
      );
    }

    const otpData = otpDoc.data();

    // Check if OTP is already verified
    if (otpData.verified) {
      return Response.json(
        { error: "This OTP has already been used. Please request a new OTP." },
        { status: 400 }
      );
    }

    // Check if OTP has expired
    const expiresAt = otpData.expiresAt.toDate();
    const now = new Date();
    if (now > expiresAt) {
      // Delete expired OTP
      await otpRef.delete();
      return Response.json(
        { error: "OTP has expired. Please request a new OTP." },
        { status: 400 }
      );
    }

    // Check attempts (max 5 attempts)
    const attempts = otpData.attempts || 0;
    if (attempts >= 5) {
      await otpRef.delete();
      return Response.json(
        { error: "Too many failed attempts. Please request a new OTP." },
        { status: 429 }
      );
    }

    // Verify OTP
    if (otpData.otp !== otp) {
      // Increment attempts
      await otpRef.update({
        attempts: admin.firestore.FieldValue.increment(1),
      });


      const remainingAttempts = 5 - (attempts + 1);
      return Response.json(
        {
          error: `Invalid OTP. ${remainingAttempts} attempt${remainingAttempts !== 1 ? "s" : ""} remaining.`,
          remainingAttempts,
        },
        { status: 400 }
      );
    }

    // OTP is valid - mark as verified
    await otpRef.update({
      verified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });


    // Return success
    return Response.json({
      success: true,
      message: "OTP verified successfully",
      phoneNumber: otpData.phoneNumber || cleanedPhone,
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to verify OTP. Please try again." },
      { status: 500 }
    );
  }
}

// Force this route to run in Node.js runtime
export const runtime = "nodejs";

