"use client"

import { useEffect, useState } from "react"
import { db } from "@/firebase/config"
import { doc, getDoc } from "firebase/firestore"
import { useAuth } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/LoadingSpinner"
import Notification from "@/components/Notification"
import Footer from "@/components/Footer"

export default function PatientAboutSupport() {
  const [submitting, setSubmitting] = useState(false)
  const [notification, setNotification] = useState<{type: "success" | "error", message: string} | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  })

  // Protect route - only allow patients
  const { user, loading } = useAuth("patient")

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const patientDoc = await getDoc(doc(db, "patients", user.uid))
      if (patientDoc.exists()) {
        const data = patientDoc.data()
        setFormData(prev => ({
          ...prev,
          name: `${data.firstName} ${data.lastName}`,
          email: data.email
        }))
      }
    }

    fetchData()
  }, [user])

  if (loading) {
    return <LoadingSpinner message="Loading..." />
  }

  if (!user) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.subject || !formData.message) {
      setNotification({ type: "error", message: "Please fill all required fields" })
      return
    }

    setSubmitting(true)
    
    // Simulate form submission
    setTimeout(() => {
      setNotification({ 
        type: "success", 
        message: "Message sent successfully! We'll get back to you soon." 
      })
      setFormData(prev => ({
        ...prev,
        subject: "",
        message: ""
      }))
      setSubmitting(false)
    }, 1500)
  }

  return (
    <>
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Page Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 rounded-xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-3xl">
              ℹ️
            </div>
            <div>
              <h1 className="text-2xl font-bold">About & Support</h1>
              <p className="text-slate-200 text-sm mt-1">Learn about our system and get help when you need it</p>
            </div>
          </div>
        </div>

        {/* About Content */}
        <div className="space-y-6 mb-8">
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
        </div>

        {/* Support Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="text-2xl">💬</span>
                <span>Need Help? Contact Us</span>
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                      disabled
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                      disabled
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                    placeholder="What is your inquiry about?"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    rows={6}
                    placeholder="Tell us more about your inquiry..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 px-6 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Sending..." : "Send Message"}
                </button>
              </form>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-6">
            {/* Contact Details */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Contact Information</h2>
              
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    📍
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Address</h3>
                    <p className="text-sm text-slate-600">123 Medical Center Drive<br/>Healthcare City, HC 12345</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    📞
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Phone</h3>
                    <p className="text-sm text-slate-600">+1 (555) 123-4567</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    📧
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Email</h3>
                    <p className="text-sm text-slate-600">support@hospital.com</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    🕐
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Hours</h3>
                    <p className="text-sm text-slate-600">24/7 Emergency Services<br/>Mon-Fri: 8AM - 8PM<br/>Sat-Sun: 9AM - 5PM</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Emergency */}
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-red-800 mb-2 flex items-center gap-2">
                <span>🚨</span>
                <span>Emergency?</span>
              </h3>
              <p className="text-sm text-red-700 mb-4">
                For medical emergencies, please call our 24/7 emergency hotline or visit the nearest emergency room.
              </p>
              <a 
                href="tel:911" 
                className="block text-center bg-red-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-red-700 transition-colors"
              >
                Call Emergency: 911
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Notification Toast */}
      {notification && (
        <Notification 
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
    <Footer />
    </>
  )
}