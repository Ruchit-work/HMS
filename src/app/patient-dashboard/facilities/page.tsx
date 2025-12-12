"use client"

import { useAuth } from "@/hooks/useAuth"
import PageHeader from "@/components/ui/PageHeader"

interface Facility {
  id: string
  icon: string
  title: string
  description: string
  capacity: string
  features: string[]
  image?: string
}

const facilities: Facility[] = [
  {
    id: "icu",
    icon: "🏥",
    title: "Intensive Care Units",
    description: "State-of-the-art ICU facilities with 24/7 critical care monitoring",
    capacity: "50 Beds",
    features: [
      "Advanced monitoring systems",
      "Ventilator support",
      "Cardiac monitoring",
      "Specialized nursing staff",
      "24/7 intensivist availability"
    ]
  },
  {
    id: "operation-theater",
    icon: "⚕️",
    title: "Operation Theaters",
    description: "Modern operation theaters with advanced surgical equipment",
    capacity: "8 Theaters",
    features: [
      "Laminar flow OTs",
      "Advanced anesthesia equipment",
      "Robotic surgical systems",
      "Hybrid OTs",
      "HEPA filtered air"
    ]
  },
  {
    id: "diagnostic-lab",
    icon: "🔬",
    title: "Diagnostic Laboratory",
    description: "NABL accredited lab with automated systems",
    capacity: "500+ Tests/Day",
    features: [
      "Automated analyzers",
      "Biochemistry lab",
      "Microbiology lab",
      "Pathology services",
      "24/7 emergency testing"
    ]
  },
  {
    id: "radiology",
    icon: "📷",
    title: "Radiology & Imaging Center",
    description: "Comprehensive imaging services with latest technology",
    capacity: "200+ Scans/Day",
    features: [
      "3 Tesla MRI",
      "128-slice CT scanner",
      "Digital X-ray",
      "4D ultrasound",
      "Mammography unit"
    ]
  },
  {
    id: "emergency",
    icon: "🚨",
    title: "Emergency Department",
    description: "24/7 emergency care with trauma management",
    capacity: "24 Beds",
    features: [
      "Triage area",
      "Resuscitation bays",
      "Emergency OT",
      "Trauma care unit",
      "Ambulance bay"
    ]
  },
  {
    id: "pharmacy",
    icon: "💊",
    title: "24/7 In-House Pharmacy",
    description: "Fully stocked pharmacy with all medications",
    capacity: "5000+ Medicines",
    features: [
      "24/7 availability",
      "Online ordering",
      "Home delivery",
      "Drug information center",
      "Insurance billing"
    ]
  },
  {
    id: "dialysis",
    icon: "💉",
    title: "Dialysis Unit",
    description: "Modern dialysis center for kidney care",
    capacity: "20 Machines",
    features: [
      "Hemodialysis",
      "Peritoneal dialysis",
      "CRRT facility",
      "Trained technicians",
      "Emergency dialysis"
    ]
  },
  {
    id: "blood-bank",
    icon: "🩸",
    title: "Blood Bank",
    description: "Licensed blood bank with component separation facility",
    capacity: "24/7 Service",
    features: [
      "All blood groups available",
      "Component therapy",
      "Platelet apheresis",
      "Blood donation camps",
      "Emergency supply"
    ]
  },
  {
    id: "nicu",
    icon: "👶",
    title: "Neonatal ICU",
    description: "Level III NICU for premature and sick newborns",
    capacity: "20 Beds",
    features: [
      "Infant warmers",
      "Ventilators",
      "Phototherapy units",
      "24/7 neonatologist",
      "Kangaroo care facility"
    ]
  },
  {
    id: "cardiac-cath-lab",
    icon: "❤️",
    title: "Cardiac Catheterization Lab",
    description: "Advanced cardiac intervention facility",
    capacity: "2 Labs",
    features: [
      "Angiography",
      "Angioplasty",
      "Pacemaker implantation",
      "24/7 availability",
      "Expert cardiologists"
    ]
  },
  {
    id: "ambulance",
    icon: "🚑",
    title: "Ambulance Services",
    description: "Modern fleet of emergency ambulances",
    capacity: "15 Ambulances",
    features: [
      "Basic life support",
      "Advanced life support",
      "Neonatal ambulance",
      "GPS tracking",
      "24/7 availability"
    ]
  },
  {
    id: "cafeteria",
    icon: "🍽️",
    title: "Cafeteria & Food Court",
    description: "Hygienic food services for patients and visitors",
    capacity: "200 Seating",
    features: [
      "Nutritious meals",
      "Special diet plans",
      "24/7 pantry service",
      "Patient meal delivery",
      "Visitor dining area"
    ]
  }
]

const certifications = [
  { id: 1, title: "NABH Accredited", icon: "🏆", description: "National Accreditation Board" },
  { id: 2, title: "ISO 9001:2015", icon: "✓", description: "Quality Management Certified" },
  { id: 3, title: "NABL Certified Lab", icon: "🔬", description: "Accredited Testing Laboratory" },
  { id: 4, title: "Green Hospital", icon: "🌱", description: "Eco-friendly Infrastructure" },
]

export default function FacilitiesPage() {
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
          title="Our Facilities"
          subtitle="World-class infrastructure and medical technology for superior healthcare"
          icon="🏢"
          gradient="from-purple-600 to-pink-600"
        />

        {/* Statistics Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 text-center border border-slate-200 hover:shadow-lg transition-all">
            <div className="text-3xl font-bold text-blue-600 mb-1">500+</div>
            <div className="text-sm text-slate-600">Total Beds</div>
          </div>
          <div className="bg-white rounded-xl p-6 text-center border border-slate-200 hover:shadow-lg transition-all">
            <div className="text-3xl font-bold text-green-600 mb-1">8</div>
            <div className="text-sm text-slate-600">Operation Theaters</div>
          </div>
          <div className="bg-white rounded-xl p-6 text-center border border-slate-200 hover:shadow-lg transition-all">
            <div className="text-3xl font-bold text-purple-600 mb-1">50+</div>
            <div className="text-sm text-slate-600">ICU Beds</div>
          </div>
          <div className="bg-white rounded-xl p-6 text-center border border-slate-200 hover:shadow-lg transition-all">
            <div className="text-3xl font-bold text-orange-600 mb-1">15</div>
            <div className="text-sm text-slate-600">Ambulances</div>
          </div>
        </div>

        {/* Facilities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {facilities.map((facility) => (
            <div
              key={facility.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6">
                <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center text-4xl shadow-md mb-4">
                  {facility.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  {facility.title}
                </h3>
                <p className="text-sm text-slate-600 mb-3">
                  {facility.description}
                </p>
                <div className="inline-block px-3 py-1 bg-white rounded-full text-sm font-semibold text-purple-600">
                  {facility.capacity}
                </div>
              </div>

              <div className="p-6">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Key Features:</h4>
                <ul className="space-y-2">
                  {facility.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Certifications Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 mb-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">
            Certifications & Accreditations
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {certifications.map((cert) => (
              <div key={cert.id} className="text-center p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl hover:shadow-lg transition-all">
                <div className="text-4xl mb-3">{cert.icon}</div>
                <h3 className="font-bold text-slate-800 mb-1">{cert.title}</h3>
                <p className="text-sm text-slate-600">{cert.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Virtual Tour CTA */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-8 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Experience Our Facilities</h2>
          <p className="text-purple-100 mb-6 max-w-2xl mx-auto">
            Schedule a visit to tour our state-of-the-art facilities and meet our expert medical team
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button className="px-6 py-3 bg-white text-purple-600 font-semibold rounded-lg hover:bg-purple-50 transition-all duration-300 hover:scale-105">
              🎥 Virtual Tour
            </button>
            <button className="px-6 py-3 bg-purple-700 text-white font-semibold rounded-lg hover:bg-purple-800 transition-all duration-300 hover:scale-105">
              📅 Schedule Visit
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

