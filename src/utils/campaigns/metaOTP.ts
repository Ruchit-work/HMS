
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

