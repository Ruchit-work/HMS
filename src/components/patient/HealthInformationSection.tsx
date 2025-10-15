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
                    <p className="text-xs text-slate-600">Drink 8-10 glasses of water daily, especially during summer. Try buttermilk (chaas) and coconut water for natural hydration.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-slate-600 text-sm">🚶</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 mb-1">Daily Exercise</p>
                    <p className="text-xs text-slate-600">Practice yoga, take morning walks in parks, or do Surya Namaskar. Even 30 minutes of walking daily improves health significantly.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-slate-600 text-sm">😴</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 mb-1">Quality Sleep</p>
                    <p className="text-xs text-slate-600">Sleep 7-9 hours daily. Try light dinner before 8 PM, avoid screens 1 hour before bed, and maintain consistent sleep schedule.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-slate-600 text-sm">🧘</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 mb-1">Stress Management</p>
                    <p className="text-xs text-slate-600">Practice 10 minutes of meditation (dhyan), pranayama breathing, or listen to calming music. Spend time with family and friends.</p>
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
                    <p className="text-sm font-medium text-slate-800 mb-1">Summer Health (March-June)</p>
                    <p className="text-xs text-slate-600">Stay hydrated with nimbu paani, wear cotton clothes, use sunscreen, avoid going out during peak heat (12-4 PM). Eat light, fresh foods.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-slate-600 text-sm">☀️</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 mb-1">Monsoon Health (June-September)</p>
                    <p className="text-xs text-slate-600">Prevent waterborne diseases, drink boiled water, avoid street food, wear mosquito repellent, keep surroundings clean to prevent dengue/malaria.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-slate-600 text-sm">🍁</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 mb-1">Post-Monsoon (October-November)</p>
                    <p className="text-xs text-slate-600">Boost immunity with amla, tulsi, and ginger. Eat seasonal fruits, maintain cleanliness, and get flu vaccination. Prepare for winter health needs.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-slate-600 text-sm">❄️</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 mb-1">Winter Health (December-February)</p>
                    <p className="text-xs text-slate-600">Keep warm with layered clothing, eat hot meals, drink warm water, use moisturizer for dry skin, and be careful of morning fog while driving.</p>
                  </div>
                </div>
              </div>
            )}

            {activeHealthTab === 'prevention' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-slate-600">✓</span>
                  <p className="text-sm text-slate-700">Annual health checkup with complete blood count (CBC)</p>
                </div>
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-slate-600">✓</span>
                  <p className="text-sm text-slate-700">Blood pressure monitoring (especially important in Indian population)</p>
                </div>
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-slate-600">✓</span>
                  <p className="text-sm text-slate-700">Diabetes screening (HbA1c test annually after 30 years)</p>
                </div>
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-slate-600">✓</span>
                  <p className="text-sm text-slate-700">Heart health screening (ECG, lipid profile every 2 years)</p>
                </div>
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-slate-600">✓</span>
                  <p className="text-sm text-slate-700">Thyroid function test (TSH) annually</p>
                </div>
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-slate-600">✓</span>
                  <p className="text-sm text-slate-700">Vitamin D and B12 levels (common deficiencies in India)</p>
                </div>
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-slate-600">✓</span>
                  <p className="text-sm text-slate-700">Cancer screenings (Pap smear for women, PSA for men over 50)</p>
                </div>
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-slate-600">✓</span>
                  <p className="text-sm text-slate-700">Vaccinations: COVID-19, flu, hepatitis B, typhoid</p>
                </div>
              </div>
            )}

            {activeHealthTab === 'faq' && (
              <div className="space-y-4">
                <div className="p-4 border border-slate-200 rounded-lg">
                  <p className="text-sm font-semibold text-slate-800 mb-2">When should I see a doctor?</p>
                  <p className="text-xs text-slate-600">For fever above 100°F, persistent cough/cold for 3+ days, severe headache, chest pain, difficulty breathing, or any emergency. In monsoon season, be extra cautious about waterborne diseases.</p>
                </div>

                <div className="p-4 border border-slate-200 rounded-lg">
                  <p className="text-sm font-semibold text-slate-800 mb-2">What health insurance should I have?</p>
                  <p className="text-xs text-slate-600">Consider comprehensive health insurance covering hospitalization, OPD expenses, and critical illnesses. Many Indian insurers offer family floater plans. Keep your insurance card handy during visits.</p>
                </div>

                <div className="p-4 border border-slate-200 rounded-lg">
                  <p className="text-sm font-semibold text-slate-800 mb-2">What should I bring to appointments?</p>
                  <p className="text-xs text-slate-600">Bring Aadhaar card/ID proof, insurance details, previous medical reports, current medications (including Ayurvedic/home remedies), and a list of questions. Arrive 10-15 minutes early.</p>
                </div>

                <div className="p-4 border border-slate-200 rounded-lg">
                  <p className="text-sm font-semibold text-slate-800 mb-2">How to manage common Indian health issues?</p>
                  <p className="text-xs text-slate-600">For acidity: eat smaller meals, avoid spicy food. For seasonal allergies: keep windows closed, use air purifiers. For joint pain: regular exercise, maintain healthy weight. Always consult doctor for persistent issues.</p>
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
                  <h3 className="font-semibold text-slate-800">Health Insurance Guide</h3>
                  <p className="text-sm text-slate-600">Indian health insurance coverage, cashless treatment, and claim procedures</p>
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
                  <h3 className="font-semibold text-slate-800">Patient Portal Tutorial</h3>
                  <p className="text-sm text-slate-600">Step-by-step guide to book appointments, view reports, and manage health records</p>
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
                  <h3 className="font-semibold text-slate-800">Emergency Contacts</h3>
                  <p className="text-sm text-slate-600">Hospital emergency numbers, ambulance services, and helpline contacts</p>
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
