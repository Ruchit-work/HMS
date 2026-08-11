"use client";

import Link from "next/link";

export default function SignUp() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-50">
      <div className="w-full max-w-md animate-fade-in text-center">
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-gradient-to-br from-cyan-600 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg text-white font-bold text-2xl">
              H
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">HMS</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Hospital Management System</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-cyan-50 border border-cyan-100 text-cyan-900 text-sm leading-relaxed font-medium">
            Patient account registration is currently handled by the hospital.
          </div>

          <p className="text-xs text-slate-500">
            Please contact the hospital receptionist or front desk to get your patient account created.
          </p>

          <div className="pt-2">
            <Link
              href="/auth/login?role=patient"
              className="inline-flex items-center justify-center w-full py-3 px-4 rounded-full bg-gradient-to-r from-cyan-600 to-teal-600 text-white text-sm font-semibold shadow-md hover:from-cyan-700 hover:to-teal-700 transition-all"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
