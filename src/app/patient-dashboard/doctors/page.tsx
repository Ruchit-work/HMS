"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { db } from "@/firebase/config"
import { collection, query, where, getDocs } from "firebase/firestore"
import { useAuth } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import PageHeader from "@/components/ui/PageHeader"
import Footer from "@/components/ui/Footer"

interface Doctor {
  id: string
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
  specialization: string
  qualification: string
  experience: number
  consultationFee: number
  availableDays?: string[]
  status: string
}

export default function DoctorsPage() {
  const { user, loading: authLoading } = useAuth("patient")
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSpecialization, setSelectedSpecialization] = useState("all")

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const doctorsQuery = query(
          collection(db, "doctors"),
          where("status", "==", "active")
        )
        const snapshot = await getDocs(doctorsQuery)
        const doctorsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Doctor[]
        
        setDoctors(doctorsList)
        setFilteredDoctors(doctorsList)
      } catch (error) {
        console.error("Error fetching doctors:", error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchDoctors()
    }
  }, [user])

  useEffect(() => {
    let filtered = doctors

    if (searchTerm) {
      filtered = filtered.filter(doctor =>
        `${doctor.firstName} ${doctor.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doctor.specialization.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (selectedSpecialization !== "all") {
      filtered = filtered.filter(doctor =>
        doctor.specialization === selectedSpecialization
      )
    }

    setFilteredDoctors(filtered)
  }, [searchTerm, selectedSpecialization, doctors])

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading Doctors..." />
  }

  if (!user) {
    return null
  }

  const specializations = ["all", ...Array.from(new Set(doctors.map(d => d.specialization)))]

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50/30">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Our Doctors"
          subtitle="Expert medical professionals dedicated to your health and wellness"
          icon="👨‍⚕️"
          gradient="from-green-600 to-teal-700"
        />

        {/* Stats Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 sm:p-6 text-center border border-slate-200">
            <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-1">{doctors.length}+</div>
            <div className="text-xs sm:text-sm text-slate-600">Expert Doctors</div>
          </div>
          <div className="bg-white rounded-xl p-4 sm:p-6 text-center border border-slate-200">
            <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-1">{specializations.length - 1}+</div>
            <div className="text-xs sm:text-sm text-slate-600">Specializations</div>
          </div>
          <div className="bg-white rounded-xl p-4 sm:p-6 text-center border border-slate-200">
            <div className="text-2xl sm:text-3xl font-bold text-purple-600 mb-1">24/7</div>
            <div className="text-xs sm:text-sm text-slate-600">Availability</div>
          </div>
          <div className="bg-white rounded-xl p-4 sm:p-6 text-center border border-slate-200">
            <div className="text-2xl sm:text-3xl font-bold text-orange-600 mb-1">4.8⭐</div>
            <div className="text-xs sm:text-sm text-slate-600">Patient Rating</div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Search Doctor
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name or specialization..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 pl-10"
                />
                <span className="absolute left-3 top-3.5 text-slate-400">🔍</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Filter by Specialization
              </label>
              <select
                value={selectedSpecialization}
                onChange={(e) => setSelectedSpecialization(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                {specializations.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec === "all" ? "All Specializations" : spec}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
            <span>Showing {filteredDoctors.length} doctor(s)</span>
            {(searchTerm || selectedSpecialization !== "all") && (
              <button
                onClick={() => {
                  setSearchTerm("")
                  setSelectedSpecialization("all")
                }}
                className="text-green-600 hover:text-green-700 font-semibold"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Doctors Grid */}
        {filteredDoctors.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <span className="text-6xl block mb-4">👨‍⚕️</span>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No doctors found</h3>
            <p className="text-slate-600">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredDoctors.map((doctor) => (
              <div
                key={doctor.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="bg-gradient-to-br from-green-50 to-teal-50 p-6">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-4xl shadow-md mx-auto mb-4">
                    👨‍⚕️
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 text-center mb-1">
                    Dr. {doctor.firstName} {doctor.lastName}
                  </h3>
                  <p className="text-sm text-green-600 font-semibold text-center">
                    {doctor.specialization}
                  </p>
                </div>

                <div className="p-6 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span>🎓</span>
                    <span>{doctor.qualification}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span>💼</span>
                    <span>{doctor.experience} years experience</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span>💰</span>
                    <span>₹{doctor.consultationFee} consultation fee</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span>📧</span>
                    <span className="truncate">{doctor.email}</span>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <Link
                      href="/patient-dashboard/book-appointment"
                      className="block w-full px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white font-semibold rounded-lg text-center hover:from-green-700 hover:to-teal-700 transition-all duration-300 hover:shadow-lg"
                    >
                      Book Appointment
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Help Section */}
        <div className="mt-12 bg-gradient-to-r from-green-600 to-teal-600 rounded-2xl p-8 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Need Help Finding a Doctor?</h2>
          <p className="text-green-100 mb-6 max-w-2xl mx-auto">
            Our support team can help you find the right specialist for your medical needs
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="tel:1800-XXX-XXXX"
              className="px-6 py-3 bg-white text-green-600 font-semibold rounded-lg hover:bg-green-50 transition-all duration-300 hover:scale-105"
            >
              📞 Call: 1800-XXX-XXXX
            </a>
            <Link
              href="/patient-dashboard/book-appointment"
              className="px-6 py-3 bg-green-700 text-white font-semibold rounded-lg hover:bg-green-800 transition-all duration-300 hover:scale-105"
            >
              📅 Book Now
            </Link>
          </div>
        </div>
      </main>
    </div>
    <Footer />
    </>
  )
}

