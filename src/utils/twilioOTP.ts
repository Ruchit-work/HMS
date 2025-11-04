/**
 * Twilio OTP Utility Functions
 * 
 * Helper functions to interact with Twilio OTP API endpoints
 */

export interface SendOTPResponse {
  success: boolean;
  message: string;
  messageSid?: string;
  error?: string;
}

export interface VerifyOTPResponse {
  success: boolean;
  message: string;
  phoneNumber?: string;
  error?: string;
  remainingAttempts?: number;
}

/**
 * Send OTP to a phone number via SMS
 * @param phoneNumber - Phone number to send OTP to (with or without country code)
 * @returns Promise with send OTP response
 */
export async function sendOTP(phoneNumber: string): Promise<SendOTPResponse> {
  try {
    const response = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phoneNumber }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.error || "Failed to send OTP",
        error: data.error,
      };
    }

    return {
      success: true,
      message: data.message || "OTP sent successfully",
      messageSid: data.messageSid,
    };
  } catch (error) {
    return {
      success: false,
      message: "Network error. Please check your connection and try again.",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Verify OTP for a phone number
 * @param phoneNumber - Phone number to verify OTP for
 * @param otp - The OTP code to verify
 * @returns Promise with verify OTP response
 */
export async function verifyOTP(
  phoneNumber: string,
  otp: string
): Promise<VerifyOTPResponse> {
  try {
    const response = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phoneNumber, otp }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.error || "Failed to verify OTP",
        error: data.error,
        remainingAttempts: data.remainingAttempts,
      };
    }

    return {
      success: true,
      message: data.message || "OTP verified successfully",
      phoneNumber: data.phoneNumber,
    };
  } catch (error) {
    return {
      success: false,
      message: "Network error. Please check your connection and try again.",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

