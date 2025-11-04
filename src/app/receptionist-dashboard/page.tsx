'use client'

import { useEffect, useMemo, useState } from "react"
import { db, auth } from "@/firebase/config"
import { doc, getDoc } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import LoadingSpinner from "@/components/LoadingSpinner"
import Notification from "@/components/Notification"
import PatientManagement from "@/app/admin-dashboard/PatientManagement"
import DoctorManagement from "@/app/admin-dashboard/DoctorManagement"
import AppoinmentManagement from "@/app/admin-dashboard/AppoinmentManagement"
import { collection, getDocs, query, where } from "firebase/firestore"
import { bloodGroups } from "@/constants/signup"
import { getAvailableTimeSlots, isSlotInPast, formatTimeDisplay } from "@/utils/timeSlots"
import { SYMPTOM_CATEGORIES } from "@/components/patient/SymptomSelector"
import PasswordRequirements, { isPasswordValid } from "@/components/PasswordRequirements"

export default function ReceptionistDashboard() {
  const [notification, setNotification] = useState<{type: "success" | "error", message: string} | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"patients" | "doctors" | "appointments">("patients")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [userName, setUserName] = useState<string>("")
  // Booking modal state
  const [showBookModal, setShowBookModal] = useState(false)
  const [bookLoading, setBookLoading] = useState(false)
  const [bookError, setBookError] = useState<string | null>(null)
  const [bookErrorFade, setBookErrorFade] = useState(false)
  const [doctors, setDoctors] = useState<any[]>([])
  const [patients, setPatients] = useState<any[]>([])
  const [patientMode, setPatientMode] = useState<'existing'|'new'>('existing')
  const [searchPatient, setSearchPatient] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [newPatient, setNewPatient] = useState({ firstName:'', lastName:'', email:'', phone:'', gender:'', bloodGroup:'', dateOfBirth:'', address:'' })
  const [newPatientPassword, setNewPatientPassword] = useState('')
  const [newPatientPasswordConfirm, setNewPatientPasswordConfirm] = useState('')
  const [selectedDoctorId, setSelectedDoctorId] = useState('')
  const [appointmentDate, setAppointmentDate] = useState('')
  const [appointmentTime, setAppointmentTime] = useState('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const todayStr = useMemo(()=> new Date().toISOString().split('T')[0], [])
  const [symptomCategory, setSymptomCategory] = useState<string>('')
  const [customSymptom, setCustomSymptom] = useState('')
  const suggestedDoctors = useMemo(()=>{
    if (!symptomCategory || symptomCategory === 'custom') return doctors
    const category = SYMPTOM_CATEGORIES.find(c=>c.id===symptomCategory)
    if (!category) return doctors
    const specs = category.relatedSpecializations.map(s=>s.toLowerCase())
    const filtered = doctors.filter((d:any)=> specs.some(spec=> String(d.specialization||'').toLowerCase().includes(spec)))
    return filtered.length ? filtered : doctors
  }, [symptomCategory, doctors])
  const filteredPatients = useMemo(()=>{
    if (!searchPatient) return patients
    const s = searchPatient.toLowerCase()
    return patients.filter((p:any)=>`${p.firstName} ${p.lastName}`.toLowerCase().includes(s) || p.email?.toLowerCase().includes(s) || p.phone?.toLowerCase().includes(s))
  }, [patients, searchPatient])

  // Protect route - only allow receptionists
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      if (!user) return
      try {
        const recepDoc = await getDoc(doc(db, "receptionists", user.uid))
        if (recepDoc.exists()) {
          const data = recepDoc.data() as any
          setUserName(data.firstName || "Receptionist")
        } else {
          setUserName("Receptionist")
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  // Prefetch lists for booking
  useEffect(()=>{
    const loadLists = async () => {
      try {
        const drQ = query(collection(db,'doctors'), where('status','==','active'))
        const drSnap = await getDocs(drQ)
        setDoctors(drSnap.docs.map(d=>({ id:d.id, ...d.data() })))
        const ptQ = query(collection(db,'patients'), where('status','in',['active','inactive']))
        const ptSnap = await getDocs(ptQ)
        setPatients(ptSnap.docs.map(d=>({ id:d.id, ...d.data() })))
      } catch (e) {
        // ignore
      }
    }
    loadLists()
  }, [])

  // Auto-fade and clear booking error after 5s
  useEffect(() => {
    if (!bookError) return
    setBookErrorFade(false)
    const fadeTimer = setTimeout(() => setBookErrorFade(true), 4000)
    const clearTimer = setTimeout(() => setBookError(null), 5000)
    return () => { clearTimeout(fadeTimer); clearTimeout(clearTimer) }
  }, [bookError])

  // Recompute available slots when doctor or date changes
  useEffect(()=>{
    const compute = async () => {
      setAvailableSlots([])
      setAppointmentTime('')
      if (!selectedDoctorId || !appointmentDate) return
      // doctor object
      const doctor = doctors.find((d:any)=>d.id===selectedDoctorId) || {}
      // fetch appointments for that doctor/date
      try {
        const aptQ = query(collection(db,'appointments'), where('doctorId','==', selectedDoctorId), where('appointmentDate','==', appointmentDate))
        const aptSnap = await getDocs(aptQ)
        const existing = aptSnap.docs.map(d=>({ id:d.id, ...(d.data() as any) }))
        const dateObj = new Date(`${appointmentDate}T00:00:00`)
        const slots = getAvailableTimeSlots(doctor as any, dateObj, existing as any)
        const filtered = slots.filter(s=>!isSlotInPast(s, appointmentDate))
        setAvailableSlots(filtered)
      } catch(_e){
        setAvailableSlots([])
      }
    }
    compute()
  }, [selectedDoctorId, appointmentDate, doctors])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.replace("/auth/login?role=receptionist")
    } catch {
      setNotification({ type: "error", message: "Failed to logout. Please try again." })
    }
  }

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading receptionist dashboard..." />
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-[60] lg:hidden bg-white p-2.5 rounded-lg shadow-md border border-gray-200 hover:shadow-lg hover:bg-gray-50 transition-all duration-200"
        >
          <div className="flex flex-col items-center justify-center w-5 h-5">
            <span className="block w-4 h-0.5 bg-gray-600"></span>
            <span className="block w-4 h-0.5 bg-gray-600 mt-1"></span>
            <span className="block w-4 h-0.5 bg-gray-600 mt-1"></span>
          </div>
        </button>
      )}

      {sidebarOpen && (<div className="fixed inset-0" onClick={() => setSidebarOpen(false)} />)}

      {/* Sidebar (same style as admin) */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex items-center justify-center h-16 px-4 bg-gradient-to-r from-purple-600 to-indigo-600">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-purple-600 font-bold text-lg">H</span>
            </div>
            <h1 className="text-white text-xl font-bold">HMS Receptionist</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto text-white hover:text-purple-200 transition-colors p-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <nav className="mt-8 px-4">
          <div className="space-y-2">
            <button onClick={() => { setActiveTab("patients"); setSidebarOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === "patients" ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" : "text-gray-600 hover:bg-gray-100"}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              Patients
            </button>
            <button onClick={() => { setActiveTab("doctors"); setSidebarOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === "doctors" ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" : "text-gray-600 hover:bg-gray-100"}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Doctors
            </button>
            <button onClick={() => { setActiveTab("appointments"); setSidebarOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === "appointments" ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" : "text-gray-600 hover:bg-gray-100"}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Appointments
            </button>
          </div>
        </nav>
      </div>

      {/* Main Content (same container and header classes) */}
      <div className="lg:ml-64">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 capitalize">
                  {activeTab === "patients" ? "Patient Management" : activeTab === "doctors" ? "Doctor Management" : "Appointment Management"}
                </h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">
                  {activeTab === "patients" ? "Manage patient records and information" : activeTab === "doctors" ? "Manage doctor profiles and schedules" : "Monitor and manage all appointments"}
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-4">
                <button className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm sm:text-base" onClick={() => setNotification({ type: 'success', message: 'Refreshed!' })}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <button className="px-3 py-2 sm:px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm sm:text-base" onClick={()=>setShowBookModal(true)}>Book Appointment</button>
                <div className="relative">
                  <button onClick={() => setShowUserDropdown(!showUserDropdown)} className="flex items-center gap-2 sm:gap-3 hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center"><span className="text-purple-600 font-semibold text-sm">{userName.charAt(0)}</span></div>
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-medium text-gray-900">{userName}</p>
                      <p className="text-xs text-gray-500">Receptionist</p>
                    </div>
                    <svg className={`w-4 h-4 text-gray-500 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {showUserDropdown && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowUserDropdown(false)} />
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                        <div className="px-4 py-2 border-b border-gray-200">
                          <p className="text-sm font-medium text-gray-900">{userName}</p>
                        </div>
                        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                          <span>Logout</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6">
          {activeTab === "patients" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Patient Management</h2>
              <PatientManagement canDelete={true} />
            </div>
          )}
          {activeTab === "doctors" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Doctor Management</h2>
              <DoctorManagement canDelete={false} canAdd={false} />
            </div>
          )}
          {activeTab === "appointments" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Appointment Management</h2>
              <AppoinmentManagement />
            </div>
          )}
        </main>
        {/* Book Appointment Modal */}
        {showBookModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/20" onClick={()=>setShowBookModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[95vh] overflow-auto">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="text-lg font-semibold">Book Appointment</h3>
                <button onClick={()=>setShowBookModal(false)} className="text-gray-600 hover:text-gray-900">✕</button>
              </div>
              <div className="p-6 space-y-6">
                {bookError && (
                  <div className={`bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded transition-opacity duration-1000 ease-out ${bookErrorFade ? 'opacity-0' : 'opacity-100'}`}>
                    {bookError}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <label className={`px-3 py-2 rounded border ${patientMode==='existing'?'border-blue-500 bg-blue-50':'border-gray-300'}`}>
                      <input type="radio" name="pmode" className="mr-2" checked={patientMode==='existing'} onChange={()=>setPatientMode('existing')} />
                      Existing Patient
                    </label>
                    <label className={`px-3 py-2 rounded border ${patientMode==='new'?'border-blue-500 bg-blue-50':'border-gray-300'}`}>
                      <input type="radio" name="pmode" className="mr-2" checked={patientMode==='new'} onChange={()=>setPatientMode('new')} />
                      New Patient
                    </label>
                  </div>
                  {patientMode === 'existing' ? (
                    <div>
                      <input value={searchPatient} onChange={(e)=>setSearchPatient(e.target.value)} placeholder="Search patient by name, email or phone" className="w-full px-3 py-2 border rounded mb-3" />
                      <select value={selectedPatientId} onChange={(e)=>setSelectedPatientId(e.target.value)} className="w-full px-3 py-2 border rounded">
                        <option value="">Select patient</option>
                        {filteredPatients.map((p:any)=>(
                          <option key={p.id} value={p.id}>{p.firstName} {p.lastName} — {p.email}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input placeholder="First name" className="px-3 py-2 border rounded" value={newPatient.firstName} onChange={(e)=>setNewPatient(v=>({...v, firstName:e.target.value}))} />
                      <input placeholder="Last name" className="px-3 py-2 border rounded" value={newPatient.lastName} onChange={(e)=>setNewPatient(v=>({...v, lastName:e.target.value}))} />
                      <input placeholder="Email" type="email" className="px-3 py-2 border rounded" value={newPatient.email} onChange={(e)=>setNewPatient(v=>({...v, email:e.target.value}))} />
                      <input placeholder="Phone" className="px-3 py-2 border rounded" value={newPatient.phone} onChange={(e)=>setNewPatient(v=>({...v, phone:e.target.value}))} />
                      <div className="sm:col-span-1">
                        <input placeholder="Password" type="password" className="w-full px-3 py-2 border rounded" value={newPatientPassword} onChange={(e)=>setNewPatientPassword(e.target.value)} />
                        <PasswordRequirements password={newPatientPassword} />
                      </div>
                      <input placeholder="Confirm Password" type="password" className="px-3 py-2 border rounded" value={newPatientPasswordConfirm} onChange={(e)=>setNewPatientPasswordConfirm(e.target.value)} />
                      <select className="px-3 py-2 border rounded" value={newPatient.gender} onChange={(e)=>setNewPatient(v=>({...v, gender:e.target.value}))}>
                        <option value="">Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                      <select className="px-3 py-2 border rounded" value={newPatient.bloodGroup} onChange={(e)=>setNewPatient(v=>({...v, bloodGroup:e.target.value}))}>
                        <option value="">Blood group</option>
                        {bloodGroups.map(bg => (<option key={bg} value={bg}>{bg}</option>))}
                      </select>
                      <input type="date" className="px-3 py-2 border rounded" value={newPatient.dateOfBirth} onChange={(e)=>setNewPatient(v=>({...v, dateOfBirth:e.target.value}))} />
                      <input placeholder="Address" className="px-3 py-2 border rounded sm:col-span-2" value={newPatient.address} onChange={(e)=>setNewPatient(v=>({...v, address:e.target.value}))} />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-sm text-gray-700 mb-1">Symptoms (suggest doctor)</label>
                    <select value={symptomCategory} onChange={(e)=>{ setSymptomCategory(e.target.value); setSelectedDoctorId(''); if (e.target.value !== 'custom') setCustomSymptom('') }} className="w-full px-3 py-2 border rounded">
                      <option value="">Select symptoms (optional)</option>
                      {SYMPTOM_CATEGORIES.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                      <option value="custom">Custom...</option>
                    </select>
                    {symptomCategory === 'custom' && (
                      <div className="mt-2">
                        <input
                          value={customSymptom}
                          onChange={(e)=>setCustomSymptom(e.target.value)}
                          placeholder="Describe patient symptom (e.g., severe back pain)"
                          className="w-full px-3 py-2 border rounded"
                        />
                        <p className="text-xs text-gray-500 mt-1">Doctor list isn’t auto-filtered for custom text. Please pick a doctor.</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Doctor</label>
                    <select value={selectedDoctorId} onChange={(e)=>setSelectedDoctorId(e.target.value)} className="w-full px-3 py-2 border rounded">
                      <option value="">Select doctor</option>
                      {suggestedDoctors.map((d:any)=>(
                        <option key={d.id} value={d.id}>{d.firstName} {d.lastName} — {d.specialization}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Date</label>
                    <input type="date" min={todayStr} value={appointmentDate} onChange={(e)=>setAppointmentDate(e.target.value)} className="w-full px-3 py-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Available Time</label>
                    <select value={appointmentTime} onChange={(e)=>setAppointmentTime(e.target.value)} className="w-full px-3 py-2 border rounded" disabled={!selectedDoctorId || !appointmentDate}>
                      <option value="">{!selectedDoctorId || !appointmentDate ? 'Select doctor and date first' : (availableSlots.length ? 'Select time' : 'No slots available')}</option>
                      {availableSlots.map(s => (
                        <option key={s} value={s}>{formatTimeDisplay(s)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t flex justify-end gap-2">
                <button className="px-4 py-2 rounded bg-gray-100" onClick={()=>setShowBookModal(false)}>Cancel</button>
                <button disabled={bookLoading} onClick={async()=>{
                  try{
                    setBookLoading(true); setBookError(null)
                    if (!selectedDoctorId){ setBookError('Please select a doctor'); setBookLoading(false); return }
                    if (!appointmentDate || !appointmentTime){ setBookError('Please select date and time'); setBookLoading(false); return }
                    if (!availableSlots.includes(appointmentTime)) { setBookError('Selected time is not available'); setBookLoading(false); return }
                    let patientId = selectedPatientId
                    let patientPayload:any = null
                    if (patientMode==='new'){
                      if (!newPatient.firstName || !newPatient.lastName || !newPatient.email){ setBookError('Fill first name, last name, email'); setBookLoading(false); return }
                      if (!isPasswordValid(newPatientPassword)) { setBookError('Password does not meet requirements'); setBookLoading(false); return }
                      if (newPatientPassword !== newPatientPasswordConfirm){ setBookError('Passwords do not match'); setBookLoading(false); return }
                      const res = await fetch('/api/receptionist/create-patient', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ patientData: { ...newPatient, status:'active', createdBy:'receptionist', createdAt: new Date().toISOString() }, password: newPatientPassword }) })
                      if (!res.ok){ const d = await res.json().catch(()=>({})); throw new Error(d?.error || 'Failed to create patient') }
                      const d = await res.json(); patientId = d.id; patientPayload = { ...newPatient }
                    } else {
                      if (!patientId){ setBookError('Please select an existing patient'); setBookLoading(false); return }
                      const p = patients.find((x:any)=>x.id===patientId); patientPayload = p
                    }
                    // Prevent multiple bookings on the same day for the same patient
                    try {
                      const dupQ = query(
                        collection(db, 'appointments'),
                        where('patientId', '==', patientId),
                        where('appointmentDate', '==', appointmentDate),
                        where('status', '==', 'confirmed')
                      )
                      const dupSnap = await getDocs(dupQ)
                      if (!dupSnap.empty) {
                        setBookError('This patient already has an appointment on this date')
                        setBookLoading(false)
                        return
                      }
                    } catch (_) { /* ignore and proceed */ }

                    const doctor = doctors.find((x:any)=>x.id===selectedDoctorId)
                    const appointmentData = {
                      patientId,
                      patientName: `${patientPayload.firstName || ''} ${patientPayload.lastName || ''}`.trim(),
                      patientEmail: patientPayload.email || '',
                      patientPhone: patientPayload.phone || '',
                      doctorId: doctor?.id,
                      doctorName: `${doctor?.firstName || ''} ${doctor?.lastName || ''}`.trim(),
                      doctorSpecialization: doctor?.specialization || '',
                      appointmentDate,
                      appointmentTime,
                      status: 'confirmed',
                      paymentAmount: doctor?.consultationFee || 0,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      createdBy: 'receptionist'
                    }
                    const res2 = await fetch('/api/receptionist/create-appointment', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ appointmentData }) })
                    if (!res2.ok){ const d = await res2.json().catch(()=>({})); throw new Error(d?.error || 'Failed to create appointment') }
                    setShowBookModal(false)
                    setNotification({ type:'success', message:'Appointment booked successfully' })
                  }catch(e:any){ setBookError(e?.message || 'Failed') } finally { setBookLoading(false) }
                }} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">{bookLoading?'Booking...':'Book'}</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {notification && (
        <Notification 
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  )
}