"use client"

import Link from "next/link"
import { usePublicRoute } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/LoadingSpinner"

export default function Home() {
  // Redirect authenticated users to their dashboard
  const { loading } = usePublicRoute()

  if (loading) {
    return <LoadingSpinner message="Loading..." />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* Hero Section */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6 px-4">
            Hospital Management System
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 mb-6 sm:mb-8 max-w-3xl mx-auto px-4 leading-relaxed">
            Streamline your healthcare operations with our comprehensive hospital management platform. 
            Manage appointments, patient records, and doctor schedules efficiently.
          </p>
        </div>

        {/* Main Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto mb-8 sm:mb-12 lg:mb-16">
          {/* Patient Portal */}
          <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 text-center hover-lift stagger-item">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3 sm:mb-4">Patient Portal</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 leading-relaxed">
              Book appointments, view your medical history, and manage your healthcare journey with ease.
            </p>
            <div className="space-y-3">
              <Link 
                href="/auth/login?role=patient"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-3 sm:py-2.5 rounded-lg transition-all duration-300 active:scale-95 hover:scale-[1.02] shadow-md hover:shadow-lg text-center block text-sm sm:text-base"
              >
                Patient Login
              </Link>
              <Link 
                href="/auth/signup?role=patient"
                className="w-full border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold px-4 py-3 sm:py-2.5 rounded-lg transition-all duration-300 active:scale-95 hover:scale-[1.02] text-center block text-sm sm:text-base"
              >
                Patient Sign Up
              </Link>
            </div>
          </div>

          {/* Doctor Portal */}
          <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 text-center hover-lift stagger-item">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3 sm:mb-4">Doctor Portal</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 leading-relaxed">
              Manage your practice, view appointments, and provide quality healthcare services efficiently.
            </p>
            <div className="space-y-3">
              <Link 
                href="/auth/login?role=doctor"
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-3 sm:py-2.5 rounded-lg transition-all duration-300 active:scale-95 hover:scale-[1.02] shadow-md hover:shadow-lg text-center block text-sm sm:text-base"
              >
                Doctor Login
              </Link>
              <Link 
                href="/auth/signup?role=doctor"
                className="w-full border-2 border-green-600 text-green-600 hover:bg-green-50 font-semibold px-4 py-3 sm:py-2.5 rounded-lg transition-all duration-300 active:scale-95 hover:scale-[1.02] text-center block text-sm sm:text-base"
              >
                Doctor Sign Up
              </Link>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-8 sm:mb-12 px-4">
            Key Features
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="text-center hover-lift stagger-item">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Appointment Management</h3>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">Schedule, reschedule, and manage appointments seamlessly</p>
            </div>
            <div className="text-center hover-lift stagger-item">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Patient Records</h3>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">Maintain comprehensive patient medical histories</p>
            </div>
            <div className="text-center hover-lift stagger-item">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Real-time Updates</h3>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">Get instant notifications and schedule updates</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-16 pt-8 border-t border-gray-200">
          <p className="text-gray-500">
            © 2024 Hospital Management System. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}