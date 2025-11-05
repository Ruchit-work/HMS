"use client"

import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import PageHeader from "@/components/ui/PageHeader"

interface Service {
  id: string
  icon: string
  title: string
  description: string
  features: string[]
  availability: string
  category: string
}

const services: Service[] = [
  {
    id: "emergency",
    icon: "🚨",
    title: "24/7 Emergency Services",
    description: "Round-the-clock emergency care with advanced trauma management",
    features: [
      "24/7 Emergency Room",
      "Advanced Life Support",
      "Trauma Care Unit",
      "Emergency Ambulance Services",
      "Critical Care Management"
    ],
    availability: "Available 24/7",
    category: "Emergency"
  },
  {
    id: "diagnostics",
    icon: "🔬",
    title: "Diagnostic Services",
    description: "Comprehensive diagnostic testing with latest technology",
    features: [
      "Complete Blood Count (CBC)",
      "Biochemistry Tests",
      "Microbiology & Culture",
      "Pathology Services",
      "Hormone Testing"
    ],
    availability: "Mon-Sat: 7 AM - 9 PM",
    category: "Diagnostics"
  },
  {
    id: "imaging",
    icon: "📷",
    title: "Medical Imaging",
    description: "Advanced imaging services for accurate diagnosis",
    features: [
      "Digital X-Ray",
      "CT Scan",
      "MRI Scan",
      "Ultrasound",
      "Mammography"
    ],
    availability: "Mon-Sat: 8 AM - 8 PM",
    category: "Diagnostics"
  },
  {
    id: "surgery",
    icon: "⚕️",
    title: "Surgical Services",
    description: "State-of-the-art operation theaters with expert surgeons",
    features: [
      "General Surgery",
      "Laparoscopic Surgery",
      "Orthopedic Surgery",
      "Cardiothoracic Surgery",
      "Neurosurgery"
    ],
    availability: "Available 24/7",
    category: "Surgery"
  },
  {
    id: "pharmacy",
    icon: "💊",
    title: "In-House Pharmacy",
    description: "24/7 pharmacy with all essential and specialized medications",
    features: [
      "Prescription Medicines",
      "OTC Medicines",
      "Medical Supplies",
      "Medicine Home Delivery",
      "Online Prescription Upload"
    ],
    availability: "Available 24/7",
    category: "Pharmacy"
  },
  {
    id: "icu",
    icon: "🏥",
    title: "Intensive Care Unit",
    description: "Advanced ICU facilities with expert critical care team",
    features: [
      "General ICU",
      "Cardiac ICU",
      "Neuro ICU",
      "24/7 Monitoring",
      "Ventilator Support"
    ],
    availability: "Available 24/7",
    category: "Critical Care"
  },
  {
    id: "cardiology",
    icon: "❤️",
    title: "Cardiology Services",
    description: "Comprehensive heart care and cardiac diagnostics",
    features: [
      "ECG & Echo",
      "Stress Test",
      "Angiography",
      "Cardiac Surgery",
      "Heart Health Checkups"
    ],
    availability: "Mon-Sat: 9 AM - 6 PM",
    category: "Specialization"
  },
  {
    id: "physiotherapy",
    icon: "🦴",
    title: "Physiotherapy",
    description: "Rehabilitation and physical therapy services",
    features: [
      "Sports Injury Rehab",
      "Post-Surgery Recovery",
      "Pain Management",
      "Exercise Therapy",
      "Manual Therapy"
    ],
    availability: "Mon-Sat: 8 AM - 7 PM",
    category: "Therapy"
  },
  {
    id: "maternity",
    icon: "🤱",
    title: "Maternity & Childcare",
    description: "Complete care for mother and child",
    features: [
      "Antenatal Care",
      "Normal & C-Section Delivery",
      "Neonatal ICU",
      "Lactation Support",
      "Pediatric Care"
    ],
    availability: "Available 24/7",
    category: "Women & Child"
  },
  {
    id: "dental",
    icon: "🦷",
    title: "Dental Services",
    description: "Complete dental care and oral surgery",
    features: [
      "General Dentistry",
      "Root Canal Treatment",
      "Dental Implants",
      "Teeth Whitening",
      "Orthodontics"
    ],
    availability: "Mon-Sat: 9 AM - 6 PM",
    category: "Specialization"
  },
  {
    id: "health-checkup",
    icon: "📋",
    title: "Health Checkup Packages",
    description: "Comprehensive health screening packages",
    features: [
      "Basic Health Checkup",
      "Executive Health Checkup",
      "Cardiac Health Package",
      "Diabetes Screening",
      "Women's Health Package"
    ],
    availability: "Mon-Sat: 7 AM - 11 AM",
    category: "Preventive Care"
  },
  {
    id: "ambulance",
    icon: "🚑",
    title: "Ambulance Services",
    description: "24/7 emergency ambulance with medical staff",
    features: [
      "Basic Life Support (BLS)",
      "Advanced Life Support (ALS)",
      "Neonatal Ambulance",
      "Patient Transfer",
      "GPS Tracked Fleet"
    ],
    availability: "Available 24/7",
    category: "Emergency"
  }
]

export default function ServicesPage() {
  const { user, loading } = useAuth("patient")

  if (loading) {
    return null
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50/30">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Our Services"
          subtitle="Comprehensive healthcare services with advanced medical technology"
          icon="🏥"
          gradient="from-blue-600 to-cyan-700"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform duration-300">
                  {service.icon}
                </div>
                <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full">
                  {service.category}
                </span>
              </div>

              <h3 className="text-xl font-bold text-slate-800 mb-2">
                {service.title}
              </h3>

              <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                {service.description}
              </p>

              <div className="space-y-2 mb-4">
                {service.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span className="text-sm text-slate-600">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span>🕐</span>
                  <span>{service.availability}</span>
                </div>
              </div>

              <button className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all duration-300 hover:shadow-lg">
                Book Now →
              </button>
            </div>
          ))}
        </div>

        {/* Contact Section */}
        <div className="mt-12 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-8 text-white">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Need Help Choosing a Service?</h2>
            <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
              Our support team is available 24/7 to help you find the right service for your healthcare needs
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="tel:1800-XXX-XXXX"
                className="px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-all duration-300 hover:scale-105"
              >
                📞 Call: 1800-XXX-XXXX
              </a>
              <Link
                href="/patient-dashboard/book-appointment"
                className="px-6 py-3 bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-800 transition-all duration-300 hover:scale-105"
              >
                📅 Book Appointment
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

