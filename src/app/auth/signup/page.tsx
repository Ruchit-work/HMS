"use client";

import { Suspense, useEffect, useState } from "react";
import { auth, db } from "@/firebase/config";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import {
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { getHospitalCollection } from "@/utils/hospital-queries";

import { useRouter, useSearchParams } from "next/navigation";
import { usePublicRoute } from "@/hooks/useAuth";
import LoadingSpinner from "@/components/ui/StatusComponents";
import OTPVerificationModal from "@/components/forms/OTPVerificationModal";
import Notification from "@/components/ui/Notification";
import PatientProfileForm, {
  PatientProfileFormValues,
} from "@/components/forms/PatientProfileForm";

function SignUpContent() {
  const searchParams = useSearchParams();

  const roleFromUrl = searchParams.get("role") as "patient" | "doctor" | null;

  const router = useRouter();

  // Signup is only for patients - doctors are added from admin dashboard
  const role = "patient";

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

  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [, setShowHospitalSelection] = useState(false);

  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [loadingBranches, setLoadingBranches] = useState(false);

  const { loading: checking } = usePublicRoute();

  useEffect(() => {
    // Redirect if someone tries to access signup with doctor role
    // Doctors can only be added from admin dashboard
    if (roleFromUrl === "doctor") {
      router.replace("/auth/login?role=doctor");
      return;
    }
    if (roleFromUrl && roleFromUrl !== "patient") {
      router.replace("/auth/signup");
    }
  }, [roleFromUrl, router]);

  useEffect(() => {
    setError("");
  }, [role]);

  // Load hospitals on mount (signup is only for patients)
  useEffect(() => {
    loadHospitals();
  }, []);

  const loadHospitals = async () => {
    try {
      setLoadingHospitals(true);
      const response = await fetch("/api/hospitals");
      const data = await response.json();
      if (data.success) {
        setHospitals(data.hospitals || []);
        // If only one hospital, auto-select it
        if (data.hospitals?.length === 1) {
          setSelectedHospitalId(data.hospitals[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load hospitals:", err);
      setError("Failed to load hospitals. Please refresh the page.");
    } finally {
      setLoadingHospitals(false);
    }
  };

  // Load branches whenever a hospital is selected
  useEffect(() => {
    const loadBranches = async () => {
      if (!selectedHospitalId) {
        setBranches([]);
        setSelectedBranchId("");
        return;
      }

      try {
        setLoadingBranches(true);
        const response = await fetch(`/api/branches?hospitalId=${selectedHospitalId}`);
        const data = await response.json();

        if (data.success && Array.isArray(data.branches)) {
          const branchItems = (data.branches as any[]).map((b) => ({
            id: b.id,
            name: b.name || "Unnamed branch",
          }));
          setBranches(branchItems);

          // Auto-select if only one branch
          if (branchItems.length === 1) {
            setSelectedBranchId(branchItems[0].id);
          }
        } else {
          setBranches([]);
          setSelectedBranchId("");
        }
      } catch (err) {
        console.error("Failed to load branches:", err);
        // Do not block signup entirely; just clear branches
        setBranches([]);
        setSelectedBranchId("");
      } finally {
        setLoadingBranches(false);
      }
    };

    loadBranches();
  }, [selectedHospitalId]);

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

  const handlePatientSubmit = (values: PatientProfileFormValues) => {
    setError("");
    
    // Check if hospital is selected
    if (!selectedHospitalId) {
      setError("Please select a hospital to continue.");
      return;
    }

    // Require branch selection when branches are available
    if (branches.length > 0 && !selectedBranchId) {
      setError("Please select a branch to continue.");
      return;
    }
    
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
      const selectedHospital = selectedHospitalId || null;
      const selectedBranch = branches.find((b) => b.id === selectedBranchId) || null;

      if (!selectedHospital) {
        throw new Error("Hospital selection is required. Please select a hospital.");
      }

      const patientData = {
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
        hospitalId: selectedHospital, // Store hospital association
        defaultBranchId: selectedBranch ? selectedBranch.id : null,
        defaultBranchName: selectedBranch ? selectedBranch.name : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "self",
      };

      // Create patient document in legacy collection (for backward compatibility)
      await setDoc(doc(db, "patients", user.uid), patientData);

      // ALSO create patient in hospital-scoped subcollection (required for patient list)
      await setDoc(
        doc(getHospitalCollection(selectedHospital, "patients"), user.uid),
        patientData
      );

      // Create/update user document in users collection for multi-hospital support
      const userDocRef = doc(db, "users", user.uid);
      const existingUserDoc = await getDoc(userDocRef);
      
      if (existingUserDoc.exists()) {
        // User exists - add hospital to hospitals array if not already present
        const userData = existingUserDoc.data();
        const hospitals = userData?.hospitals || [];
        if (selectedHospital && !hospitals.includes(selectedHospital)) {
          hospitals.push(selectedHospital);
        }
        await setDoc(userDocRef, {
          hospitals,
          activeHospital: selectedHospital,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } else {
        // Create new user document
        await setDoc(userDocRef, {
          uid: user.uid,
          email: values.email,
          role: "patient",
          hospitals: selectedHospital ? [selectedHospital] : [],
          activeHospital: selectedHospital,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Send WhatsApp notification after successful account creation
      const combinedPhone = `${values.countryCode || ""}${
        values.phone || ""
      }`.trim();
      
      // Define fullName outside if block so it's accessible in else block
      const fullName = `${values.firstName || ""} ${values.lastName || ""}`.trim() || "Patient";
      
      if (combinedPhone) {
        const friendlyName = values.firstName?.trim() || "there";
        
        const message = `🎉 *Account Successfully Created!*

Hi ${friendlyName},

Welcome to Harmony Medical Services! Your patient account has been successfully created.

📋 *Account Details:*
• Patient ID: ${patientId}
• Name: ${fullName}
• Email: ${values.email || ""}
${values.phone ? `• Phone: ${combinedPhone}` : ""}

✅ You can now:
• Book appointments with our doctors
• View your medical history
• Access your patient dashboard
• Receive appointment updates and reminders via WhatsApp

If you need any assistance, reply here or call us at +91-XXXXXXXXXX.

Thank you for choosing Harmony Medical Services! 🏥`;

        // Fire-and-forget WhatsApp welcome message so account creation never blocks
        ;(async () => {
          try {
            const phoneToSend = combinedPhone.startsWith("+")
              ? combinedPhone
              : `+${combinedPhone}`

            const response = await fetch("/api/patient/send-whatsapp", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                to: phoneToSend,
                message,
              }),
            })

            const data = await response.json().catch(() => ({}))

            if (!data?.success) {
              console.error("[Signup WhatsApp] ❌ Failed to send account creation message:", {
                phone: phoneToSend,
                error: data?.error || "Unknown error",
                errorCode: data?.errorCode,
                status: response.status,
              })
            }
          } catch (err) {
            console.error("[Signup WhatsApp] ❌ Exception sending account creation message:", {
              phone: combinedPhone,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        })()
      } else {
        console.warn("[Signup WhatsApp] ⚠️ No phone number provided, WhatsApp message not sent. Patient:", fullName);
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

      <div className="min-h-screen flex">
        {/* Left Side - Signup Form */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-50">
          <div className="w-full max-w-md sm:max-w-lg lg:max-w-xl animate-fade-in">
            <div className="text-center mb-6">
              <div className="flex flex-col items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-600 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-2xl">H</span>
                </div>
                <div className="text-center">
                  <h1 className="text-3xl font-bold text-slate-900">HMS</h1>
                  <p className="text-xs text-slate-500 font-medium">Hospital Management System</p>
                  <span className="text-xs text-slate-500 font-medium">
                Create your patient account
              </span>
                </div>
              </div>
           
            </div>

          <div className="flex items-center justify-center gap-6 mb-4 py-4 border-y border-slate-200">
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

            {/* Error Alert */}
            {error && (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-300 p-4 mb-6 rounded-xl shadow-lg animate-shake-fade-in">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center animate-bounce-in">
                    <span className="text-white text-lg font-bold">!</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-red-800 font-semibold leading-relaxed">{error}</p>
                  </div>
                  <button
                    onClick={() => setError("")}
                    className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
                    aria-label="Close error"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Signup Form Content */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-xl">
            {/* Hospital Selection for Patients */}
            {(!selectedHospitalId || hospitals.length > 1) && (
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">
                        Select Hospital *
                      </label>
                      {loadingHospitals ? (
                        <div className="text-center py-4">
                          <LoadingSpinner message="Loading hospitals..." />
                        </div>
                      ) : hospitals.length === 0 ? (
                        <div className="text-center py-4 text-red-600">
                          No hospitals available. Please contact support.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {hospitals.map((hospital) => (
                            <label
                              key={hospital.id}
                              className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                selectedHospitalId === hospital.id
                                  ? "border-blue-500 bg-blue-50"
                                  : "border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              <input
                                type="radio"
                                name="hospital"
                                value={hospital.id}
                                checked={selectedHospitalId === hospital.id}
                                onChange={(e) => setSelectedHospitalId(e.target.value)}
                                className="mt-1 w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                              />
                              <div className="flex-1">
                                <div className="font-medium text-slate-900">
                                  {hospital.name}
                                </div>
                                {hospital.address && (
                                  <div className="text-sm text-slate-600 mt-1">
                                    {hospital.address}
                                  </div>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

            {/* Branch selection for chosen hospital */}
            {selectedHospitalId && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Select Branch {branches.length > 0 && <span className="text-red-500">*</span>}
                </label>
                {loadingBranches ? (
                  <div className="text-center py-3">
                    <LoadingSpinner message="Loading branches..." />
                  </div>
                ) : branches.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No branches are configured for this hospital yet. You can still sign up; a branch can be assigned later.
                  </p>
                ) : (
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a branch</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {selectedHospitalId && (
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
                    href="/auth/login?role=patient"
                    className="font-semibold text-cyan-600 hover:text-cyan-700 transition-colors"
                  >
                    Sign in
                  </a>
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-50 px-4 text-slate-500 font-medium">Trusted by healthcare professionals</span>
              </div>
            </div>

            {/* Footer Trust Badges */}
            <div className="flex items-center justify-center gap-8 text-slate-400">
              <div className="text-center">
                <div className="text-2xl mb-1">🏥</div>
                <p className="text-xs font-medium">Certified</p>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-1">🔐</div>
                <p className="text-xs font-medium">Secure</p>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-1">✅</div>
                <p className="text-xs font-medium">Verified</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Healthcare Imagery & Info */}
        <div className="hidden lg:flex flex-1 bg-gradient-to-br from-cyan-600 via-teal-600 to-cyan-700 p-12 items-start justify-center relative overflow-hidden">
          {/* Decorative Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          </div>

          <div className="relative z-10 text-white max-w-lg pt-8">
            <div className="mb-8">
              <div className="inline-block p-4 bg-white/20 backdrop-blur-sm rounded-2xl mb-6">
                <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-4xl font-bold mb-4 leading-tight">
                Your Health, Our Priority
              </h2>
              <p className="text-cyan-100 text-lg leading-relaxed">
                Access secure, professional healthcare management. Connect with trusted doctors, 
                manage appointments, and take control of your wellness journey.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-white/10 backdrop-blur-sm rounded-lg">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  ✓
                </div>
                <div>
                  <p className="font-semibold">Easy Appointment Booking</p>
                  <p className="text-sm text-cyan-100">Schedule with top doctors in seconds</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-white/10 backdrop-blur-sm rounded-lg">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  ✓
                </div>
                <div>
                  <p className="font-semibold">Secure & Private</p>
                  <p className="text-sm text-cyan-100">Your data protected with encryption</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-white/10 backdrop-blur-sm rounded-lg">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  ✓
                </div>
                <div>
                  <p className="font-semibold">24/7 Access</p>
                  <p className="text-sm text-cyan-100">Manage your health anytime, anywhere</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showOTPModal && pendingPatientValues && (
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
