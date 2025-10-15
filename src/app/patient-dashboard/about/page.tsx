"use client"

import { useAuth } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/LoadingSpinner"
import Footer from "@/components/Footer"

export default function PatientAbout() {
  // Protect route - only allow patients
  const { user, loading } = useAuth("patient")

  if (loading) {
    return <LoadingSpinner message="Loading..." />
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
              <h1 className="text-2xl font-bold">About Our System</h1>
              <p className="text-slate-200 text-sm mt-1">Learn more about our hospital management platform</p>
            </div>
          </div>
        </div>

        {/* About Content */}
        <div className="space-y-6">
          {/* Mission */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">🎯</span>
              <span>Our Mission</span>
            </h2>
            <p className="text-slate-600 leading-relaxed">
              We are dedicated to providing a seamless healthcare experience through our advanced Hospital Management System. 
              Our platform connects patients with qualified healthcare professionals, making healthcare accessible, 
              efficient, and patient-centered.
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
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  📅
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Easy Appointment Booking</h3>
                  <p className="text-sm text-slate-600">Book appointments with doctors in just a few clicks</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  👨‍⚕️
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Qualified Doctors</h3>
                  <p className="text-sm text-slate-600">Access to experienced healthcare professionals</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  💳
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Flexible Payment</h3>
                  <p className="text-sm text-slate-600">Multiple payment options including partial payments</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  📱
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">24/7 Access</h3>
                  <p className="text-sm text-slate-600">Manage your appointments anytime, anywhere</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  🩺
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Medical Records</h3>
                  <p className="text-sm text-slate-600">View prescriptions and doctor's notes</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  🔔
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Smart Notifications</h3>
                  <p className="text-sm text-slate-600">Get notified about your appointments and updates</p>
                </div>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">🚀</span>
              <span>How It Works</span>
            </h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-slate-700 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Choose Your Doctor</h3>
                  <p className="text-sm text-slate-600">Browse our list of qualified doctors and select based on specialization</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 bg-slate-700 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Schedule Appointment</h3>
                  <p className="text-sm text-slate-600">Pick a convenient date and time for your consultation</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 bg-slate-700 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Provide Medical Information</h3>
                  <p className="text-sm text-slate-600">Share your symptoms and medical history for better consultation</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 bg-slate-700 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                  4
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Complete Payment</h3>
                  <p className="text-sm text-slate-600">Pay consultation fee securely online or at the hospital</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                  ✓
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Attend Consultation</h3>
                  <p className="text-sm text-slate-600">Visit the hospital at your scheduled time for consultation</p>
                </div>
              </div>
            </div>
          </div>

          {/* Support */}
          <div className="bg-gradient-to-r from-teal-50 to-blue-50 border border-teal-200 rounded-xl p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">💬</span>
              <span>Need Help?</span>
            </h2>
            <p className="text-slate-600 mb-4">
              Our support team is here to assist you with any questions or concerns. 
              Feel free to reach out to us through the Contact page.
            </p>
            <a 
              href="/patient-dashboard/contact" 
              className="inline-block bg-slate-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-slate-900 transition-colors"
            >
              Contact Support
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

