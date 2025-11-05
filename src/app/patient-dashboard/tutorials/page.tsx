"use client"

import Link from "next/link"
import PageHeader from "@/components/ui/PageHeader"

export default function PatientPortalTutorial() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader 
        title="Patient Portal Tutorial"
        subtitle="भारतीय रोगियों के लिए पोर्टल गाइड - Learn how to use our patient portal effectively" icon={""}      />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📚</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Patient Portal Guide</h2>
                <p className="text-slate-600">Step-by-step instructions to help you navigate the patient portal</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="p-6 border border-slate-200 rounded-lg">
                  <h3 className="font-semibold text-slate-800 mb-3">📱 Getting Started</h3>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li>• Create account using mobile number or email</li>
                    <li>• Verify OTP sent to your mobile</li>
                    <li>• Complete profile with Aadhaar card details</li>
                    <li>• Add family members to your account</li>
                  </ul>
                </div>

                <div className="p-6 border border-slate-200 rounded-lg">
                  <h3 className="font-semibold text-slate-800 mb-3">📅 Booking Appointments</h3>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li>• Browse doctors by specialization (Cardiology, Orthopedics, etc.)</li>
                    <li>• Check available slots (morning/evening sessions)</li>
                    <li>• Fill symptoms and medical history</li>
                    <li>• Pay online via UPI, cards, or net banking</li>
                  </ul>
                </div>

                <div className="p-6 border border-slate-200 rounded-lg">
                  <h3 className="font-semibold text-slate-800 mb-3">📋 Managing Appointments</h3>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li>• View upcoming appointments with doctor details</li>
                    <li>• Reschedule 24 hours before appointment</li>
                    <li>• Download appointment slip for hospital visit</li>
                    <li>• Access previous consultation reports</li>
                  </ul>
                </div>

                <div className="p-6 border border-slate-200 rounded-lg">
                  <h3 className="font-semibold text-slate-800 mb-3">👤 Profile Management</h3>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li>• Update personal details and address</li>
                    <li>• Add medical history, allergies, current medications</li>
                    <li>• Upload health insurance details</li>
                    <li>• Set emergency contacts and family details</li>
                  </ul>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
                <h3 className="font-semibold text-blue-800 mb-3">💡 भारतीय रोगियों के लिए टिप्स</h3>
                <ul className="space-y-2 text-sm text-blue-700">
                  <li>• Book morning slots (9-11 AM) for faster consultation</li>
                  <li>• Carry Aadhaar card and insurance details to hospital</li>
                  <li>• Download appointment slip on your mobile for easy access</li>
                  <li>• Keep emergency contacts updated for family members</li>
                  <li>• Use UPI for faster payment processing</li>
                </ul>
              </div>

              <div className="text-center">
                <Link 
                  href="/patient-dashboard"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                >
                  <span>←</span>
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}


