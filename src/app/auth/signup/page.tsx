"use client";

import { Suspense, useEffect, useState } from "react";
import { auth, db } from "@/firebase/config";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import {
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import { usePublicRoute } from "@/hooks/useAuth";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import OTPVerificationModal from "@/components/forms/OTPVerificationModal";
import Notification from "@/components/ui/Notification";
import DoctorProfileForm, {
  DoctorProfileFormValues,
} from "@/components/forms/DoctorProfileForm";
import PatientProfileForm, {
  PatientProfileFormValues,
} from "@/components/forms/PatientProfileForm";
import { sendWhatsAppMessage } from "@/utils/whatsapp";

function SignUpContent() {
  const searchParams = useSearchParams();

  const roleFromUrl = searchParams.get("role") as "patient" | "doctor" | null;

  const router = useRouter();

  const [selectedRole, setSelectedRole] = useState<"patient" | "doctor" | null>(
    roleFromUrl || null
  );

  const role = selectedRole || roleFromUrl;

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);

  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
    countdownSeconds?: number;
  } | null>(null);

  const [showOTPModal, setShowOTPModal] = useState(false);

  const [pendingPatientValues, setPendingPatientValues] =
    useState<PatientProfileFormValues | null>(null);

  const { loading: checking } = usePublicRoute();

  useEffect(() => {
    if (roleFromUrl && roleFromUrl !== "patient" && roleFromUrl !== "doctor") {
      router.replace("/");
    }
  }, [roleFromUrl, router]);

  useEffect(() => {
    setError("");
  }, [role]);

  const dispatchCountdownNotification = (
    message: string,
    onComplete: () => void,
    seconds = 3
  ) => {
    setNotification({ type: "success", message, countdownSeconds: seconds });

    let remaining = seconds;

    const interval = setInterval(() => {
      remaining -= 1;

      if (remaining > 0) {
        setNotification({
          type: "success",
          message,
          countdownSeconds: remaining,
        });
      } else {
        clearInterval(interval);

        onComplete();
      }
    }, 1000);
  };

  const getNextPatientId = async () => {
    const START_NUMBER = 12906;

    return runTransaction(db, async (transaction) => {
      const counterRef = doc(db, "meta", "patientIdCounter");

      const counterSnap = await transaction.get(counterRef);

      let lastNumber = START_NUMBER - 1;

      if (counterSnap.exists()) {
        const data = counterSnap.data() as { lastNumber?: number };

        if (
          typeof data?.lastNumber === "number" &&
          data.lastNumber >= START_NUMBER - 1
        ) {
          lastNumber = data.lastNumber;
        }
      }

      const nextNumber = lastNumber + 1;

      transaction.set(
        counterRef,

        {
          lastNumber: nextNumber,

          updatedAt: serverTimestamp(),
        },

        { merge: true }
      );

      return nextNumber.toString().padStart(6, "0");
    });
  };

  const handleDoctorSubmit = async (values: DoctorProfileFormValues) => {
    setError("");

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );
      const user = userCredential.user;

      const trimmedPhone = values.phoneNumber.trim();

      await setDoc(doc(db, "doctors", user.uid), {
        email: values.email,
        status: "pending",
        firstName: values.firstName,
        lastName: values.lastName,
        gender: values.gender,
        specialization: values.specialization,
        qualification: values.qualification,
        experience: values.experience,
        consultationFee: values.consultationFee,
        phoneNumber: trimmedPhone,
        mfaPhone: trimmedPhone,
        createdAt: new Date().toISOString(),
        createdBy: "self",
      });

        setNotification({
          type: "success",

        message:
          "Doctor account created successfully! Your account is pending admin approval. You will be notified once approved. Redirecting to login...",
      });

      await signOut(auth);

        setTimeout(() => {
        router.push("/auth/login?role=doctor");
      }, 4000);
      } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };

      let errorMessage = "Failed to sign up";

        if (firebaseError.code === "auth/email-already-in-use") {
        errorMessage =
          "This email is already registered. Please use a different email or sign in.";
        } else if (firebaseError.code === "auth/invalid-email") {
        errorMessage = "Invalid email address. Please enter a valid email.";
        } else if (firebaseError.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Please use a stronger password.";
        } else {
        errorMessage =
          firebaseError.message ||
          "Failed to create account. Please try again.";
        }

      setError(errorMessage);
      } finally {
      setLoading(false);
    }
  };

  const handlePatientSubmit = (values: PatientProfileFormValues) => {
    setError("");
    if (!values.phone.trim()) {
      setError(
        "Please enter your phone number to proceed with OTP verification."
      );
      return;
    }

    setPendingPatientValues(values);
    setShowOTPModal(true);
  };

  const createAccountAfterOTP = async (values: PatientProfileFormValues) => {
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );
      const user = userCredential.user;

      const patientId = await getNextPatientId();

      await setDoc(doc(db, "patients", user.uid), {
        email: values.email,
        status: values.status ?? "active",
        firstName: values.firstName,
        lastName: values.lastName,
        phone: `${values.countryCode || ""}${values.phone}`,
        phoneCountryCode: values.countryCode,
        phoneNumber: values.phone,
        dateOfBirth: values.dateOfBirth,
        gender: values.gender,
        bloodGroup: values.bloodGroup,
        address: values.address,
        patientId,
        createdAt: new Date().toISOString(),
        createdBy: "self",
      });

      const combinedPhone = `${values.countryCode || ""}${
        values.phone || ""
      }`.trim();
      if (combinedPhone) {
        const withPlus = combinedPhone.startsWith("+")
          ? combinedPhone
          : `+${combinedPhone}`;
        const whatsappTo = withPlus.startsWith("whatsapp:")
          ? withPlus
          : `whatsapp:${withPlus}`;
        const message = `🎉 *Account Successfully Created!*

Hi ${values.firstName || "there"},

Welcome to Harmony Medical Services! Your patient account has been successfully created.

📋 *Account Details:*
• Patient ID: ${patientId}
• Name: ${values.firstName || ""} ${values.lastName || ""}
• Email: ${values.email || ""}
${values.phone ? `• Phone: ${values.phone}` : ""}

✅ You can now:
• Book appointments with our doctors
• View your medical history
• Access your patient dashboard
• Receive appointment reminders via WhatsApp

If you need any assistance, reply here or call us at +91-XXXXXXXXXX.

Thank you for choosing Harmony Medical Services! 🏥`;
        try {
          const result = await sendWhatsAppMessage({ to: whatsappTo, message });
          if (!result.success) {
            console.error("[Signup WhatsApp] ❌ Failed to send account creation message:", {
              phone: whatsappTo,
              error: result.error,
              status: result.status,
            });
          } else {
            console.log("[Signup WhatsApp] ✅ Account creation message sent successfully to:", whatsappTo);
          }
        } catch (err) {
          console.error("[Signup WhatsApp] ❌ Exception sending account creation message:", {
            phone: whatsappTo,
            error: err,
          });
        }
      }

      const redirectMessage = `Patient account created successfully! Your Patient ID is ${patientId}. Redirecting to login...`;

      setShowOTPModal(false);

      setPendingPatientValues(null);
      await signOut(auth);

      dispatchCountdownNotification(redirectMessage, () =>
        router.push("/auth/login?role=patient")
      );
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };

      let errorMessage = "Failed to sign up";

      if (firebaseError.code === "auth/email-already-in-use") {
        errorMessage =
          "This email is already registered. Please use a different email or sign in.";
      } else if (firebaseError.code === "auth/invalid-email") {
        errorMessage = "Invalid email address. Please enter a valid email.";
      } else if (firebaseError.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Please use a stronger password.";
      } else {
        errorMessage =
          firebaseError.message ||
          "Failed to create account. Please try again.";
      }

      setError(errorMessage);

      setShowOTPModal(false);

      setPendingPatientValues(null);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return <LoadingSpinner />;
  }

  return (
    <>
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      <div className="min-h-screen flex items-center justify-center bg-slate-50 py-8 px-4">
        <div className="w-full max-w-2xl animate-fade-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-cyan-600 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-2xl">H</span>
              </div>

              <div className="text-left">
                <h1 className="text-3xl font-bold text-slate-900">HMS</h1>

                <p className="text-xs text-slate-500 font-medium">
                  Hospital Management System
                </p>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              {role === "doctor"
                ? "Doctor Registration"
                : role === "patient"
                ? "Patient Registration"
                : "Create Account"}
            </h2>

            <p className="text-slate-600">
              {role === "doctor"
                ? "Join as a healthcare provider"
                : role === "patient"
                ? "Create your patient account"
                : "Choose your role to get started"}
            </p>
          </div>

          {!role && (
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 mb-6 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 text-center">
                Select Your Role
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedRole("patient")}
                  className="p-6 border-2 border-blue-300 rounded-xl hover:border-blue-600 hover:bg-blue-50 transition-all duration-200 text-center group"
                >
                  <div className="text-4xl mb-2">👤</div>

                  <div className="font-semibold text-slate-900 group-hover:text-blue-600">
                    Patient
                  </div>

                  <div className="text-sm text-slate-600 mt-1">
                    Create patient account
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRole("doctor")}
                  className="p-6 border-2 border-green-300 rounded-xl hover:border-green-600 hover:bg-green-50 transition-all duration-200 text-center group"
                >
                  <div className="text-4xl mb-2">👨‍⚕️</div>

                  <div className="font-semibold text-slate-900 group-hover:text-green-600">
                    Doctor
                  </div>

                  <div className="text-sm text-slate-600 mt-1">
                    Join as healthcare provider
                  </div>
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-6 mb-6 py-4 border-y border-slate-200">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <svg
                className="w-4 h-4 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>

              <span className="font-medium">Secure Registration</span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <svg
                className="w-4 h-4 text-blue-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>

              <span className="font-medium">HIPAA Compliant</span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <svg
                className="w-4 h-4 text-cyan-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
              </svg>

              <span className="font-medium">Encrypted</span>
            </div>
          </div>

          {error && (
            <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-300 p-4 mb-6 rounded-xl shadow-lg animate-shake-fade-in">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center animate-bounce-in">
                  <span className="text-white text-lg font-bold">!</span>
                </div>

                  <p className="text-sm text-red-800 font-semibold leading-relaxed">
                    {error}
                  </p>
                </div>

                <button
                  onClick={() => setError("")}
                  className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
                  aria-label="Close error"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {role && (
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-xl max-h-[80vh] sm:max-h-[75vh] lg:max-h-[70vh] overflow-y-auto">
              {role === "doctor" ? (
                <DoctorProfileForm
                  mode="public"
                  loading={loading}
                  externalError={error}
                  onErrorClear={() => setError("")}
                  onSubmit={handleDoctorSubmit}
                  submitLabel={
                    loading
                      ? "Creating Doctor Account..."
                      : "Create Doctor Account"
                  }
                />
              ) : (
                <PatientProfileForm
                  mode="public"
                  loading={loading}
                  externalError={error}
                  onErrorClear={() => setError("")}
                  onSubmit={handlePatientSubmit}
                  submitLabel={
                    loading
                      ? "Creating Patient Account..."
                      : "Create Patient Account"
                  }
                />
              )}

              <div className="mt-6 text-center">
                <p className="text-sm text-slate-600">
                  Already have an account?{" "}
                  <a
                    href={role ? `/auth/login?role=${role}` : "/auth/login"}
                    className="font-semibold text-cyan-600 hover:text-cyan-700 transition-colors"
                  >
                    Sign in
                  </a>
                </p>
              </div>

              <div className="mt-8 flex items-center justify-center gap-8 text-slate-400">
                <div className="text-center">
                  <div className="text-2xl mb-1">🏥</div>

                  <p className="text-xs font-medium">Certified</p>
                </div>

                <div className="text-center">
                  <div className="text-2xl mb-1">🔒</div>

                  <p className="text-xs font-medium">Secure</p>
                </div>

                <div className="text-center">
                  <div className="text-2xl mb-1">⚡</div>

                  <p className="text-xs font-medium">Fast</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showOTPModal && role === "patient" && pendingPatientValues && (
        <OTPVerificationModal
          isOpen={showOTPModal}
          onClose={() => {
            setShowOTPModal(false);

            setPendingPatientValues(null);
          }}
          phone={pendingPatientValues.phone}
          countryCode={pendingPatientValues.countryCode}
          onVerified={async () => {
            if (pendingPatientValues) {
              try {
                await createAccountAfterOTP(pendingPatientValues);
              } catch (error: any) {
                // Error is already handled in createAccountAfterOTP, but we need to rethrow
                // so the modal can handle it properly
                console.error("Account creation failed:", error);
                throw error; // Re-throw so modal can catch and show error
              }
            }
          }}
          onChangePhone={() => {
            setShowOTPModal(false);

            setPendingPatientValues(null);
          }}
        />
      )}
    </>
  );
}

export default function SignUp() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading signup page..." />}>
      <SignUpContent />
    </Suspense>
  );
}

export const dynamic = "force-dynamic";
