"use client"

import { useState } from "react"
import Link from "next/link"

export default function HealthInformationSection() {
  const [activeHealthTab, setActiveHealthTab] = useState('daily')

  const handleResourceClick = (resourceType: string) => {
    switch (resourceType) {
      case 'handbook':
        // Show alert for now - can be replaced with actual PDF download
        alert('Patient Handbook PDF will be available soon. This will contain complete hospital policies and procedures.')
        break
      case 'tutorial':
        // Navigate to portal tutorial page
        window.location.href = '/tutorials/patient-portal-guide'
        break
      default:
        console.log('Resource clicked:', resourceType)
    }
  }

  return (
    <>
      {/* Health Information - Interactive Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl mb-6 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200">
          <div className="flex items-center gap-3 px-6 py-4">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">📚</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Health Information</h2>
              <p className="text-sm text-slate-600">Essential health tips and resources</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button 
              onClick={() => setActiveHealthTab('daily')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeHealthTab === 'daily' 
                  ? 'bg-slate-800 text-white' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Daily Tips
            </button>
            <button 
              onClick={() => setActiveHealthTab('seasonal')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeHealthTab === 'seasonal' 
                  ? 'bg-slate-800 text-white' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Seasonal Guide
            </button>
            <button 
              onClick={() => setActiveHealthTab('prevention')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeHealthTab === 'prevention' 
                  ? 'bg-slate-800 text-white' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Prevention
            </button>
            <button 
              onClick={() => setActiveHealthTab('faq')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeHealthTab === 'faq' 
                  ? 'bg-slate-800 text-white' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              FAQ
            </button>
          </div>

          {/* Tab Content */}
          <div className="space-y-4">
            {activeHealthTab === 'daily' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-slate-600 text-sm">💧</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 mb-1">Stay Hydrated</p>
                    <p className="text-xs text-slate-600">Drink 8-10 glasses of water daily for optimal kidney function and overall health.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-slate-600 text-sm">🚶</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 mb-1">Daily Exercise</p>
                    <p className="text-xs text-slate-600">Take a 30-minute walk daily to improve cardiovascular health and mental well-being.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-slate-600 text-sm">😴</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 mb-1">Quality Sleep</p>
                    <p className="text-xs text-slate-600">Get 7-9 hours of quality sleep each night for optimal recovery and immune function.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-slate-600 text-sm">🧘</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 mb-1">Stress Management</p>
                    <p className="text-xs text-slate-600">Practice 10 minutes of meditation or deep breathing to reduce stress and anxiety.</p>
                  </div>
                </div>
              </div>
            )}

            {activeHealthTab === 'seasonal' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-slate-600 text-sm">🍃</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 mb-1">Spring Health</p>
                    <p className="text-xs text-slate-600">Manage allergies with proper medication, keep windows closed during high pollen days, and use air purifiers indoors.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-slate-600 text-sm">☀️</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 mb-1">Summer Safety</p>
                    <p className="text-xs text-slate-600">Stay cool, wear sunscreen (SPF 30+), stay hydrated, and avoid prolonged sun exposure during peak hours.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-slate-600 text-sm">🍁</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 mb-1">Fall Wellness</p>
                    <p className="text-xs text-slate-600">Boost immunity with vitamin C, get flu shots, maintain indoor humidity levels, and prepare for seasonal changes.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-slate-600 text-sm">❄️</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 mb-1">Winter Care</p>
                    <p className="text-xs text-slate-600">Stay warm, maintain indoor humidity, get flu shots, and be cautious of icy conditions to prevent falls.</p>
                  </div>
                </div>
              </div>
            )}

            {activeHealthTab === 'prevention' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-slate-600">✓</span>
                  <p className="text-sm text-slate-700">Annual physical examination and health screening</p>
                </div>
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-slate-600">✓</span>
                  <p className="text-sm text-slate-700">Blood pressure monitoring (monthly if at risk)</p>
                </div>
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-slate-600">✓</span>
                  <p className="text-sm text-slate-700">Cholesterol screening (every 5 years, more frequent if at risk)</p>
                </div>
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-slate-600">✓</span>
                  <p className="text-sm text-slate-700">Diabetes screening (annually if at risk)</p>
                </div>
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-slate-600">✓</span>
                  <p className="text-sm text-slate-700">Age-appropriate cancer screenings (mammograms, colonoscopies, etc.)</p>
                </div>
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-slate-600">✓</span>
                  <p className="text-sm text-slate-700">Keep vaccinations up to date (flu, COVID-19, tetanus, etc.)</p>
                </div>
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-slate-600">✓</span>
                  <p className="text-sm text-slate-700">Dental checkups and cleanings (every 6 months)</p>
                </div>
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-slate-600">✓</span>
                  <p className="text-sm text-slate-700">Eye examinations (every 1-2 years)</p>
                </div>
              </div>
            )}

            {activeHealthTab === 'faq' && (
              <div className="space-y-4">
                <div className="p-4 border border-slate-200 rounded-lg">
                  <p className="text-sm font-semibold text-slate-800 mb-2">When should I see a doctor?</p>
                  <p className="text-xs text-slate-600">For persistent symptoms lasting more than 3-5 days, severe pain, fever above 101°F, difficulty breathing, chest pain, or any emergency symptoms. Trust your instincts - if something feels wrong, seek medical attention.</p>
                </div>

                <div className="p-4 border border-slate-200 rounded-lg">
                  <p className="text-sm font-semibold text-slate-800 mb-2">How often should I get checkups?</p>
                  <p className="text-xs text-slate-600">Annual checkups for healthy adults under 50. More frequent visits if you have chronic conditions, are over 65, or have risk factors. Your doctor will recommend the best schedule for your health needs.</p>
                </div>

                <div className="p-4 border border-slate-200 rounded-lg">
                  <p className="text-sm font-semibold text-slate-800 mb-2">What should I bring to appointments?</p>
                  <p className="text-xs text-slate-600">Bring your ID, insurance card, current medication list, medical records, list of questions, and any recent test results. Having this information ready helps make the most of your visit.</p>
                </div>

                <div className="p-4 border border-slate-200 rounded-lg">
                  <p className="text-sm font-semibold text-slate-800 mb-2">How can I prepare for my appointment?</p>
                  <p className="text-xs text-slate-600">Write down your symptoms, questions, and concerns beforehand. Bring a list of current medications and supplements. Arrive 15 minutes early for paperwork, and don't hesitate to ask questions during your visit.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Patient Resources - Interactive List */}
      <div className="bg-white border border-slate-200 rounded-xl mb-6 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200">
          <div className="flex items-center gap-3 px-6 py-4">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">📋</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Patient Resources</h2>
              <p className="text-sm text-slate-600">Essential guides and support information</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-3">
            {/* Interactive Resource Items */}
            <button 
              onClick={() => handleResourceClick('handbook')}
              className="group w-full flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                  <span className="text-slate-600">📖</span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Patient Handbook</h3>
                  <p className="text-sm text-slate-600">Complete guide to hospital policies and procedures</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">PDF</span>
                <span className="text-slate-400 group-hover:text-slate-600 transition-colors">→</span>
              </div>
            </button>

            <Link 
              href="/patient-dashboard/about"
              className="group flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                  <span className="text-slate-600">🏥</span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Insurance Guide</h3>
                  <p className="text-sm text-slate-600">Coverage details and billing information</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Online</span>
                <span className="text-slate-400 group-hover:text-slate-600 transition-colors">→</span>
              </div>
            </Link>

            <button 
              onClick={() => handleResourceClick('tutorial')}
              className="group w-full flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                  <span className="text-slate-600">💻</span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Portal Tutorial</h3>
                  <p className="text-sm text-slate-600">Learn how to use the patient portal effectively</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Video</span>
                <span className="text-slate-400 group-hover:text-slate-600 transition-colors">→</span>
              </div>
            </button>

            <Link 
              href="/patient-dashboard/about"
              className="group flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                  <span className="text-slate-600">📞</span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Contact Directory</h3>
                  <p className="text-sm text-slate-600">Important phone numbers and contact information</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">List</span>
                <span className="text-slate-400 group-hover:text-slate-600 transition-colors">→</span>
              </div>
            </Link>

            <Link 
              href="/patient-dashboard/about"
              className="group flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                  <span className="text-slate-600">❓</span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">FAQ & Support</h3>
                  <p className="text-sm text-slate-600">Common questions and help resources</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Help</span>
                <span className="text-slate-400 group-hover:text-slate-600 transition-colors">→</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
