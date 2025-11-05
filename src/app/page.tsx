"use client"

import Link from "next/link"
import { usePublicRoute } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/ui/LoadingSpinner"

export default function Home() {
  // Redirect authenticated users to their dashboard
  const { loading } = usePublicRoute()
  
  if (loading) {
    return <LoadingSpinner message="Loading..." />
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 relative z-10">
        {/* Compact Hero Section */}
        <div className="text-center mb-6 sm:mb-8 px-2">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mb-3">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur-lg opacity-30"></div>
              <div className="relative bg-gradient-to-br from-blue-600 to-purple-600 p-2 sm:p-2.5 rounded-xl shadow-lg">
                <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 break-words px-2">
              Hospital Management System
            </h1>
          </div>
          <p className="text-xs sm:text-sm md:text-base text-gray-600 mb-3 max-w-2xl mx-auto leading-relaxed px-2">
            Streamline your healthcare operations with our comprehensive platform
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2 text-xs text-gray-500 px-2">
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="whitespace-nowrap">HIPAA Compliant</span>
            </div>
            <span className="mx-1 hidden sm:inline">•</span>
            <span className="whitespace-nowrap">Secure & Encrypted</span>
            <span className="mx-1 hidden sm:inline">•</span>
            <span className="whitespace-nowrap">24/7 Support</span>
          </div>
        </div>

        {/* Main Action Cards - Prominently Displayed */}
        <div className="flex justify-center max-w-2xl mx-auto mb-6 sm:mb-8 px-2">
          {/* Unified Healthcare Portal */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6 md:p-8 w-full hover:shadow-xl transition-shadow duration-300">
            {/* Icon and Title */}
            <div className="flex flex-col items-center mb-4 sm:mb-6">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-3 sm:mb-4 shadow-md flex-shrink-0">
                <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 text-center break-words px-2">
                Healthcare Portal
              </h2>
              <p className="text-xs sm:text-sm md:text-base text-gray-600 text-center max-w-md leading-relaxed px-2 break-words">
                Book appointments, view your medical records, and manage your healthcare journey all in one place.
              </p>
              <p className="text-xs text-gray-500 mt-2 text-center px-2 break-words">
                Also available for doctors, administrators, and receptionists
            </p>
            </div>
            
            {/* Action Buttons */}
            <div className="space-y-2 sm:space-y-3">
              <Link 
                href="/auth/login"
                className="group flex items-center justify-center w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span className="whitespace-nowrap">Login</span>
              </Link>
              
              <Link 
                href="/auth/signup"
                className="flex items-center justify-center w-full border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-12-9a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" />
                </svg>
                <span className="whitespace-nowrap">Sign Up</span>
              </Link>
            </div>
            </div>
          </div>

        {/* Credentials Table Section - Moved Below Portal */}
        <div className="max-w-5xl mx-auto mb-8 sm:mb-10 px-2">
          <details className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 overflow-hidden">
            <summary className="cursor-pointer px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600/10 to-purple-600/10 hover:from-blue-600/20 hover:to-purple-600/20 transition-colors flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <h2 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 truncate">
                  Test Credentials
                </h2>
              </div>
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 transition-transform duration-200 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="p-2 sm:p-4 pt-2">
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="w-full border-collapse min-w-[320px]">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-600 to-purple-600">
                      <th className="px-2 sm:px-3 md:px-4 py-2 text-left text-[10px] xs:text-xs sm:text-xs font-bold text-white uppercase tracking-wider">
                        Email ID
                      </th>
                      <th className="px-2 sm:px-3 md:px-4 py-2 text-left text-[10px] xs:text-xs sm:text-xs font-bold text-white uppercase tracking-wider">
                        Password
                      </th>
                      <th className="px-2 sm:px-3 md:px-4 py-2 text-left text-[10px] xs:text-xs sm:text-xs font-bold text-white uppercase tracking-wider">
                        Role
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    <tr className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-2 sm:px-3 md:px-4 py-2 text-[10px] xs:text-xs sm:text-sm font-medium text-gray-900 break-all">
                        Patient1@gmail.com
                      </td>
                      <td className="px-2 sm:px-3 md:px-4 py-2 text-[10px] xs:text-xs sm:text-sm text-gray-600 font-mono break-all">
                        Patient1@gmail.com
                      </td>
                      <td className="px-2 sm:px-3 md:px-4 py-2">
                        <span className="inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] xs:text-xs font-semibold rounded-full bg-blue-100 text-blue-800 whitespace-nowrap">
                          Patient
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-green-50/50 transition-colors">
                      <td className="px-2 sm:px-3 md:px-4 py-2 text-[10px] xs:text-xs sm:text-sm font-medium text-gray-900 break-all">
                        Doctor1@gmail.com
                      </td>
                      <td className="px-2 sm:px-3 md:px-4 py-2 text-[10px] xs:text-xs sm:text-sm text-gray-600 font-mono break-all">
                        Doctor1@gmail.com
                      </td>
                      <td className="px-2 sm:px-3 md:px-4 py-2">
                        <span className="inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] xs:text-xs font-semibold rounded-full bg-green-100 text-green-800 whitespace-nowrap">
                          Doctor
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-purple-50/50 transition-colors">
                      <td className="px-2 sm:px-3 md:px-4 py-2 text-[10px] xs:text-xs sm:text-sm font-medium text-gray-900 break-all">
                        Admin1@gmail.com
                      </td>
                      <td className="px-2 sm:px-3 md:px-4 py-2 text-[10px] xs:text-xs sm:text-sm text-gray-600 font-mono break-all">
                        Admin1@gmail.com
                      </td>
                      <td className="px-2 sm:px-3 md:px-4 py-2">
                        <span className="inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] xs:text-xs font-semibold rounded-full bg-purple-100 text-purple-800 whitespace-nowrap">
                          Admin
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-orange-50/50 transition-colors">
                      <td className="px-2 sm:px-3 md:px-4 py-2 text-[10px] xs:text-xs sm:text-sm font-medium text-gray-900 break-all">
                        Receptionist1@gmail.com
                      </td>
                      <td className="px-2 sm:px-3 md:px-4 py-2 text-[10px] xs:text-xs sm:text-sm text-gray-600 font-mono break-all">
                        Receptionist1@gmail.com
                      </td>
                      <td className="px-2 sm:px-3 md:px-4 py-2">
                        <span className="inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] xs:text-xs font-semibold rounded-full bg-orange-100 text-orange-800 whitespace-nowrap">
                          Receptionist
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
            </div>
            </div>
          </details>
        </div>

        {/* Features Section */}
        <div className="max-w-7xl mx-auto mb-12 sm:mb-16 px-2">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 mb-3 sm:mb-4 px-2 break-words">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600">
            Key Features
              </span>
          </h2>
            <p className="text-sm sm:text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-2 break-words">
              Everything you need to manage your healthcare operations efficiently
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            <div className="group relative bg-white/80 backdrop-blur-sm rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-gray-100 hover:border-purple-200 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3 text-center break-words">Appointment Management</h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed text-center break-words">Schedule, reschedule, and manage appointments seamlessly with our intuitive interface</p>
              </div>
            </div>
            
            <div className="group relative bg-white/80 backdrop-blur-sm rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-gray-100 hover:border-orange-200 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3 text-center break-words">Patient Records</h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed text-center break-words">Maintain comprehensive patient medical histories with secure and organized documentation</p>
              </div>
            </div>
            
            <div className="group relative bg-white/80 backdrop-blur-sm rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-gray-100 hover:border-teal-200 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 sm:col-span-2 lg:col-span-1">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-teal-100 to-teal-200 rounded-xl flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3 text-center break-words">Real-time Updates</h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed text-center break-words">Get instant notifications and schedule updates to stay informed at all times</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 pt-6 sm:pt-8 border-t border-gray-200/50 px-2">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-4 sm:mb-6">
            <div className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors cursor-pointer">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-xs sm:text-sm font-medium break-all">support@hms.com</span>
            </div>
            <div className="hidden sm:block w-1 h-1 bg-gray-400 rounded-full"></div>
            <div className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors cursor-pointer">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="text-xs sm:text-sm font-medium break-all">+1 (555) 123-4567</span>
            </div>
          </div>
          <p className="text-gray-500 text-xs sm:text-sm px-2 break-words">
            © 2024 Hospital Management System. All rights reserved.
          </p>
        </div>
      </div>
    </div>
    
    </>
  )
  
}