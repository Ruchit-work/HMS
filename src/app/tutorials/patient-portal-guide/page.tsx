"use client"

import Link from "next/link"
import PageHeader from "@/components/ui/PageHeader"

export default function PatientPortalTutorial() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader 
        title="Patient Portal Tutorial"
        subtitle="Learn how to use our patient portal effectively"
      />
      
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
                    <li>• Create your account using your email</li>
                    <li>• Verify your email address</li>
                    <li>• Complete your profile information</li>
                    <li>• Set up two-factor authentication</li>
                  </ul>
                </div>

                <div className="p-6 border border-slate-200 rounded-lg">
                  <h3 className="font-semibold text-slate-800 mb-3">📅 Booking Appointments</h3>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li>• Browse available doctors and specializations</li>
                    <li>• Select your preferred date and time</li>
                    <li>• Fill out the appointment form</li>
                    <li>• Complete payment securely</li>
                  </ul>
                </div>

                <div className="p-6 border border-slate-200 rounded-lg">
                  <h3 className="font-semibold text-slate-800 mb-3">📋 Managing Appointments</h3>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li>• View upcoming appointments</li>
                    <li>• Reschedule or cancel appointments</li>
                    <li>• Download appointment confirmations</li>
                    <li>• View appointment history</li>
                  </ul>
                </div>

                <div className="p-6 border border-slate-200 rounded-lg">
                  <h3 className="font-semibold text-slate-800 mb-3">👤 Profile Management</h3>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li>• Update personal information</li>
                    <li>• Add medical history and allergies</li>
                    <li>• Manage insurance details</li>
                    <li>• Update emergency contacts</li>
                  </ul>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
                <h3 className="font-semibold text-blue-800 mb-3">💡 Pro Tips</h3>
                <ul className="space-y-2 text-sm text-blue-700">
                  <li>• Book appointments in advance to secure your preferred time slots</li>
                  <li>• Keep your profile updated with current medications and allergies</li>
                  <li>• Download the appointment confirmation for your records</li>
                  <li>• Use the contact directory for quick access to important numbers</li>
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
