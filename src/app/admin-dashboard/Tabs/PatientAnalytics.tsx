'use client'

import { useState, useEffect } from 'react'
import { getDocs } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { useMultiHospital } from '@/contexts/MultiHospitalContext'
import { getHospitalCollection } from '@/utils/hospital-queries'
import LoadingSpinner from '@/components/ui/StatusComponents'
import { formatDate, calculateAge } from '@/utils/date'

interface Patient {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  gender: string
  bloodGroup: string
  dateOfBirth: string
  createdAt: string
  address?: string
}

interface Appointment {
  id: string
  patientId: string
  doctorId?: string
  doctorName?: string
  doctorSpecialization?: string
  appointmentDate: string
  appointmentTime?: string
  chiefComplaint?: string
  status: string
  createdAt: string
  updatedAt?: string
  totalConsultationFee?: number
  paymentAmount?: number
  paymentStatus?: string
  createdBy?: string
  medicine?: string
  finalDiagnosis?: string[]
  customDiagnosis?: string
}

interface PatientAnalytics {
  totalPatients: number
  newPatients: number // Created in last 30 days
  returningPatients: number // Patients with 2+ appointments
  averageVisitsPerYear: number
  patientRetentionRate: number // % of patients who return
  demographicDistribution: {
    gender: Record<string, number>
    ageGroups: Record<string, number>
    bloodGroups: Record<string, number>
  }
  topVisitingPatients: Array<{
    patientId: string
    patientName: string
    visitCount: number
    lastVisit: string
  }>
  monthlyGrowth: Array<{
    month: string
    newPatients: number
    totalPatients: number
  }>
  inactivePatients: number // No visits in last 6 months
  activePatients: number // Visits in last 3 months
  totalAppointments: number // Total appointments in filtered range
  peakVisitingHour: {
    hour: number // 0-23
    hour12: string // "12 AM", "1 PM", etc.
    count: number
  }
  peakVisitingDay: {
    day: string // "Monday", "Tuesday", etc.
    dayShort: string // "Mon", "Tue", etc.
    count: number
  }
  seasonalDiseaseTrends: {
    season: string // "Winter", "Spring", "Summer", "Fall"
    topDiseases: Array<{
      disease: string
      count: number
      percentage: number
    }>
    totalAppointments: number
  }[]
  ageWiseDiseaseBreakdown: {
    ageGroup: string
    topDiseases: Array<{
      disease: string
      count: number
      percentage: number
    }>
    totalAppointments: number
  }[]
  genderWiseDiseaseBreakdown: {
    gender: string
    topDiseases: Array<{
      disease: string
      count: number
      percentage: number
    }>
    totalAppointments: number
  }[]
  areaWiseDistribution: Array<{
    area: string
    patientCount: number
    percentage: number
  }>
  // Diagnosis Analytics (using actual finalDiagnosis)
  mostCommonDiagnoses: Array<{
    diagnosis: string
    count: number
    percentage: number
  }>
  diagnosisTrends: Array<{
    month: string
    diagnoses: Record<string, number>
    totalCases: number
  }>
  symptomDiagnosisCorrelation: Array<{
    symptom: string
    topDiagnoses: Array<{
      diagnosis: string
      count: number
      percentage: number
    }>
    totalCases: number
  }>
}

export default function PatientAnalytics({ selectedBranchId = "all" }: { selectedBranchId?: string } = {}) {
  const { user, loading: authLoading } = useAuth()
  const { activeHospitalId } = useMultiHospital()
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<PatientAnalytics | null>(null)
  const [timeRange, setTimeRange] = useState<'30days' | '3months' | '6months' | '1year' | 'all'>('1year')

  useEffect(() => {
    if (!user || !activeHospitalId) return
    fetchAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeHospitalId, timeRange, selectedBranchId])

  const fetchAnalytics = async () => {
    if (!activeHospitalId) return
    
    try {
      setLoading(true)

      // Fetch all patients - use hospital-scoped collection
      const patientsSnapshot = await getDocs(getHospitalCollection(activeHospitalId, 'patients'))
      let patients: Patient[] = patientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Patient))

      // Filter patients by branch if selected
      if (selectedBranchId !== "all") {
        patients = patients.filter((p: any) => p.defaultBranchId === selectedBranchId)
      }

      // Fetch all appointments - use hospital-scoped collection
      const appointmentsSnapshot = await getDocs(getHospitalCollection(activeHospitalId, 'appointments'))
      let appointments: Appointment[] = appointmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Appointment))

      // Filter appointments by branch if selected
      if (selectedBranchId !== "all") {
        appointments = appointments.filter((apt: any) => apt.branchId === selectedBranchId)
      }

      // Calculate date ranges
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

      // Filter appointments by time range
      let filteredAppointments = appointments
      if (timeRange === '30days') {
        filteredAppointments = appointments.filter(apt => 
          new Date(apt.createdAt || apt.appointmentDate) >= thirtyDaysAgo
        )
      } else if (timeRange === '3months') {
        filteredAppointments = appointments.filter(apt => 
          new Date(apt.createdAt || apt.appointmentDate) >= threeMonthsAgo
        )
      } else if (timeRange === '6months') {
        filteredAppointments = appointments.filter(apt => 
          new Date(apt.createdAt || apt.appointmentDate) >= sixMonthsAgo
        )
      } else if (timeRange === '1year') {
        filteredAppointments = appointments.filter(apt => 
          new Date(apt.createdAt || apt.appointmentDate) >= oneYearAgo
        )
      }

      // Calculate metrics
      const totalPatients = patients.length

      // New patients (created in last 30 days)
      const newPatients = patients.filter(p => {
        const createdDate = new Date(p.createdAt || 0)
        return createdDate >= thirtyDaysAgo
      }).length

      // Count appointments per patient
      const patientVisitCounts: Record<string, number> = {}
      const patientLastVisit: Record<string, Date> = {}
      
      filteredAppointments.forEach(apt => {
        if (apt.patientId) {
          patientVisitCounts[apt.patientId] = (patientVisitCounts[apt.patientId] || 0) + 1
          const visitDate = new Date(apt.appointmentDate || apt.createdAt)
          if (!patientLastVisit[apt.patientId] || visitDate > patientLastVisit[apt.patientId]) {
            patientLastVisit[apt.patientId] = visitDate
          }
        }
      })

      // Returning patients (2+ appointments)
      const returningPatients = Object.values(patientVisitCounts).filter(count => count >= 2).length

      // Average visits per year
      const totalVisits = filteredAppointments.length
      const patientsWithVisits = Object.keys(patientVisitCounts).length
      const averageVisitsPerYear = patientsWithVisits > 0 
        ? (totalVisits / patientsWithVisits) * (365 / getDaysInRange(timeRange))
        : 0

      // Patient retention rate (% who have 2+ visits)
      const patientsWithMultipleVisits = Object.values(patientVisitCounts).filter(count => count >= 2).length
      const patientRetentionRate = patientsWithVisits > 0 
        ? (patientsWithMultipleVisits / patientsWithVisits) * 100 
        : 0

      // Demographic distribution
      const genderDistribution: Record<string, number> = {}
      const ageGroups: Record<string, number> = {}
      const bloodGroupDistribution: Record<string, number> = {}

      patients.forEach(patient => {
        // Gender
        const gender = patient.gender || 'Unknown'
        genderDistribution[gender] = (genderDistribution[gender] || 0) + 1

        // Age groups
        if (patient.dateOfBirth) {
          const age = calculateAge(patient.dateOfBirth)
          if (age !== null && age >= 0) {
            let ageGroup: string
            if (age < 18) ageGroup = '0-17 (Pediatric)'
            else if (age < 30) ageGroup = '18-29 (Young Adult)'
            else if (age < 45) ageGroup = '30-44 (Adult)'
            else if (age < 60) ageGroup = '45-59 (Middle Age)'
            else ageGroup = '60+ (Senior)'
            ageGroups[ageGroup] = (ageGroups[ageGroup] || 0) + 1
          } else {
            // Invalid age calculation - add to unknown category
            ageGroups['Unknown'] = (ageGroups['Unknown'] || 0) + 1
          }
        } else {
          // No date of birth provided - add to unknown category
          ageGroups['Unknown'] = (ageGroups['Unknown'] || 0) + 1
        }

        // Blood groups
        if (patient.bloodGroup) {
          const bg = patient.bloodGroup.toUpperCase()
          bloodGroupDistribution[bg] = (bloodGroupDistribution[bg] || 0) + 1
        }
      })

      // Top visiting patients
      const topVisitingPatients = Object.entries(patientVisitCounts)
        .map(([patientId, visitCount]) => {
          const patient = patients.find(p => p.id === patientId)
          return {
            patientId,
            patientName: patient 
              ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unknown'
              : 'Unknown',
            visitCount,
            lastVisit: patientLastVisit[patientId]?.toISOString() || ''
          }
        })
        .sort((a, b) => b.visitCount - a.visitCount)
        .slice(0, 10)

      // Monthly growth (last 12 months)
      const monthlyGrowth: Array<{ month: string; newPatients: number; totalPatients: number }> = []
      for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
        const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        
        const newInMonth = patients.filter(p => {
          const created = new Date(p.createdAt || 0)
          return created >= monthStart && created <= monthEnd
        }).length

        const totalByMonth = patients.filter(p => {
          const created = new Date(p.createdAt || 0)
          return created <= monthEnd
        }).length

        monthlyGrowth.push({
          month: monthName,
          newPatients: newInMonth,
          totalPatients: totalByMonth
        })
      }

      // Active vs Inactive patients
      const activePatients = new Set(
        appointments
          .filter(apt => {
            const visitDate = new Date(apt.appointmentDate || apt.createdAt)
            return visitDate >= threeMonthsAgo && apt.status !== 'cancelled'
          })
          .map(apt => apt.patientId)
      ).size

      const inactivePatients = totalPatients - activePatients

      // Calculate peak visiting hour
      const hourCounts: Record<number, number> = {}
      filteredAppointments.forEach(apt => {
        if (apt.appointmentTime) {
          // Extract hour from time string (e.g., "14:30" -> 14)
          const timeParts = apt.appointmentTime.split(':')
          if (timeParts.length >= 1) {
            const hour = parseInt(timeParts[0], 10)
            if (!isNaN(hour) && hour >= 0 && hour <= 23) {
              hourCounts[hour] = (hourCounts[hour] || 0) + 1
            }
          }
        }
      })
      
      let peakHour = 9 // Default to 9 AM if no data
      let peakHourCount = 0
      if (Object.keys(hourCounts).length > 0) {
        Object.entries(hourCounts).forEach(([hourStr, count]) => {
          const hour = parseInt(hourStr, 10)
          if (count > peakHourCount) {
            peakHourCount = count
            peakHour = hour
          }
        })
      }

      // Format hour for display (12-hour format)
      const formatHour12 = (hour: number): string => {
        if (hour === 0) return '12 AM'
        if (hour < 12) return `${hour} AM`
        if (hour === 12) return '12 PM'
        return `${hour - 12} PM`
      }

      // Calculate peak visiting day
      const dayCounts: Record<string, number> = {}
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      
      filteredAppointments.forEach(apt => {
        if (apt.appointmentDate) {
          const date = new Date(apt.appointmentDate)
          if (!isNaN(date.getTime())) {
            const dayIndex = date.getDay()
            const dayName = dayNames[dayIndex]
            dayCounts[dayName] = (dayCounts[dayName] || 0) + 1
          }
        }
      })

      let peakDay = 'Monday'
      let peakDayCount = 0
      if (Object.keys(dayCounts).length > 0) {
        Object.entries(dayCounts).forEach(([day, count]) => {
          if (count > peakDayCount) {
            peakDayCount = count
            peakDay = day
          }
        })
      }

      const peakDayIndex = dayNames.indexOf(peakDay)
      const peakDayShort = peakDayIndex >= 0 ? dayNamesShort[peakDayIndex] : peakDay.substring(0, 3)

      // Helper function to get season from date
      const getSeason = (date: Date): string => {
        const month = date.getMonth() + 1 // getMonth() returns 0-11
        if (month >= 12 || month <= 2) return 'Winter'
        if (month >= 3 && month <= 5) return 'Spring'
        if (month >= 6 && month <= 8) return 'Summer'
        return 'Fall'
      }

      // Helper function to categorize disease from chiefComplaint
      const categorizeDisease = (complaint: string): string => {
        if (!complaint) return 'General Consultation'
        
        const lowerComplaint = complaint.toLowerCase()
        
        // Common disease patterns (including Hindi/regional terms)
        const diseasePatterns: Record<string, string> = {
          // Cold & Cough (Winter diseases)
          'cold': 'Cold',
          'sardi': 'Cold',
          'cough': 'Cough',
          'khasi': 'Cough',
          'kukhar': 'Cough',
          'sore throat': 'Sore Throat',
          'throat pain': 'Sore Throat',
          'runny nose': 'Cold',
          'nasal congestion': 'Cold',
          'blocked nose': 'Cold',
          'sneezing': 'Cold',
          
          // Fever
          'fever': 'Fever',
          'bukhar': 'Fever',
          'temperature': 'Fever',
          'high temperature': 'Fever',
          
          // Flu
          'flu': 'Flu',
          'influenza': 'Flu',
          'body ache': 'Flu',
          'body pain': 'Flu',
          'muscle pain': 'Flu',
          
          // Respiratory
          'asthma': 'Asthma',
          'breathing': 'Breathing Issues',
          'shortness of breath': 'Breathing Issues',
          'wheezing': 'Asthma',
          
          // Digestive
          'stomach': 'Stomach Issues',
          'diarrhea': 'Diarrhea',
          'diarrhoea': 'Diarrhea',
          'vomiting': 'Vomiting',
          'nausea': 'Nausea',
          'constipation': 'Constipation',
          'indigestion': 'Indigestion',
          'gas': 'Gas',
          'acidity': 'Acidity',
          
          // Skin
          'rash': 'Skin Rash',
          'itching': 'Skin Issues',
          'allergy': 'Allergy',
          'hives': 'Skin Rash',
          
          // Headache & Pain
          'headache': 'Headache',
          'migraine': 'Migraine',
          'pain': 'Pain',
          'joint pain': 'Joint Pain',
          'back pain': 'Back Pain',
          
          // Infections
          'infection': 'Infection',
          'uti': 'UTI',
          'urinary': 'UTI',
          
          // Seasonal allergies (Spring/Summer)
          'allergic': 'Allergy',
          'hay fever': 'Allergy',
          'pollen': 'Allergy',
          
          // Heat-related (Summer)
          'heat': 'Heat Related',
          'dehydration': 'Dehydration',
          'sunburn': 'Sunburn',
          
          // Mental health
          'anxiety': 'Anxiety',
          'stress': 'Stress',
          'depression': 'Depression',
        }

        // Check for matches (prioritize more specific matches)
        for (const [pattern, disease] of Object.entries(diseasePatterns)) {
          if (lowerComplaint.includes(pattern)) {
            return disease
          }
        }

        // If no match, return as general consultation or use first few words
        const words = complaint.split(/\s+/).slice(0, 3).join(' ')
        return words.length > 30 ? 'General Consultation' : words
      }

      // Calculate seasonal disease trends
      const seasonalData: Record<string, Record<string, number>> = {
        'Winter': {},
        'Spring': {},
        'Summer': {},
        'Fall': {}
      }

      filteredAppointments.forEach(apt => {
        if (apt.appointmentDate && apt.chiefComplaint) {
          const date = new Date(apt.appointmentDate)
          if (!isNaN(date.getTime())) {
            const season = getSeason(date)
            const disease = categorizeDisease(apt.chiefComplaint)
            
            if (seasonalData[season]) {
              seasonalData[season][disease] = (seasonalData[season][disease] || 0) + 1
            }
          }
        }
      })

      // Convert to array format with top diseases per season
      const seasonalDiseaseTrends = Object.entries(seasonalData).map(([season, diseases]) => {
        const totalAppointments = Object.values(diseases).reduce((sum, count) => sum + count, 0)
        
        // Get top 5 diseases for this season
        const topDiseases = Object.entries(diseases)
          .map(([disease, count]) => ({
            disease,
            count,
            percentage: totalAppointments > 0 ? (count / totalAppointments) * 100 : 0
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)

        return {
          season,
          topDiseases,
          totalAppointments
        }
      }).filter(season => season.totalAppointments > 0) // Only include seasons with data

      // Helper function to get age group from patient
      const getAgeGroup = (patient: Patient): string => {
        if (patient.dateOfBirth) {
          const age = calculateAge(patient.dateOfBirth)
          if (age !== null && age >= 0) {
            if (age < 18) return '0-17 (Pediatric)'
            else if (age < 30) return '18-29 (Young Adult)'
            else if (age < 45) return '30-44 (Adult)'
            else if (age < 60) return '45-59 (Middle Age)'
            else return '60+ (Senior)'
          }
        }
        return 'Unknown'
      }

      // Calculate age-wise disease breakdown
      const ageWiseDiseaseData: Record<string, Record<string, number>> = {}
      
      filteredAppointments.forEach(apt => {
        if (apt.chiefComplaint && apt.patientId) {
          const patient = patients.find(p => p.id === apt.patientId)
          if (patient) {
            const ageGroup = getAgeGroup(patient)
            const disease = categorizeDisease(apt.chiefComplaint)
            
            if (!ageWiseDiseaseData[ageGroup]) {
              ageWiseDiseaseData[ageGroup] = {}
            }
            ageWiseDiseaseData[ageGroup][disease] = (ageWiseDiseaseData[ageGroup][disease] || 0) + 1
          }
        }
      })

      // Convert to array format with top diseases per age group
      const ageWiseDiseaseBreakdown = Object.entries(ageWiseDiseaseData).map(([ageGroup, diseases]) => {
        const totalAppointments = Object.values(diseases).reduce((sum, count) => sum + count, 0)
        
        // Get top 5 diseases for this age group
        const topDiseases = Object.entries(diseases)
          .map(([disease, count]) => ({
            disease,
            count,
            percentage: totalAppointments > 0 ? (count / totalAppointments) * 100 : 0
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)

        return {
          ageGroup,
          topDiseases,
          totalAppointments
        }
      }).filter(group => group.totalAppointments > 0) // Only include groups with data

      // Calculate gender-wise disease breakdown
      const genderWiseDiseaseData: Record<string, Record<string, number>> = {}
      
      filteredAppointments.forEach(apt => {
        if (apt.chiefComplaint && apt.patientId) {
          const patient = patients.find(p => p.id === apt.patientId)
          if (patient) {
            const gender = patient.gender || 'Unknown'
            const disease = categorizeDisease(apt.chiefComplaint)
            
            if (!genderWiseDiseaseData[gender]) {
              genderWiseDiseaseData[gender] = {}
            }
            genderWiseDiseaseData[gender][disease] = (genderWiseDiseaseData[gender][disease] || 0) + 1
          }
        }
      })

      // Convert to array format with top diseases per gender
      const genderWiseDiseaseBreakdown = Object.entries(genderWiseDiseaseData).map(([gender, diseases]) => {
        const totalAppointments = Object.values(diseases).reduce((sum, count) => sum + count, 0)
        
        // Get top 5 diseases for this gender
        const topDiseases = Object.entries(diseases)
          .map(([disease, count]) => ({
            disease,
            count,
            percentage: totalAppointments > 0 ? (count / totalAppointments) * 100 : 0
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)

        return {
          gender,
          topDiseases,
          totalAppointments
        }
      }).filter(group => group.totalAppointments > 0) // Only include groups with data

      // Helper function to extract area from address
      const extractArea = (address: string | undefined): string => {
        if (!address || address.trim() === '') return 'Unknown'
        
        const addressLower = address.toLowerCase().trim()
        
        // List of known areas/cities (case-insensitive matching)
        const knownAreas = [
          'hathuka', 'valod', 'bardoli', 'surat', 'navsari', 'vadodara', 'ahmedabad',
          'bharuch', 'anand', 'vapi', 'valsad', 'gandhinagar', 'rajkot', 'jamnagar',
          'bhavnagar', 'mehsana', 'palanpur', 'patan', 'godhra', 'dahod', 'nadiad',
          'anand', 'kalol', 'halol', 'modasa', 'himmatnagar', 'palanpur', 'deesa',
          'unja', 'vyara', 'songadh', 'mahuva', 'veraval', 'porbandar', 'junagadh',
          'amreli', 'botad', 'dhoraji', 'gondal', 'jetpur', 'morbi', 'wankaner',
          'dhrangadhra', 'surendranagar', 'limbdi', 'chotila', 'sayla', 'lakhtar',
          'dasada', 'thangadh', 'dhandhuka', 'dholka', 'bavla', 'sanand', 'daskroi',
          'mandvi', 'anjar', 'bhuj', 'gandhidham', 'rapar', 'bhachau', 'mundra',
          'adipur', 'lakhpat', 'naliya', 'kachchh', 'kutch'
        ]
        
        // Try to find known areas in the address
        for (const area of knownAreas) {
          // Check if area name appears in address (as whole word or part of word)
          const areaRegex = new RegExp(`\\b${area}\\b`, 'i')
          if (areaRegex.test(addressLower)) {
            // Capitalize first letter of each word
            return area.split(' ').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ')
          }
        }
        
        // If no known area found, try to extract city/area from common patterns
        // Look for patterns like "City, State" or "Area, City"
        const cityPatterns = [
          /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*,\s*[A-Z][a-z]+/g, // "City, State"
          /in\s+([A-Z][a-z]+)/gi, // "in City"
          /at\s+([A-Z][a-z]+)/gi, // "at City"
          /near\s+([A-Z][a-z]+)/gi, // "near City"
        ]
        
        for (const pattern of cityPatterns) {
          const match = address.match(pattern)
          if (match && match[0]) {
            const extracted = match[0].replace(/^(in|at|near)\s+/i, '').replace(/,.*$/, '').trim()
            if (extracted && extracted.length > 2) {
              return extracted
            }
          }
        }
        
        // Try to extract first capitalized word (likely city/area name)
        const words = address.split(/[\s,]+/)
        for (const word of words) {
          if (word.length > 2 && /^[A-Z]/.test(word) && /^[A-Za-z]+$/.test(word)) {
            return word
          }
        }
        
        // If nothing found, return "Unknown"
        return 'Unknown'
      }

      // Calculate area-wise patient distribution
      const areaCounts: Record<string, number> = {}
      
      patients.forEach(patient => {
        const area = extractArea(patient.address)
        areaCounts[area] = (areaCounts[area] || 0) + 1
      })

      // Convert to array format and sort by count
      const areaWiseDistribution = Object.entries(areaCounts)
        .map(([area, count]) => ({
          area,
          patientCount: count,
          percentage: totalPatients > 0 ? (count / totalPatients) * 100 : 0
        }))
        .sort((a, b) => b.patientCount - a.patientCount) // Sort by count descending

      // ============================================
      // DIAGNOSIS ANALYTICS (using actual finalDiagnosis)
      // ============================================
      
      // Filter completed appointments with diagnosis
      const completedWithDiagnosis = filteredAppointments.filter(apt => 
        apt.status === 'completed' && 
        apt.finalDiagnosis && 
        Array.isArray(apt.finalDiagnosis) && 
        apt.finalDiagnosis.length > 0
      )

      // 1. Most Common Diagnoses
      const diagnosisCounts: Record<string, number> = {}
      completedWithDiagnosis.forEach(apt => {
        if (apt.finalDiagnosis) {
          apt.finalDiagnosis.forEach(diag => {
            diagnosisCounts[diag] = (diagnosisCounts[diag] || 0) + 1
          })
        }
        if (apt.customDiagnosis) {
          diagnosisCounts['Custom Diagnosis'] = (diagnosisCounts['Custom Diagnosis'] || 0) + 1
        }
      })

      const totalDiagnosisOccurrences = Object.values(diagnosisCounts).reduce((sum, count) => sum + count, 0)
      const mostCommonDiagnoses = Object.entries(diagnosisCounts)
        .map(([diagnosis, count]) => ({
          diagnosis,
          count,
          percentage: totalDiagnosisOccurrences > 0 ? (count / totalDiagnosisOccurrences) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15)

      // 2. Diagnosis Trends (Monthly)
      const monthlyDiagnosisData: Record<string, Record<string, number | string>> = {}
      completedWithDiagnosis.forEach(apt => {
        const date = new Date(apt.appointmentDate)
        if (isNaN(date.getTime())) return
        
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        
        if (!monthlyDiagnosisData[monthKey]) {
          monthlyDiagnosisData[monthKey] = { _label: monthLabel }
        }
        
        if (apt.finalDiagnosis) {
          apt.finalDiagnosis.forEach(diag => {
            const currentValue = monthlyDiagnosisData[monthKey][diag]
            monthlyDiagnosisData[monthKey][diag] = (typeof currentValue === 'number' ? currentValue : 0) + 1
          })
        }
        if (apt.customDiagnosis) {
          const currentValue = monthlyDiagnosisData[monthKey]['Custom Diagnosis']
          monthlyDiagnosisData[monthKey]['Custom Diagnosis'] = (typeof currentValue === 'number' ? currentValue : 0) + 1
        }
      })

      const diagnosisTrends = Object.entries(monthlyDiagnosisData)
        .map(([key, data]: [string, any]) => {
          const { _label, ...diagnoses } = data
          const totalCases = Object.values(diagnoses).reduce((sum: number, count: any) => sum + count, 0)
          return {
            month: _label,
            diagnoses,
            totalCases
          }
        })
        .sort((a, b) => {
          const [aYear, aMonth] = a.month.split(' ')
          const [bYear, bMonth] = b.month.split(' ')
          if (aYear !== bYear) return parseInt(aYear) - parseInt(bYear)
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          return months.indexOf(aMonth) - months.indexOf(bMonth)
        })
        .slice(-12) // Last 12 months

      // 3. Symptom → Diagnosis Correlation
      const symptomData: Record<string, {
        diagnoses: Record<string, number>
        totalCases: number
      }> = {}

      completedWithDiagnosis.forEach(apt => {
        if (!apt.chiefComplaint) return
        
        // Extract key symptoms from chief complaint
        const complaint = apt.chiefComplaint.toLowerCase()
        const symptoms: string[] = []
        
        // Common symptom keywords
        if (complaint.includes('pain') || complaint.includes('ache')) symptoms.push('Pain')
        if (complaint.includes('fever')) symptoms.push('Fever')
        if (complaint.includes('cough')) symptoms.push('Cough')
        if (complaint.includes('cold') || complaint.includes('runny nose')) symptoms.push('Cold/Runny Nose')
        if (complaint.includes('throat') || complaint.includes('sore throat')) symptoms.push('Sore Throat')
        if (complaint.includes('ear') || complaint.includes('hearing')) symptoms.push('Ear Issues')
        if (complaint.includes('nose') || complaint.includes('nasal')) symptoms.push('Nasal Issues')
        if (complaint.includes('breathing') || complaint.includes('breath')) symptoms.push('Breathing Issues')
        if (complaint.includes('dizziness') || complaint.includes('vertigo')) symptoms.push('Dizziness/Vertigo')
        if (complaint.includes('headache')) symptoms.push('Headache')
        
        // If no specific symptoms found, use the complaint itself (truncated)
        if (symptoms.length === 0) {
          symptoms.push(apt.chiefComplaint.substring(0, 50))
        }

        symptoms.forEach(symptom => {
          if (!symptomData[symptom]) {
            symptomData[symptom] = {
              diagnoses: {},
              totalCases: 0
            }
          }
          
          symptomData[symptom].totalCases++
          
          if (apt.finalDiagnosis) {
            apt.finalDiagnosis.forEach(diag => {
              symptomData[symptom].diagnoses[diag] = (symptomData[symptom].diagnoses[diag] || 0) + 1
            })
          }
          if (apt.customDiagnosis) {
            symptomData[symptom].diagnoses['Custom Diagnosis'] = (symptomData[symptom].diagnoses['Custom Diagnosis'] || 0) + 1
          }
        })
      })

      const symptomDiagnosisCorrelation = Object.entries(symptomData)
        .map(([symptom, data]) => {
          const totalDiagOccurrences = Object.values(data.diagnoses).reduce((sum, count) => sum + count, 0)
          const topDiagnoses = Object.entries(data.diagnoses)
            .map(([diagnosis, count]) => ({
              diagnosis,
              count,
              percentage: totalDiagOccurrences > 0 ? (count / totalDiagOccurrences) * 100 : 0
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)

          return {
            symptom,
            topDiagnoses,
            totalCases: data.totalCases
          }
        })
        .sort((a, b) => b.totalCases - a.totalCases)
        .slice(0, 10)

      setAnalytics({
        totalPatients,
        newPatients,
        returningPatients,
        averageVisitsPerYear: Math.round(averageVisitsPerYear * 10) / 10,
        patientRetentionRate: Math.round(patientRetentionRate * 10) / 10,
        demographicDistribution: {
          gender: genderDistribution,
          ageGroups,
          bloodGroups: bloodGroupDistribution
        },
        topVisitingPatients,
        monthlyGrowth,
        inactivePatients,
        activePatients,
        totalAppointments: filteredAppointments.length,
        peakVisitingHour: {
          hour: peakHour,
          hour12: formatHour12(peakHour),
          count: peakHourCount
        },
        peakVisitingDay: {
          day: peakDay,
          dayShort: peakDayShort,
          count: peakDayCount
        },
        seasonalDiseaseTrends,
        ageWiseDiseaseBreakdown,
        genderWiseDiseaseBreakdown,
        areaWiseDistribution,
        // Diagnosis Analytics
        mostCommonDiagnoses,
        diagnosisTrends,
        symptomDiagnosisCorrelation
      })
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  const getDaysInRange = (range: string): number => {
    switch (range) {
      case '30days': return 30
      case '3months': return 90
      case '6months': return 180
      case '1year': return 365
      default: return 365
    }
  }

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading patient analytics..." />
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">No analytics data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Patient Analytics & Insights</h2>
          <p className="text-xs text-slate-600 mt-0.5">Comprehensive patient statistics and metrics</p>
        </div>
        
        {/* Time Range Selector */}
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as any)}
          className="px-4 py-2 border border-slate-300 rounded-lg bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="30days">Last 30 Days</option>
          <option value="3months">Last 3 Months</option>
          <option value="6months">Last 6 Months</option>
          <option value="1year">Last Year</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Patients */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700">Total Patients</span>
            <div className="w-10 h-10 bg-blue-200 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <p className="text-xl font-bold text-blue-900">{analytics.totalPatients.toLocaleString()}</p>
          <p className="text-xs text-blue-600 mt-1">All registered patients</p>
        </div>

        {/* New Patients */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-700">New Patients</span>
            <div className="w-10 h-10 bg-green-200 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
          </div>
          <p className="text-xl font-bold text-green-900">{analytics.newPatients.toLocaleString()}</p>
          <p className="text-xs text-green-600 mt-1">Last 30 days</p>
        </div>

        {/* Returning Patients */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-purple-700">Returning Patients</span>
            <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
          <p className="text-xl font-bold text-purple-900">{analytics.returningPatients.toLocaleString()}</p>
          <p className="text-xs text-purple-600 mt-1">2+ appointments</p>
        </div>

        {/* Average Visits/Year */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-orange-700">Avg Visits/Year</span>
            <div className="w-10 h-10 bg-orange-200 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <p className="text-xl font-bold text-orange-900">{analytics.averageVisitsPerYear}</p>
          <p className="text-xs text-orange-600 mt-1">Per patient</p>
        </div>
      </div>

      {/* Additional Metrics - Single Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Patient Retention */}
        <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-700">Patient Retention Rate</span>
            <span className="text-lg">📈</span>
          </div>
          <p className="text-lg font-bold text-slate-900 mb-2">{analytics.patientRetentionRate}%</p>
          <div className="w-full bg-slate-200 rounded-full h-1.5 mb-1">
            <div 
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(analytics.patientRetentionRate, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">Patients with 2+ visits</p>
        </div>

        {/* Active Patients */}
        <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-700">Active Patients</span>
            <span className="text-lg">✅</span>
          </div>
          <p className="text-lg font-bold text-green-600 mb-1">{analytics.activePatients.toLocaleString()}</p>
          <p className="text-xs text-slate-500">Visits in last 3 months</p>
        </div>

        {/* Inactive Patients */}
        <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-700">Inactive Patients</span>
            <span className="text-lg">⏸️</span>
          </div>
          <p className="text-lg font-bold text-orange-600 mb-1">{analytics.inactivePatients.toLocaleString()}</p>
          <p className="text-xs text-slate-500">No visits in last 6 months</p>
        </div>

        {/* Peak Visiting Hour */}
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-3 border border-indigo-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-indigo-700">Peak Visiting Hour</span>
            <div className="w-6 h-6 bg-indigo-200 rounded-lg flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-base font-bold text-indigo-900 mb-1">{analytics.peakVisitingHour.hour12}</p>
          <p className="text-xs text-indigo-600 mb-1">
            {analytics.peakVisitingHour.count} {analytics.peakVisitingHour.count === 1 ? 'appointment' : 'appointments'}
          </p>
          <div className="w-full bg-indigo-200 rounded-full h-1">
            <div 
              className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-1 rounded-full transition-all"
              style={{ width: `${Math.min((analytics.peakVisitingHour.count / Math.max(analytics.totalAppointments, 1)) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Peak Visiting Day */}
        <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg p-3 border border-teal-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-teal-700">Peak Visiting Day</span>
            <div className="w-6 h-6 bg-teal-200 rounded-lg flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <p className="text-base font-bold text-teal-900 mb-1">{analytics.peakVisitingDay.day}</p>
          <p className="text-xs text-teal-600 mb-1">
            {analytics.peakVisitingDay.count} {analytics.peakVisitingDay.count === 1 ? 'appointment' : 'appointments'}
          </p>
          <div className="w-full bg-teal-200 rounded-full h-1">
            <div 
              className="bg-gradient-to-r from-teal-500 to-teal-600 h-1 rounded-full transition-all"
              style={{ width: `${Math.min((analytics.peakVisitingDay.count / Math.max(analytics.totalAppointments, 1)) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Seasonal Disease Trends */}
      {analytics.seasonalDiseaseTrends.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Seasonal Disease Trends</h3>
              <p className="text-sm text-slate-600 mt-1">Disease patterns by season</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-rose-100 to-rose-200 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {analytics.seasonalDiseaseTrends.map((seasonData) => {
              // Get season color scheme
              const seasonColors: Record<string, { bg: string; border: string; text: string; accent: string }> = {
                'Winter': {
                  bg: 'from-blue-50 to-cyan-50',
                  border: 'border-blue-200',
                  text: 'text-blue-700',
                  accent: 'bg-blue-500'
                },
                'Spring': {
                  bg: 'from-green-50 to-emerald-50',
                  border: 'border-green-200',
                  text: 'text-green-700',
                  accent: 'bg-green-500'
                },
                'Summer': {
                  bg: 'from-orange-50 to-amber-50',
                  border: 'border-orange-200',
                  text: 'text-orange-700',
                  accent: 'bg-orange-500'
                },
                'Fall': {
                  bg: 'from-amber-50 to-yellow-50',
                  border: 'border-amber-200',
                  text: 'text-amber-700',
                  accent: 'bg-amber-500'
                }
              }
              
              const colors = seasonColors[seasonData.season] || seasonColors['Winter']
              const seasonEmoji: Record<string, string> = {
                'Winter': '❄️',
                'Spring': '🌸',
                'Summer': '☀️',
                'Fall': '🍂'
              }
              
              return (
                <div
                  key={seasonData.season}
                  className={`bg-gradient-to-br ${colors.bg} rounded-xl p-5 border ${colors.border} shadow-sm`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{seasonEmoji[seasonData.season] || '📅'}</span>
                      <h4 className={`text-base font-bold ${colors.text}`}>{seasonData.season}</h4>
                    </div>
                    <span className="text-xs font-semibold text-slate-600">
                      {seasonData.totalAppointments} {seasonData.totalAppointments === 1 ? 'visit' : 'visits'}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {seasonData.topDiseases.length > 0 ? (
                      seasonData.topDiseases.map((disease, diseaseIdx) => (
                        <div key={diseaseIdx} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700 truncate flex-1 mr-2">
                              {disease.disease}
                            </span>
                            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                              {disease.count} ({disease.percentage.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5">
                            <div
                              className={`${colors.accent} h-1.5 rounded-full transition-all`}
                              style={{ width: `${Math.min(disease.percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 italic">No data available</p>
                    )}
                  </div>
                  
                  {/* Highlight top disease with spike indicator */}
                  {seasonData.topDiseases.length > 0 && seasonData.topDiseases[0].count > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-600">Top:</span>
                        <span className="text-sm font-bold text-slate-800">
                          {seasonData.topDiseases[0].disease}
                        </span>
                        <span className="text-xs text-slate-500">
                          ({seasonData.topDiseases[0].count} cases)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          
          {/* Summary insights */}
          {analytics.seasonalDiseaseTrends.length > 1 && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Key Insights</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analytics.seasonalDiseaseTrends
                  .filter(s => s.topDiseases.length > 0)
                  .map((seasonData) => {
                    const topDisease = seasonData.topDiseases[0]
                    const isWinterSpike = seasonData.season === 'Winter' && 
                      (topDisease.disease.toLowerCase().includes('cold') || 
                       topDisease.disease.toLowerCase().includes('cough') ||
                       topDisease.disease.toLowerCase().includes('fever'))
                    
                    return (
                      <div key={seasonData.season} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                        <p className="text-xs text-slate-700">
                          <span className="font-semibold">{seasonData.season}:</span>{' '}
                          {isWinterSpike && '❄️ '}
                          <span className="font-medium">{topDisease.disease}</span> spike 
                          ({topDisease.count} cases, {topDisease.percentage.toFixed(1)}% of {seasonData.season.toLowerCase()} visits)
                        </p>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Age-wise Disease Breakdown */}
      {analytics.ageWiseDiseaseBreakdown.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Age-wise Disease Breakdown</h3>
              <p className="text-sm text-slate-600 mt-1">Most common diseases by age group</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-violet-100 to-violet-200 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {analytics.ageWiseDiseaseBreakdown.map((ageData) => {
              // Get age group color scheme
              const ageGroupColors: Record<string, { bg: string; border: string; text: string; accent: string }> = {
                '0-17 (Pediatric)': {
                  bg: 'from-pink-50 to-rose-50',
                  border: 'border-pink-200',
                  text: 'text-pink-700',
                  accent: 'bg-pink-500'
                },
                '18-29 (Young Adult)': {
                  bg: 'from-blue-50 to-indigo-50',
                  border: 'border-blue-200',
                  text: 'text-blue-700',
                  accent: 'bg-blue-500'
                },
                '30-44 (Adult)': {
                  bg: 'from-green-50 to-emerald-50',
                  border: 'border-green-200',
                  text: 'text-green-700',
                  accent: 'bg-green-500'
                },
                '45-59 (Middle Age)': {
                  bg: 'from-amber-50 to-orange-50',
                  border: 'border-amber-200',
                  text: 'text-amber-700',
                  accent: 'bg-amber-500'
                },
                '60+ (Senior)': {
                  bg: 'from-purple-50 to-violet-50',
                  border: 'border-purple-200',
                  text: 'text-purple-700',
                  accent: 'bg-purple-500'
                },
                'Unknown': {
                  bg: 'from-slate-50 to-gray-50',
                  border: 'border-slate-200',
                  text: 'text-slate-700',
                  accent: 'bg-slate-500'
                }
              }
              
              const colors = ageGroupColors[ageData.ageGroup] || ageGroupColors['Unknown']
              const ageEmoji: Record<string, string> = {
                '0-17 (Pediatric)': '👶',
                '18-29 (Young Adult)': '🧑',
                '30-44 (Adult)': '👨',
                '45-59 (Middle Age)': '👴',
                '60+ (Senior)': '👵',
                'Unknown': '❓'
              }
              
              return (
                <div
                  key={ageData.ageGroup}
                  className={`bg-gradient-to-br ${colors.bg} rounded-xl p-5 border ${colors.border} shadow-sm`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{ageEmoji[ageData.ageGroup] || '📊'}</span>
                      <h4 className={`text-sm font-bold ${colors.text} truncate`}>{ageData.ageGroup}</h4>
                    </div>
                    <span className="text-xs font-semibold text-slate-600">
                      {ageData.totalAppointments} {ageData.totalAppointments === 1 ? 'visit' : 'visits'}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {ageData.topDiseases.length > 0 ? (
                      ageData.topDiseases.map((disease, diseaseIdx) => (
                        <div key={diseaseIdx} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-700 truncate flex-1 mr-2">
                              {disease.disease}
                            </span>
                            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                              {disease.count} ({disease.percentage.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5">
                            <div
                              className={`${colors.accent} h-1.5 rounded-full transition-all`}
                              style={{ width: `${Math.min(disease.percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 italic">No data available</p>
                    )}
                  </div>
                  
                  {/* Highlight top disease */}
                  {ageData.topDiseases.length > 0 && ageData.topDiseases[0].count > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-600">Top:</span>
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {ageData.topDiseases[0].disease}
                        </span>
                        <span className="text-xs text-slate-500">
                          ({ageData.topDiseases[0].count})
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Diagnoses Section - Consolidated */}
      {(analytics.mostCommonDiagnoses.length > 0 || analytics.diagnosisTrends.length > 0 || analytics.symptomDiagnosisCorrelation.length > 0) && (
        <div className="bg-white rounded-lg p-6 border-2 border-blue-200 shadow-lg">
          {/* Main Section Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-blue-100">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center shadow-sm">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Diagnoses</h2>
                <p className="text-sm text-slate-600 mt-0.5">Comprehensive diagnosis analytics based on doctor-confirmed final diagnoses</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Most Common Diagnoses */}
            {analytics.mostCommonDiagnoses.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-semibold text-slate-800">Most Common Diagnoses</h3>
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Top {analytics.mostCommonDiagnoses.length}</span>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <div className="space-y-3">
                    {analytics.mostCommonDiagnoses.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-slate-900 truncate">{item.diagnosis}</span>
                            <span className="text-sm text-slate-600 ml-2 whitespace-nowrap">{item.count} cases ({item.percentage.toFixed(1)}%)</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${Math.min(item.percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Diagnosis Trends */}
            {analytics.diagnosisTrends.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-semibold text-slate-800">Monthly Trends</h3>
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Last 12 months</span>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                  <div className="overflow-x-auto">
                    <div className="min-w-full space-y-3">
                      {analytics.diagnosisTrends.map((month, idx) => (
                        <div key={idx} className="border-b border-green-200 pb-3 last:border-b-0 last:pb-0">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-slate-800">{month.month}</span>
                            <span className="text-sm text-slate-600">{month.totalCases} cases</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(month.diagnoses)
                              .sort(([, a], [, b]) => (b as number) - (a as number))
                              .slice(0, 5)
                              .map(([diag, count]) => (
                                <span
                                  key={diag}
                                  className="inline-flex items-center px-2 py-1 bg-green-100 border border-green-200 rounded text-xs text-green-700 font-medium"
                                >
                                  {diag} ({count})
                                </span>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Symptom → Diagnosis Correlation */}
            {analytics.symptomDiagnosisCorrelation.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-semibold text-slate-800">Symptom → Diagnosis Correlation</h3>
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Top {analytics.symptomDiagnosisCorrelation.length} symptoms</span>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                  <div className="space-y-4">
                    {analytics.symptomDiagnosisCorrelation.map((item, idx) => (
                      <div key={idx} className="border-b border-purple-200 pb-4 last:border-b-0 last:pb-0">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-slate-800">{item.symptom}</h4>
                          <span className="text-sm text-slate-600">{item.totalCases} cases</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.topDiagnoses.map((diag, diagIdx) => (
                            <div
                              key={diagIdx}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-100 border border-purple-200 rounded-lg"
                            >
                              <span className="text-sm font-medium text-purple-900">{diag.diagnosis}</span>
                              <span className="text-xs text-purple-700">
                                {diag.count} ({diag.percentage.toFixed(1)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gender-wise Disease Breakdown */}
      {analytics.genderWiseDiseaseBreakdown.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Gender-wise Disease Breakdown</h3>
              <p className="text-sm text-slate-600 mt-1">Most common diseases by gender</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {analytics.genderWiseDiseaseBreakdown.map((genderData) => {
              // Get gender color scheme
              const genderColors: Record<string, { bg: string; border: string; text: string; accent: string }> = {
                'Male': {
                  bg: 'from-blue-50 to-cyan-50',
                  border: 'border-blue-200',
                  text: 'text-blue-700',
                  accent: 'bg-blue-500'
                },
                'Female': {
                  bg: 'from-pink-50 to-rose-50',
                  border: 'border-pink-200',
                  text: 'text-pink-700',
                  accent: 'bg-pink-500'
                },
                'Other': {
                  bg: 'from-purple-50 to-violet-50',
                  border: 'border-purple-200',
                  text: 'text-purple-700',
                  accent: 'bg-purple-500'
                },
                'Unknown': {
                  bg: 'from-slate-50 to-gray-50',
                  border: 'border-slate-200',
                  text: 'text-slate-700',
                  accent: 'bg-slate-500'
                }
              }
              
              const colors = genderColors[genderData.gender] || genderColors['Unknown']
              const genderEmoji: Record<string, string> = {
                'Male': '♂️',
                'Female': '♀️',
                'Other': '⚧️',
                'Unknown': '❓'
              }
              
              return (
                <div
                  key={genderData.gender}
                  className={`bg-gradient-to-br ${colors.bg} rounded-xl p-5 border ${colors.border} shadow-sm`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{genderEmoji[genderData.gender] || '👤'}</span>
                      <h4 className={`text-base font-bold ${colors.text}`}>{genderData.gender}</h4>
                    </div>
                    <span className="text-xs font-semibold text-slate-600">
                      {genderData.totalAppointments} {genderData.totalAppointments === 1 ? 'visit' : 'visits'}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {genderData.topDiseases.length > 0 ? (
                      genderData.topDiseases.map((disease, diseaseIdx) => (
                        <div key={diseaseIdx} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-700 truncate flex-1 mr-2">
                              {disease.disease}
                            </span>
                            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                              {disease.count} ({disease.percentage.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5">
                            <div
                              className={`${colors.accent} h-1.5 rounded-full transition-all`}
                              style={{ width: `${Math.min(disease.percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 italic">No data available</p>
                    )}
                  </div>
                  
                  {/* Highlight top disease */}
                  {genderData.topDiseases.length > 0 && genderData.topDiseases[0].count > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-600">Top:</span>
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {genderData.topDiseases[0].disease}
                        </span>
                        <span className="text-xs text-slate-500">
                          ({genderData.topDiseases[0].count})
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Area-wise Patient Distribution */}
      {analytics.areaWiseDistribution.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Area-wise Patient Distribution</h3>
              <p className="text-sm text-slate-600 mt-1">Patient distribution across different areas</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {analytics.areaWiseDistribution.map((areaData, idx) => {
              // Color scheme based on rank
              const getAreaColors = (index: number) => {
                if (index === 0) {
                  return {
                    bg: 'from-emerald-50 to-green-50',
                    border: 'border-emerald-200',
                    text: 'text-emerald-700',
                    accent: 'bg-emerald-500',
                    badge: 'bg-emerald-100 text-emerald-700'
                  }
                } else if (index === 1) {
                  return {
                    bg: 'from-blue-50 to-cyan-50',
                    border: 'border-blue-200',
                    text: 'text-blue-700',
                    accent: 'bg-blue-500',
                    badge: 'bg-blue-100 text-blue-700'
                  }
                } else if (index === 2) {
                  return {
                    bg: 'from-purple-50 to-violet-50',
                    border: 'border-purple-200',
                    text: 'text-purple-700',
                    accent: 'bg-purple-500',
                    badge: 'bg-purple-100 text-purple-700'
                  }
                } else {
                  return {
                    bg: 'from-slate-50 to-gray-50',
                    border: 'border-slate-200',
                    text: 'text-slate-700',
                    accent: 'bg-slate-500',
                    badge: 'bg-slate-100 text-slate-700'
                  }
                }
              }
              
              const colors = getAreaColors(idx)
              
              return (
                <div
                  key={areaData.area}
                  className={`bg-gradient-to-br ${colors.bg} rounded-xl p-5 border ${colors.border} shadow-sm hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xl">📍</span>
                      <h4 className={`text-sm font-bold ${colors.text} truncate`}>
                        {areaData.area}
                      </h4>
                    </div>
                    {idx < 3 && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
                        #{idx + 1}
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <p className="text-xl font-bold text-slate-900">
                        {areaData.patientCount.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-600">
                        {areaData.patientCount === 1 ? 'patient' : 'patients'}
                      </p>
                    </div>
                    
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className={`${colors.accent} h-2 rounded-full transition-all`}
                        style={{ width: `${Math.min(areaData.percentage, 100)}%` }}
                      />
                    </div>
                    
                    <p className="text-xs font-semibold text-slate-600">
                      {areaData.percentage.toFixed(1)}% of total patients
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
          
          {/* Summary Statistics */}
          {analytics.areaWiseDistribution.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 mb-1">Total Areas</p>
                  <p className="text-xl font-bold text-slate-900">
                    {analytics.areaWiseDistribution.length}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 mb-1">Top Area</p>
                  <p className="text-base font-bold text-slate-900 truncate">
                    {analytics.areaWiseDistribution[0]?.area || 'N/A'}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    {analytics.areaWiseDistribution[0]?.patientCount || 0} patients
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 mb-1">Top 3 Areas</p>
                  <p className="text-xl font-bold text-slate-900">
                    {analytics.areaWiseDistribution.slice(0, 3).reduce((sum, area) => sum + area.patientCount, 0)}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    {((analytics.areaWiseDistribution.slice(0, 3).reduce((sum, area) => sum + area.patientCount, 0) / analytics.totalPatients) * 100).toFixed(1)}% of total
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts and Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Growth Chart */}
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Monthly Patient Growth</h3>
          <div className="space-y-2">
            {analytics.monthlyGrowth.slice(-6).map((month, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-20 text-xs text-slate-600 font-medium">{month.month}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full transition-all"
                        style={{ width: `${(month.totalPatients / analytics.totalPatients) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 w-16 text-right">
                      {month.totalPatients}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    +{month.newPatients} new
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Visiting Patients */}
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Top Visiting Patients</h3>
          <div className="space-y-2">
            {analytics.topVisitingPatients.slice(0, 5).map((patient, idx) => (
              <div key={patient.patientId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{patient.patientName}</p>
                    <p className="text-xs text-slate-500">
                      Last visit: {patient.lastVisit ? formatDate(patient.lastVisit) : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-slate-800">{patient.visitCount}</p>
                  <p className="text-xs text-slate-500">visits</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Demographic Distribution */}
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Gender Distribution</h3>
          <div className="space-y-2">
            {Object.entries(analytics.demographicDistribution.gender).map(([gender, count]) => {
              const percentage = (count / analytics.totalPatients) * 100
              return (
                <div key={gender}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{gender}</span>
                    <span className="text-sm font-semibold text-slate-900">
                      {count} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Age Groups */}
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Age Distribution</h3>
          <div className="space-y-2">
            {Object.entries(analytics.demographicDistribution.ageGroups)
              .sort((a, b) => b[1] - a[1])
              .map(([ageGroup, count]) => {
                const percentage = (count / analytics.totalPatients) * 100
                return (
                  <div key={ageGroup}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">{ageGroup}</span>
                      <span className="text-sm font-semibold text-slate-900">
                        {count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}

