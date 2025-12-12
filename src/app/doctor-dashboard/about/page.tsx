"use client"

import { useAuth } from "@/hooks/useAuth"

export default function DoctorAbout() {
  // Protect route - only allow doctors
  const { user, loading } = useAuth("doctor")

  if (loading) {
    return null
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Page Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 rounded-xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-3xl">
              ℹ️
            </div>
            <div>
              <h1 className="text-2xl font-bold">About Doctor Portal</h1>
              <p className="text-slate-200 text-sm mt-1">Information for healthcare professionals</p>
            </div>
          </div>
        </div>

        {/* About Content */}
        <div className="space-y-6">
          {/* Overview */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">🏥</span>
              <span>Doctor Portal Overview</span>
            </h2>
            <p className="text-slate-600 leading-relaxed">
              The Doctor Portal is designed to help healthcare professionals manage their appointments efficiently. 
              This comprehensive system provides all the tools you need to deliver excellent patient care while 
              maintaining organized records and streamlined workflows.
            </p>
          </div>

          {/* Features */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">✨</span>
              <span>Key Features</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  📅
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Appointment Management</h3>
                  <p className="text-sm text-slate-600">View and manage all patient appointments in one place</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  👥
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Patient Information</h3>
                  <p className="text-sm text-slate-600">Access patient history and medical records</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  💊
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Prescription Management</h3>
                  <p className="text-sm text-slate-600">Add prescriptions and doctor notes for patients</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  📊
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Analytics Dashboard</h3>
                  <p className="text-sm text-slate-600">Track your appointments and patient statistics</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  📝
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Medical Notes</h3>
                  <p className="text-sm text-slate-600">Document checkup findings and recommendations</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  🏖️
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Leave Management</h3>
                  <p className="text-sm text-slate-600">Track your 12 government leave days</p>
                </div>
              </div>
            </div>
          </div>

          {/* Professional Guidelines */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">📋</span>
              <span>Professional Guidelines</span>
            </h2>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="text-green-600 font-bold">✓</span>
                <p className="text-slate-600">Review patient medical history before each consultation</p>
              </div>
              <div className="flex gap-3">
                <span className="text-green-600 font-bold">✓</span>
                <p className="text-slate-600">Maintain accurate and detailed medical records</p>
              </div>
              <div className="flex gap-3">
                <span className="text-green-600 font-bold">✓</span>
                <p className="text-slate-600">Complete checkups promptly and add prescriptions</p>
              </div>
              <div className="flex gap-3">
                <span className="text-green-600 font-bold">✓</span>
                <p className="text-slate-600">Provide clear instructions and notes for patients</p>
              </div>
              <div className="flex gap-3">
                <span className="text-green-600 font-bold">✓</span>
                <p className="text-slate-600">Manage your schedule and availability effectively</p>
              </div>
            </div>
          </div>

          {/* Leave Policy */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">🏖️</span>
              <span>Government Leave Policy</span>
            </h2>
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-800 mb-2">Annual Leave Entitlement</h3>
                <p className="text-slate-600 text-sm">
                  All doctors are entitled to 12 government-sanctioned leave days per year. 
                  These can be used for personal time, emergencies, or professional development.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-800 mb-2 text-sm">📅 Total Days</h4>
                  <p className="text-2xl font-bold text-slate-800">12</p>
                  <p className="text-xs text-slate-500 mt-1">Days per calendar year</p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-800 mb-2 text-sm">📋 Application</h4>
                  <p className="text-sm text-slate-600">Apply through admin for leave approval</p>
                </div>
              </div>
            </div>
          </div>

          {/* Support */}
          <div className="bg-gradient-to-r from-blue-50 to-teal-50 border border-blue-200 rounded-xl p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">💬</span>
              <span>Need Assistance?</span>
            </h2>
            <p className="text-slate-600 mb-4">
              If you have any questions or need technical support, please contact the hospital administration.
            </p>
            <div className="flex gap-3">
              <div className="bg-white rounded-lg px-4 py-3 border border-slate-200">
                <p className="text-xs text-slate-500">Admin Email</p>
                <p className="text-sm font-semibold text-slate-800">admin@hospital.com</p>
              </div>
              <div className="bg-white rounded-lg px-4 py-3 border border-slate-200">
                <p className="text-xs text-slate-500">Support Phone</p>
                <p className="text-sm font-semibold text-slate-800">+1 (555) 123-4567</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

