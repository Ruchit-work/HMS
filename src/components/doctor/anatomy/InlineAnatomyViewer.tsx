"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import ENTAnatomyViewer from '@/components/doctor/anatomy/ENTAnatomyViewer'
import InteractiveEarSVG from '@/components/doctor/anatomy/svg/InteractiveEarSVG'
import InteractiveNoseSVG from '@/components/doctor/anatomy/svg/InteractiveNoseSVG'
import InteractiveThroatSVG from '@/components/doctor/anatomy/svg/InteractiveThroatSVG'
import InteractiveLungsSVG from '@/components/doctor/anatomy/svg/InteractiveLungsSVG'
import InteractiveMouthSVG from '@/components/doctor/anatomy/svg/InteractiveMouthSVG'
// import InteractiveKidneySVG from '@/components/doctor/anatomy/svg/InteractiveKidneySVG' // Commented out: module not found
import { earPartsData, type Disease } from '@/constants/earDiseases'
import { nosePartsData } from '@/constants/noseDiseases'
import { throatPartsData } from '@/constants/throatDiseases'
import { dentalPartsData } from '@/constants/dentalDiseases'
import { lungsPartsData } from '@/constants/lungsDiseases'
import { kidneyPartsData } from '@/constants/kidneyDiseases'
import { completeAppointment } from '@/utils/appointmentHelpers'
import { useMultiHospital } from '@/contexts/MultiHospitalContext'
import { useAuth } from '@/hooks/useAuth'
import { auth } from '@/firebase/config'
import { ENT_DIAGNOSES, CUSTOM_DIAGNOSIS_OPTION } from '@/constants/entDiagnoses'
import { doc, getDoc } from 'firebase/firestore'
import { getHospitalCollection } from '@/utils/firebase/hospital-queries'
import VoiceInput from '@/components/ui/VoiceInput'
import { fetchMedicineSuggestions, MedicineSuggestion, sanitizeMedicineName, recordMedicineSuggestions } from '@/utils/medicineSuggestions'
import InteractiveKidneySVG from './svg/InteractiveKidneySVG'

const DynamicENTAnatomyViewer = dynamic(
  () => Promise.resolve(ENTAnatomyViewer),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-lg">
        <div className="text-slate-600">Loading 3D Anatomy Model...</div>
      </div>
    )
  }
)

export interface AnatomyViewerData {
  anatomyType: 'ear' | 'nose' | 'throat' | 'dental' | 'lungs' | 'kidney'
  selectedPart?: string
  selectedPartInfo?: any
  selectedDisease?: Disease | null
  medicines: Array<{ name: string; dosage: string; frequency: string; duration: string }>
  notes: string
  diagnoses: string[]
  customDiagnosis?: string
}

interface InlineAnatomyViewerProps {
  appointmentId: string
  patientName: string
  anatomyType?: 'ear' | 'nose' | 'throat' | 'dental' | 'lungs' | 'kidney'
  initialData?: AnatomyViewerData | null
  onComplete?: () => void
  onDataChange?: (data: AnatomyViewerData | null) => void
}

export default function InlineAnatomyViewer({ appointmentId, patientName, anatomyType = 'ear', initialData, onComplete, onDataChange }: InlineAnatomyViewerProps) {
  const { activeHospitalId } = useMultiHospital()
  const { user } = useAuth("doctor")
  const [completing, setCompleting] = useState(false)
  const [notification, setNotification] = useState<{type: "success" | "error", message: string} | null>(null)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [finalDiagnosis, setFinalDiagnosis] = useState<string[]>([])
  const [customDiagnosis, setCustomDiagnosis] = useState('')
  const [medicineSuggestions, setMedicineSuggestions] = useState<MedicineSuggestion[]>([])
  const [activeNameSuggestion, setActiveNameSuggestion] = useState<{ section: '3d' | '2d', index: number } | null>(null)
  const [inlineSuggestion, setInlineSuggestion] = useState<{ section: '3d' | '2d', index: number, suggestion: string } | null>(null)
  const [activeView, setActiveView] = useState<'3d' | '2d'>('3d')
  
  // State for 3D model section
  const [selectedPart, setSelectedPart] = useState<string | null>(null)
  const [selectedPartInfo, setSelectedPartInfo] = useState<{ name: string; description: string } | null>(null)
  const [selectedDisease, setSelectedDisease] = useState<Disease | null>(null)
  const [notes, setNotes] = useState('')
  const [selectedMedicines, setSelectedMedicines] = useState<Array<{
    name: string
    dosage: string
    frequency: string
    duration: string
  }>>([])

  // Separate state for 2D SVG section
  const [selectedPart2D, setSelectedPart2D] = useState<string | null>(null)
  const [selectedPartInfo2D, setSelectedPartInfo2D] = useState<{ name: string; description: string } | null>(null)
  const [selectedDisease2D, setSelectedDisease2D] = useState<Disease | null>(null)
  const [notes2D, setNotes2D] = useState('')
  const [selectedMedicines2D, setSelectedMedicines2D] = useState<Array<{
    name: string
    dosage: string
    frequency: string
    duration: string
  }>>([])

  // Hydrate state from initialData when provided (for tab switching)
  useEffect(() => {
    if (!initialData || initialData.anatomyType !== anatomyType) return
    const meds = initialData.medicines || []
    const medsFiltered = meds.filter((m) => m?.name?.trim())
    setSelectedPart(initialData.selectedPart ?? null)
    setSelectedPartInfo(initialData.selectedPartInfo ?? null)
    setSelectedDisease(initialData.selectedDisease ?? null)
    setNotes(initialData.notes ?? '')
    setSelectedMedicines(medsFiltered)
    setSelectedPart2D(initialData.selectedPart ?? null)
    setSelectedPartInfo2D(initialData.selectedPartInfo ?? null)
    setSelectedDisease2D(initialData.selectedDisease ?? null)
    setNotes2D(initialData.notes ?? '')
    setSelectedMedicines2D(medsFiltered)
    setFinalDiagnosis(initialData.diagnoses ?? [])
    setCustomDiagnosis(initialData.customDiagnosis ?? '')
  }, [initialData, anatomyType])

  // Get parts data based on anatomy type
  const getPartsData = () => {
    switch (anatomyType) {
      case 'throat':
        return throatPartsData
      case 'dental':
        return dentalPartsData
      case 'nose':
        return nosePartsData
      case 'lungs':
        return lungsPartsData
      case 'kidney':
        return kidneyPartsData
      case 'ear':
      default:
        return earPartsData
    }
  }

  // Get 3D model path based on anatomy type
  const getModelPath = () => {
    switch (anatomyType) {
      case 'throat':
        return '/models/thorat/anatomy_of_the_larynx.glb'
      case 'dental':
        return '/models/mouth/mandible.glb'
      case 'nose':
        return '/models/nose/anatomi_hidung_nose_anatomy.glb'
      case 'lungs':
        return '/models/lungs/healthy_heart_and_lungs.glb'
      case 'kidney':
        return '/models/kidney/kidney.glb'
      case 'ear':
      default:
        return '/models/ear/ear-anatomy.glb'
    }
  }

  // Real anatomical name mappings
  const anatomicalNameMappings: Record<string, Record<string, string>> = {
    throat: {
      'Pharynx': 'Pharynx', 'Nasopharynx': 'Pharynx', 'Oropharynx': 'Pharynx', 'Laryngopharynx': 'Pharynx',
      'Larynx': 'Larynx', 'Voice_Box': 'Larynx', 'Thyroid_Cartilage': 'Larynx',
      'Cricoid_Cartilage': 'Larynx', 'Arytenoid_Cartilage': 'Larynx',
      'Epiglottis': 'Epiglottis',
      'Vocal_Cord': 'Vocal_Cords', 'Vocal_Cords': 'Vocal_Cords', 'Vocal_Fold': 'Vocal_Cords',
      'Vocal_Folds': 'Vocal_Cords', 'True_Vocal_Cord': 'Vocal_Cords', 'False_Vocal_Cord': 'Vocal_Cords',
      'Glottis': 'Vocal_Cords',
      'Trachea': 'Trachea', 'Windpipe': 'Trachea',
    },
    dental: {
      'Teeth': 'Teeth', 'Tooth': 'Teeth', 'Incisor': 'Teeth', 'Canine': 'Teeth', 'Premolar': 'Teeth', 'Molar': 'Teeth',
      'Gums': 'Gums', 'Gingiva': 'Gums', 'Gingival': 'Gums',
      'Tongue': 'Tongue',
      'Mandible': 'Mandible', 'Lower_Jaw': 'Mandible', 'Jaw': 'Mandible',
      'Palate': 'Palate', 'Hard_Palate': 'Palate', 'Soft_Palate': 'Palate',
      'Oral_Mucosa': 'Oral_Mucosa', 'Mucosa': 'Oral_Mucosa', 'Lips': 'Oral_Mucosa',
      'Salivary_Glands': 'Salivary_Glands', 'Salivary_Gland': 'Salivary_Glands',
      'Wisdom_Teeth': 'Wisdom_Teeth', 'Third_Molars': 'Wisdom_Teeth',
    },
    nose: {
      'Nostrils': 'Nostrils', 'Nasal_Vestibule': 'Nostrils',
      'Nasal_Cavity': 'Nasal_Cavity',
      'Nasal_Septum': 'Nasal_Septum', 'Septum': 'Nasal_Septum',
      'Turbinates': 'Turbinates', 'Nasal_Conchae': 'Turbinates',
      'Sinuses': 'Sinuses', 'Paranasal_Sinuses': 'Sinuses',
    },
    lungs: {
      'Trachea': 'Trachea', 'Windpipe': 'Trachea',
      'Bronchi': 'Bronchi', 'Bronchus': 'Bronchi',
      'Lungs': 'Lungs', 'Lung': 'Lungs',
      'Heart': 'Heart',
    },
    kidney: {
      'Kidney': 'Kidney', 'Left_Kidney': 'Kidney', 'Right_Kidney': 'Kidney',
      'Renal_Pelvis': 'Renal_Pelvis', 'Ureter': 'Ureter',
      'Cortex': 'Cortex', 'Medulla': 'Medulla',
    },
    ear: {}
  }

  // Map generic object names to real part names
  const mapToRealPartName = (partName: string | null): string | null => {
    if (!partName) return null
    
    const partsData = getPartsData()
    
    // Check if it's already a valid part name
    if (partsData[partName]) return partName
    
    // Check case-insensitive match
    const lowerName = partName.toLowerCase()
    for (const key in partsData) {
      if (key.toLowerCase() === lowerName) return key
    }
    
    // Check real anatomical name mappings (exact match)
    if (anatomicalNameMappings[anatomyType] && anatomicalNameMappings[anatomyType][partName]) {
      return anatomicalNameMappings[anatomyType][partName]
    }
    
    // Check case-insensitive match for anatomical names
    if (anatomicalNameMappings[anatomyType]) {
      for (const [anatomicalName, mappedPart] of Object.entries(anatomicalNameMappings[anatomyType])) {
        if (anatomicalName.toLowerCase() === lowerName) {
          return mappedPart
        }
      }
    }
    
    // For generic object names, try to map based on anatomy type
    const objectMatch = partName.match(/^[Oo]bject[_ ]?(\d+)$/i)
    if (objectMatch) {
      const objectNumber = parseInt(objectMatch[1], 10)
      const partMappings: Record<string, Record<number, string>> = {
        ear: {
          1: 'Outer_Ear', 2: 'Ear_Canal', 3: 'Eardrum', 4: 'Ossicles',
          5: 'Cochlea', 6: 'Semicircular_Canals', 7: 'Auditory_Nerve',
        },
        nose: {
          1: 'Nostrils', 2: 'Nasal_Cavity', 3: 'Nasal_Septum', 4: 'Turbinates', 5: 'Sinuses',
        },
        lungs: {
          1: 'Trachea', 2: 'Bronchi', 3: 'Lungs', 4: 'Heart',
        },
        kidney: {
          1: 'Kidney', 2: 'Renal_Pelvis', 3: 'Ureter', 4: 'Cortex', 5: 'Medulla',
        },
        throat: {
          1: 'Pharynx', 2: 'Larynx', 3: 'Epiglottis', 4: 'Trachea', 5: 'Vocal_Cords',
        },
        dental: {
          1: 'Teeth', 2: 'Gums', 3: 'Tongue', 4: 'Mandible', 5: 'Palate',
          6: 'Oral_Mucosa', 7: 'Salivary_Glands', 8: 'Wisdom_Teeth',
        }
      }
      if (partMappings[anatomyType] && partMappings[anatomyType][objectNumber]) {
        return partMappings[anatomyType][objectNumber]
      }
    }
    
    // Pattern matching for partial matches
    if (anatomyType === 'throat') {
      if (lowerName.includes('pharynx')) {
        return 'Pharynx'
      } else if (lowerName.includes('larynx') || lowerName.includes('voice box') || lowerName.includes('thyroid') ||
                 lowerName.includes('cricoid') || lowerName.includes('arytenoid')) {
        return 'Larynx'
      } else if (lowerName.includes('epiglottis')) {
        return 'Epiglottis'
      } else if (lowerName.includes('trachea') || lowerName.includes('windpipe')) {
        return 'Trachea'
      } else if (lowerName.includes('vocal') || lowerName.includes('cord') || lowerName.includes('fold')) {
        return 'Vocal_Cords'
      }
    } else if (anatomyType === 'dental') {
      if (lowerName.includes('tooth') || lowerName.includes('teeth') || lowerName.includes('incisor') || 
          lowerName.includes('canine') || lowerName.includes('premolar') || lowerName.includes('molar')) {
        return 'Teeth'
      } else if (lowerName.includes('gum') || lowerName.includes('gingiva')) {
        return 'Gums'
      } else if (lowerName.includes('tongue')) {
        return 'Tongue'
      } else if (lowerName.includes('mandible') || lowerName.includes('jaw')) {
        return 'Mandible'
      } else if (lowerName.includes('palate') || lowerName.includes('uvula')) {
        return 'Palate'
      } else if (lowerName.includes('mucosa') || lowerName.includes('lip')) {
        return 'Oral_Mucosa'
      } else if (lowerName.includes('salivary')) {
        return 'Salivary_Glands'
      } else if (lowerName.includes('wisdom') || lowerName.includes('third molar')) {
        return 'Wisdom_Teeth'
      }
    } else if (anatomyType === 'nose') {
      if (lowerName.includes('nostril') || lowerName.includes('vestibule')) {
        return 'Nostrils'
      } else if (lowerName.includes('nasal cavity') || lowerName.includes('nasal_cavity')) {
        return 'Nasal_Cavity'
      } else if (lowerName.includes('septum')) {
        return 'Nasal_Septum'
      } else if (lowerName.includes('turbinate') || lowerName.includes('conchae')) {
        return 'Turbinates'
      } else if (lowerName.includes('sinus')) {
        return 'Sinuses'
      }
    } else if (anatomyType === 'lungs') {
      if (lowerName.includes('trachea') || lowerName.includes('windpipe')) {
        return 'Trachea'
      } else if (lowerName.includes('bronch')) {
        return 'Bronchi'
      } else if (lowerName.includes('lung')) {
        return 'Lungs'
      } else if (lowerName.includes('heart')) {
        return 'Heart'
      }
    } else if (anatomyType === 'kidney') {
      if (lowerName.includes('kidney') || lowerName.includes('renal') && !lowerName.includes('pelvis') && !lowerName.includes('cortex') && !lowerName.includes('medulla')) {
        return 'Kidney'
      } else if (lowerName.includes('pelvis')) {
        return 'Renal_Pelvis'
      } else if (lowerName.includes('ureter')) {
        return 'Ureter'
      } else if (lowerName.includes('cortex')) {
        return 'Cortex'
      } else if (lowerName.includes('medulla')) {
        return 'Medulla'
      }
    }
    
    // Return as-is if no mapping found
    return partName
  }

  const handlePartSelect = (partName: string | null, partInfo?: { name: string; description: string }) => {
    const realPartName = mapToRealPartName(partName)
    setSelectedPart(realPartName)
    
    const partsData = getPartsData()
    
    if (realPartName && partsData[realPartName]) {
      setSelectedPartInfo({
        name: partsData[realPartName].partName,
        description: partsData[realPartName].description
      })
    } else {
      setSelectedPartInfo(partInfo || null)
    }
    
    setSelectedDisease(null)
    setSelectedMedicines([])
  }

  const handleDiseaseSelect = (disease: Disease) => {
    setSelectedDisease(disease)
    setSelectedMedicines(disease.medicines ? [...disease.medicines] : [])
  }

  const addMedicine = () => {
    setSelectedMedicines([...selectedMedicines, { name: "", dosage: "", frequency: "", duration: "" }])
  }

  const removeMedicine = (index: number) => {
    setSelectedMedicines(selectedMedicines.filter((_, i) => i !== index))
  }

  const updateMedicine = (index: number, field: string, value: string) => {
    const updatedMedicines = [...selectedMedicines]
    updatedMedicines[index] = { ...updatedMedicines[index], [field]: value }
    setSelectedMedicines(updatedMedicines)
    
    if (field === 'name') {
      updateInlineSuggestion('3d', index, value)
    }
  }

  // Load medicine suggestions
  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const suggestions = await fetchMedicineSuggestions(100)
        setMedicineSuggestions(suggestions)
      } catch {

      }
    }
    loadSuggestions()
  }, [])

  const getMedicineNameSuggestions = useCallback(
    (query: string, limitOptions = 5) => {
      if (!medicineSuggestions.length) return []
      const cleaned = query.trim().toLowerCase()
      if (cleaned.length < 1) return []

      const startsWithMatches = medicineSuggestions.filter((suggestion) =>
        suggestion.name.toLowerCase().startsWith(cleaned)
      )
      if (startsWithMatches.length >= limitOptions) {
        return startsWithMatches.slice(0, limitOptions)
      }

      const remainingSlots = limitOptions - startsWithMatches.length
      const containsMatches = medicineSuggestions
        .filter(
          (suggestion) =>
            !suggestion.name.toLowerCase().startsWith(cleaned) &&
            suggestion.name.toLowerCase().includes(cleaned)
        )
        .slice(0, remainingSlots)

      return [...startsWithMatches, ...containsMatches]
    },
    [medicineSuggestions]
  )

  const findSuggestionByName = useCallback(
    (name?: string) => {
      if (!name) return undefined
      const cleaned = name.trim().toLowerCase()
      if (!cleaned) return undefined
      return medicineSuggestions.find(
        (suggestion) =>
          suggestion.normalizedName === cleaned || suggestion.name.toLowerCase() === cleaned
      )
    },
    [medicineSuggestions]
  )

  const updateInlineSuggestion = useCallback(
    (section: '3d' | '2d', index: number, value: string) => {
      const cleanedValue = value.trim()
      if (cleanedValue.length < 1) {
        setInlineSuggestion((prev) =>
          prev?.section === section && prev.index === index ? null : prev
        )
        return
      }

      const bestMatch = getMedicineNameSuggestions(cleanedValue, 1)[0]
      if (bestMatch && bestMatch.name.toLowerCase().startsWith(cleanedValue.toLowerCase())) {
        setInlineSuggestion({
          section,
          index,
          suggestion: bestMatch.name
        })
      } else {
        setInlineSuggestion((prev) =>
          prev?.section === section && prev.index === index ? null : prev
        )
      }
    },
    [getMedicineNameSuggestions]
  )

  const acceptInlineSuggestion = (section: '3d' | '2d', index: number) => {
    if (inlineSuggestion?.section === section && inlineSuggestion.index === index) {
      const suggestion = findSuggestionByName(inlineSuggestion.suggestion)
      if (suggestion) {
        handleSelectMedicineSuggestion(section, index, suggestion)
      }
    }
  }

  const handleSelectMedicineSuggestion = (section: '3d' | '2d', index: number, suggestion: MedicineSuggestion) => {
    const sanitizedName = sanitizeMedicineName(suggestion.name)
    
    if (section === '3d') {
      const updatedMedicines = [...selectedMedicines]
      updatedMedicines[index] = {
        ...updatedMedicines[index],
        name: sanitizedName || suggestion.name
      }
      
      if (!updatedMedicines[index].dosage && suggestion.dosageOptions?.length) {
        updatedMedicines[index].dosage = suggestion.dosageOptions[0].value
      }
      if (!updatedMedicines[index].frequency && suggestion.frequencyOptions?.length) {
        updatedMedicines[index].frequency = suggestion.frequencyOptions[0].value
      }
      if (!updatedMedicines[index].duration && suggestion.durationOptions?.length) {
        updatedMedicines[index].duration = suggestion.durationOptions[0].value
      }
      
      setSelectedMedicines(updatedMedicines)
    } else {
      const updatedMedicines = [...selectedMedicines2D]
      updatedMedicines[index] = {
        ...updatedMedicines[index],
        name: sanitizedName || suggestion.name
      }
      
      if (!updatedMedicines[index].dosage && suggestion.dosageOptions?.length) {
        updatedMedicines[index].dosage = suggestion.dosageOptions[0].value
      }
      if (!updatedMedicines[index].frequency && suggestion.frequencyOptions?.length) {
        updatedMedicines[index].frequency = suggestion.frequencyOptions[0].value
      }
      if (!updatedMedicines[index].duration && suggestion.durationOptions?.length) {
        updatedMedicines[index].duration = suggestion.durationOptions[0].value
      }
      
      setSelectedMedicines2D(updatedMedicines)
    }
    
    setActiveNameSuggestion(null)
    setInlineSuggestion(null)
  }

  // Separate handlers for 2D SVG section
  const handlePartSelect2D = (partName: string | null, partInfo?: { name: string; description: string }) => {
    const realPartName = mapToRealPartName(partName)
    setSelectedPart2D(realPartName)
    const partsData = getPartsData()
    
    if (realPartName && partsData[realPartName]) {
      setSelectedPartInfo2D({
        name: partsData[realPartName].partName,
        description: partsData[realPartName].description
      })
    } else {
      setSelectedPartInfo2D(partInfo || null)
    }
    
    setSelectedDisease2D(null)
    setSelectedMedicines2D([])
  }

  const handleDiseaseSelect2D = (disease: Disease) => {
    setSelectedDisease2D(disease)
    setSelectedMedicines2D(disease.medicines ? [...disease.medicines] : [])
  }

  const addMedicine2D = () => {
    setSelectedMedicines2D([...selectedMedicines2D, { name: "", dosage: "", frequency: "", duration: "" }])
  }

  const removeMedicine2D = (index: number) => {
    setSelectedMedicines2D(selectedMedicines2D.filter((_, i) => i !== index))
  }

  const updateMedicine2D = (index: number, field: string, value: string) => {
    const updatedMedicines = [...selectedMedicines2D]
    updatedMedicines[index] = { ...updatedMedicines[index], [field]: value }
    setSelectedMedicines2D(updatedMedicines)
    
    if (field === 'name') {
      updateInlineSuggestion('2d', index, value)
    }
  }

  const getNumberEmoji = (num: number): string => {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
    return num <= 10 ? emojis[num - 1] : `${num}.`
  }

  const formatMedicinesAsText = (medicines: Array<{name: string, dosage: string, frequency: string, duration: string}>, notes?: string): string => {
    if (medicines.length === 0) return ""
    
    let prescriptionText = "🧾 *Prescription*\n\n"
    
    medicines.forEach((med, index) => {
      const emoji = getNumberEmoji(index + 1)
      const name = med.name || 'Medicine'
      const dosage = med.dosage ? ` ${med.dosage}` : ''
      
      prescriptionText += `*${emoji} ${name}${dosage}*\n\n`
      
      if (med.frequency) {
        prescriptionText += `• ${med.frequency}\n`
      }
      
      if (med.duration) {
        const durationText = med.duration.toLowerCase().includes('duration:') ? med.duration : `Duration: ${med.duration}`
        prescriptionText += `• ${durationText}\n`
      }
      
      prescriptionText += `\n`
    })
    
    if (notes && notes.trim()) {
      prescriptionText += `📌 *Advice:* ${notes.trim()}\n`
    }
    
    return prescriptionText.trim()
  }

  const mapDiseaseToDiagnosis = (disease: Disease | null): string[] => {
    if (!disease) return []
    
    const matchingDiagnosis = ENT_DIAGNOSES.find(d => 
      d.name.toLowerCase() === disease.name.toLowerCase() ||
      disease.name.toLowerCase().includes(d.name.toLowerCase()) ||
      d.name.toLowerCase().includes(disease.name.toLowerCase())
    )
    
    if (matchingDiagnosis) {
      return [matchingDiagnosis.name]
    }
    
    return [disease.name]
  }

  // Expose current data to parent component
  // Use useRef to track previous data and prevent unnecessary updates
  const prevDataRef = useRef<string>('')
  
  useEffect(() => {
    if (!onDataChange) return

    const finalMedicines = selectedMedicines2D.length > 0 ? selectedMedicines2D : selectedMedicines
    const finalDisease = selectedDisease2D || selectedDisease
    const finalPartInfo = selectedPartInfo2D || selectedPartInfo
    const finalNotes = notes2D || notes
    const finalPart = selectedPart2D || selectedPart

    const diagnoses = finalDiagnosis.length > 0 ? finalDiagnosis : (finalDisease ? mapDiseaseToDiagnosis(finalDisease) : [])
    const filteredDiagnoses = diagnoses.filter(d => d !== CUSTOM_DIAGNOSIS_OPTION)
    const finalCustomDiagnosis = diagnoses.includes(CUSTOM_DIAGNOSIS_OPTION) ? customDiagnosis : undefined

    // Create data object
    const dataToSend = finalMedicines.length > 0 && finalMedicines.some(med => med.name && med.name.trim())
      ? {
          anatomyType,
          selectedPart: finalPart || undefined,
          selectedPartInfo: finalPartInfo,
          selectedDisease: finalDisease,
          medicines: finalMedicines.filter(m => m.name && m.name.trim()),
          notes: finalNotes || '',
          diagnoses: filteredDiagnoses,
          customDiagnosis: finalCustomDiagnosis
        }
      : null

    // Serialize to compare with previous
    const dataString = JSON.stringify(dataToSend)
    
    // Only call onDataChange if data actually changed
    if (dataString !== prevDataRef.current) {
      prevDataRef.current = dataString
      onDataChange(dataToSend)
    }
  }, [
    anatomyType,
    selectedMedicines,
    selectedMedicines2D,
    selectedDisease,
    selectedDisease2D,
    selectedPart,
    selectedPart2D,
    selectedPartInfo,
    selectedPartInfo2D,
    notes,
    notes2D,
    finalDiagnosis,
    customDiagnosis,
    onDataChange
  ])

  const handleCompleteCheckup = () => {
    if (!appointmentId) {
      setNotification({ type: "error", message: "Appointment ID is missing" })
      return
    }

    if (!activeHospitalId) {
      setNotification({ type: "error", message: "Hospital context is not available. Please refresh the page." })
      return
    }

    const finalMedicines = selectedMedicines2D.length > 0 ? selectedMedicines2D : selectedMedicines
    const finalDisease = selectedDisease2D || selectedDisease

    if (finalMedicines.length === 0 || !finalMedicines.some(med => med.name && med.name.trim())) {
      setNotification({ type: "error", message: "Please add at least one medicine with a name before completing the checkup" })
      return
    }

    const diagnoses = finalDiagnosis.length > 0 ? finalDiagnosis : (finalDisease ? mapDiseaseToDiagnosis(finalDisease) : [])
    const filteredDiagnoses = diagnoses.filter(d => d !== CUSTOM_DIAGNOSIS_OPTION)
    const finalCustomDiagnosis = diagnoses.includes(CUSTOM_DIAGNOSIS_OPTION) ? customDiagnosis : undefined

    if (filteredDiagnoses.length === 0 && !finalCustomDiagnosis) {
      setNotification({ type: "error", message: "Please select at least one diagnosis before completing the consultation." })
      return
    }

    // If onDataChange is provided, let parent handle the completion modal
    // Otherwise, show local modal (for backward compatibility)
    if (onDataChange) {
      // Trigger parent to show combined modal by calling onComplete
      if (onComplete) {
        onComplete()
      }
    } else {
      // Show confirmation modal locally
      setShowCompletionModal(true)
    }
  }

  const confirmCompleteCheckup = async () => {
    setShowCompletionModal(false)
    setCompleting(true)
    setNotification(null)

    try {
      const finalMedicines = selectedMedicines2D.length > 0 ? selectedMedicines2D : selectedMedicines
      const finalDisease = selectedDisease2D || selectedDisease
      const finalPartInfo = selectedPartInfo2D || selectedPartInfo
      const finalNotes = notes2D || notes

      const medicineText = formatMedicinesAsText(finalMedicines)

      const notesParts: string[] = []
      
      if (finalPartInfo) {
        notesParts.push(`Selected Anatomy Part: ${finalPartInfo.name}`)
        if (finalPartInfo.description) {
          notesParts.push(`Part Description: ${finalPartInfo.description}`)
        }
      }
      
      if (finalDisease) {
        notesParts.push(`Diagnosis: ${finalDisease.name}`)
        if (finalDisease.description) {
          notesParts.push(`Disease Description: ${finalDisease.description}`)
        }
        if (finalDisease.symptoms && finalDisease.symptoms.length > 0) {
          notesParts.push(`Symptoms: ${finalDisease.symptoms.join(', ')}`)
        }
      }
      
      if (finalDisease?.prescriptions && finalDisease.prescriptions.length > 0) {
        notesParts.push(`Prescriptions/Instructions: ${finalDisease.prescriptions.join('; ')}`)
      }
      
      if (finalNotes && finalNotes.trim()) {
        notesParts.push(`Doctor Notes: ${finalNotes}`)
      }
      
      const comprehensiveNotes = notesParts.join('\n\n')

      const diagnoses = finalDiagnosis.length > 0 ? finalDiagnosis : (finalDisease ? mapDiseaseToDiagnosis(finalDisease) : [])
      
      const filteredDiagnoses = diagnoses.filter(d => d !== CUSTOM_DIAGNOSIS_OPTION)
      const finalCustomDiagnosis = diagnoses.includes(CUSTOM_DIAGNOSIS_OPTION) ? customDiagnosis : undefined

      await completeAppointment(
        appointmentId!,
        medicineText || "", // Ensure never undefined
        comprehensiveNotes || "", // Ensure never undefined
        activeHospitalId!,
        filteredDiagnoses,
        finalCustomDiagnosis || "",
        user?.uid || undefined,
        "doctor"
      )

      // Save medicines to database for future autocomplete (auto-save after first use)
      try {
        await recordMedicineSuggestions(finalMedicines)
      } catch {

        // Don't block completion if medicine saving fails
      }

      // Send completion WhatsApp message
      try {
        const currentUser = auth.currentUser
        if (currentUser) {
          const appointmentsRef = getHospitalCollection(activeHospitalId!, "appointments")
          const appointmentDoc = await getDoc(doc(appointmentsRef, appointmentId!))
          
          if (appointmentDoc.exists()) {
            const appointmentData = appointmentDoc.data()
            const token = await currentUser.getIdToken()
            
            const completionResponse = await fetch("/api/doctor/send-completion-whatsapp", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
              },
              body: JSON.stringify({
                appointmentId: appointmentId!,
                patientId: appointmentData.patientId,
                patientPhone: appointmentData.patientPhone,
                patientName: appointmentData.patientName,
                hospitalId: activeHospitalId!,
              }),
            })

            await completionResponse.json().catch(() => ({}))
            
            if (completionResponse.ok) {

            } else {

            }
          }
        }
      } catch {

      }

      setNotification({
        type: "success",
        message: "Checkup completed successfully! Recommended medicines and prescriptions have been added to the appointment."
      })

      if (onComplete) {
        setTimeout(() => {
          onComplete()
        }, 2000)
      }

    } catch (error) {

      setNotification({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to complete checkup. Please try again."
      })
      setCompleting(false)
    }
  }

  const handleCompleteCheckup2D = () => {
    if (!appointmentId) {
      setNotification({ type: "error", message: "Appointment ID is missing" })
      return
    }

    if (!activeHospitalId) {
      setNotification({ type: "error", message: "Hospital context is not available. Please refresh the page." })
      return
    }

    if (selectedMedicines2D.length === 0 || !selectedMedicines2D.some(med => med.name && med.name.trim())) {
      setNotification({ type: "error", message: "Please add at least one medicine with a name before completing the checkup" })
      return
    }

    const diagnoses = finalDiagnosis.length > 0 ? finalDiagnosis : (selectedDisease2D ? mapDiseaseToDiagnosis(selectedDisease2D) : [])
    const filteredDiagnoses = diagnoses.filter(d => d !== CUSTOM_DIAGNOSIS_OPTION)
    const finalCustomDiagnosis = diagnoses.includes(CUSTOM_DIAGNOSIS_OPTION) ? customDiagnosis : undefined

    if (filteredDiagnoses.length === 0 && !finalCustomDiagnosis) {
      setNotification({ type: "error", message: "Please select at least one diagnosis before completing the consultation." })
      return
    }

    // Show confirmation modal
    setShowCompletionModal(true)
  }

  const confirmCompleteCheckup2D = async () => {
    setShowCompletionModal(false)
    setCompleting(true)
    setNotification(null)

    try {
      const medicineText = formatMedicinesAsText(selectedMedicines2D)

      const notesParts: string[] = []
      
      if (selectedPartInfo2D) {
        notesParts.push(`Selected Anatomy Part: ${selectedPartInfo2D.name}`)
        if (selectedPartInfo2D.description) {
          notesParts.push(`Part Description: ${selectedPartInfo2D.description}`)
        }
      }
      
      if (selectedDisease2D) {
        notesParts.push(`Diagnosis: ${selectedDisease2D.name}`)
        if (selectedDisease2D.description) {
          notesParts.push(`Disease Description: ${selectedDisease2D.description}`)
        }
        if (selectedDisease2D.symptoms && selectedDisease2D.symptoms.length > 0) {
          notesParts.push(`Symptoms: ${selectedDisease2D.symptoms.join(', ')}`)
        }
      }
      
      if (selectedDisease2D?.prescriptions && selectedDisease2D.prescriptions.length > 0) {
        notesParts.push(`Prescriptions/Instructions: ${selectedDisease2D.prescriptions.join('; ')}`)
      }
      
      if (notes2D && notes2D.trim()) {
        notesParts.push(`Doctor Notes: ${notes2D}`)
      }
      
      const comprehensiveNotes = notesParts.join('\n\n')

      const diagnoses = finalDiagnosis.length > 0 ? finalDiagnosis : (selectedDisease2D ? mapDiseaseToDiagnosis(selectedDisease2D) : [])
      
      const filteredDiagnoses = diagnoses.filter(d => d !== CUSTOM_DIAGNOSIS_OPTION)
      const finalCustomDiagnosis = diagnoses.includes(CUSTOM_DIAGNOSIS_OPTION) ? customDiagnosis : undefined

      await completeAppointment(
        appointmentId!,
        medicineText || "", // Ensure never undefined
        comprehensiveNotes || "", // Ensure never undefined
        activeHospitalId!,
        filteredDiagnoses,
        finalCustomDiagnosis || "",
        user?.uid || undefined,
        "doctor"
      )

      // Save medicines to database for future autocomplete (auto-save after first use)
      try {
        await recordMedicineSuggestions(selectedMedicines2D)
      } catch {

        // Don't block completion if medicine saving fails
      }

      // Send completion WhatsApp message
      try {
        const currentUser = auth.currentUser
        if (currentUser) {
          const appointmentsRef = getHospitalCollection(activeHospitalId!, "appointments")
          const appointmentDoc = await getDoc(doc(appointmentsRef, appointmentId!))
          
          if (appointmentDoc.exists()) {
            const appointmentData = appointmentDoc.data()
            const token = await currentUser.getIdToken()
            
            const completionResponse = await fetch("/api/doctor/send-completion-whatsapp", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
              },
              body: JSON.stringify({
                appointmentId: appointmentId!,
                patientId: appointmentData.patientId,
                patientPhone: appointmentData.patientPhone,
                patientName: appointmentData.patientName,
                hospitalId: activeHospitalId!,
              }),
            })

            await completionResponse.json().catch(() => ({}))
            
            if (completionResponse.ok) {

            } else {

            }
          }
        }
      } catch {

      }

      setNotification({
        type: "success",
        message: "Checkup completed successfully! Recommended medicines and prescriptions have been added to the appointment."
      })

      if (onComplete) {
        setTimeout(() => {
          onComplete()
        }, 2000)
      }

    } catch (error) {

      setNotification({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to complete checkup. Please try again."
      })
      setCompleting(false)
    }
  }

  const partsData = getPartsData()
  const currentPartData = selectedPart ? partsData[selectedPart] : null

  return (
    <div className="w-full bg-white">
      {notification && (
        <div className={`mb-4 p-3 rounded-lg ${
          notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {notification.message}
        </div>
      )}
      <div className="p-4">
        {/* View Toggle */}
        <div className="flex gap-2 bg-slate-100 p-1 rounded-lg w-fit mb-4">
          <button
            onClick={() => setActiveView('3d')}
            className={`px-6 py-2 rounded-md font-medium transition-all flex items-center gap-2 ${
              activeView === '3d'
                ? 'bg-white text-blue-600 shadow-md'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            3D Model
          </button>
          <button
            onClick={() => setActiveView('2d')}
            className={`px-6 py-2 rounded-md font-medium transition-all flex items-center gap-2 ${
              activeView === '2d'
                ? 'bg-white text-blue-600 shadow-md'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            2D Diagram
          </button>
        </div>

        {/* Main Content - Model and Info Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Model Viewer */}
          <div className="lg:col-span-6">
            {activeView === '3d' ? (
              <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200" style={{ height: '600px', minHeight: '600px', position: 'relative' }}>
                <DynamicENTAnatomyViewer
                  onPartSelect={handlePartSelect}
                  selectedPart={selectedPart}
                  modelPath={getModelPath()}
                  className="w-full h-full"
                />
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200" style={{ height: '600px', minHeight: '600px' }}>
                {anatomyType === 'nose' ? (
                  <InteractiveNoseSVG
                    onPartSelect={handlePartSelect2D}
                    selectedPart={selectedPart2D}
                  />
                ) : anatomyType === 'lungs' ? (
                  <InteractiveLungsSVG
                    onPartSelect={handlePartSelect2D}
                    selectedPart={selectedPart2D}
                  />
                ) : anatomyType === 'kidney' ? (
                  <InteractiveKidneySVG
                    onPartSelect={handlePartSelect2D}
                    selectedPart={selectedPart2D}
                  />
                ) : anatomyType === 'throat' ? (
                  <InteractiveThroatSVG
                    onPartSelect={handlePartSelect2D}
                    selectedPart={selectedPart2D}
                  />
                ) : anatomyType === 'dental' ? (
                  <InteractiveMouthSVG
                    onPartSelect={handlePartSelect2D}
                    selectedPart={selectedPart2D}
                  />
                ) : (
                  <InteractiveEarSVG
                    onPartSelect={handlePartSelect2D}
                    selectedPart={selectedPart2D}
                  />
                )}
              </div>
            )}
          </div>

          {/* Right: Information Panel */}
          <div className="lg:col-span-6 space-y-4">
            {/* Selected Part Info Section */}
            {(activeView === '3d' ? selectedPartInfo : selectedPartInfo2D) ? (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-5 shadow-lg">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold text-blue-900">Selected Part Information</h3>
                  <button
                    onClick={() => {
                      if (activeView === '3d') {
                        setSelectedPart(null)
                        setSelectedPartInfo(null)
                        setSelectedDisease(null)
                        setSelectedMedicines([])
                      } else {
                        setSelectedPart2D(null)
                        setSelectedPartInfo2D(null)
                        setSelectedDisease2D(null)
                        setSelectedMedicines2D([])
                      }
                    }}
                    className="text-blue-600 hover:text-blue-800 text-lg font-bold hover:bg-blue-100 rounded-full p-1 transition-colors"
                    title="Clear Selection"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Part Name</label>
                    <p className="text-base text-blue-900 font-bold mt-1">{(activeView === '3d' ? selectedPartInfo : selectedPartInfo2D)?.name}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Description</label>
                    <p className="text-sm text-blue-800 leading-relaxed mt-1">{(activeView === '3d' ? selectedPartInfo : selectedPartInfo2D)?.description}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-6 text-center">
                <svg className="w-12 h-12 mx-auto mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <p className="text-sm font-medium text-slate-600">Click on a part of the {anatomyType === 'throat' ? 'throat' : anatomyType === 'dental' ? 'oral cavity' : anatomyType === 'nose' ? 'nose' : anatomyType === 'lungs' ? 'lungs/heart' : anatomyType === 'kidney' ? 'kidney' : 'ear'} model</p>
                <p className="text-xs text-slate-500 mt-1">to see its name and description here</p>
              </div>
            )}

            {/* Diseases List */}
            {(() => {
              const partInfo = activeView === '3d' ? selectedPartInfo : selectedPartInfo2D
              const partData = activeView === '3d' ? currentPartData : (selectedPart2D ? partsData[selectedPart2D] : null)
              return partInfo && partData && partData.diseases.length > 0
            })() && (
              <div className="bg-white border-2 border-blue-200 rounded-xl p-4 shadow-md">
                <h4 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Related Diseases/Conditions
                </h4>
                <div className="space-y-2">
                  {((activeView === '3d' ? currentPartData : (selectedPart2D ? partsData[selectedPart2D] : null))?.diseases || []).map((disease) => (
                    <button
                      key={disease.id}
                      onClick={() => activeView === '3d' ? handleDiseaseSelect(disease) : handleDiseaseSelect2D(disease)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        (activeView === '3d' ? selectedDisease?.id : selectedDisease2D?.id) === disease.id
                          ? 'bg-blue-100 border-blue-500 shadow-md'
                          : 'bg-white border-blue-200 hover:bg-blue-50 hover:border-blue-300'
                      }`}
                    >
                      <p className={`font-semibold mb-1 ${(activeView === '3d' ? selectedDisease?.id : selectedDisease2D?.id) === disease.id ? 'text-blue-900' : 'text-blue-800'}`}>
                        {disease.name}
                      </p>
                      <p className={`text-xs leading-relaxed line-clamp-2 ${(activeView === '3d' ? selectedDisease?.id : selectedDisease2D?.id) === disease.id ? 'text-blue-700' : 'text-blue-600'}`}>
                        {disease.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Disease Info */}
            {(activeView === '3d' ? selectedDisease : selectedDisease2D) && (
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-green-900">Selected Disease</h3>
                  <button
                    onClick={() => {
                      if (activeView === '3d') {
                        setSelectedDisease(null)
                        setSelectedMedicines([])
                      } else {
                        setSelectedDisease2D(null)
                        setSelectedMedicines2D([])
                      }
                    }}
                    className="text-green-600 hover:text-green-800 text-sm font-bold"
                    title="Clear Selection"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-sm text-green-800 font-semibold mb-2">{(activeView === '3d' ? selectedDisease : selectedDisease2D)?.name}</p>
                <p className="text-xs text-green-700 leading-relaxed mb-3">{(activeView === '3d' ? selectedDisease : selectedDisease2D)?.description}</p>
                
                {/* Symptoms */}
                {(activeView === '3d' ? selectedDisease : selectedDisease2D)?.symptoms && (activeView === '3d' ? selectedDisease : selectedDisease2D)!.symptoms.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-xs font-bold text-green-900 mb-1">Symptoms:</h4>
                    <div className="flex flex-wrap gap-1">
                      {(activeView === '3d' ? selectedDisease : selectedDisease2D)!.symptoms.map((symptom, idx) => (
                        <span key={idx} className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                          {symptom}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Prescriptions */}
            {(activeView === '3d' ? selectedDisease : selectedDisease2D) && (activeView === '3d' ? selectedDisease : selectedDisease2D)!.prescriptions.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h4 className="text-xs font-bold text-amber-900 mb-2">Prescriptions/Instructions:</h4>
                <ul className="text-xs text-amber-800 space-y-1">
                  {(activeView === '3d' ? selectedDisease : selectedDisease2D)!.prescriptions.map((prescription, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-600">•</span>
                      <span>{prescription}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Medicines - Editable */}
            {(
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-purple-900">Medicines:</h4>
                  <button
                    onClick={activeView === '3d' ? addMedicine : addMedicine2D}
                    className="btn-modern btn-modern-purple btn-modern-sm flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {(activeView === '3d' ? selectedMedicines : selectedMedicines2D).length === 0 ? (
                    <p className="text-xs text-purple-700 italic py-1">No medicines. Click "Add" to add one.</p>
                  ) : (
                    (activeView === '3d' ? selectedMedicines : selectedMedicines2D).map((medicine, idx) => {
                      const currentSection = activeView
                      const nameSuggestions = getMedicineNameSuggestions(medicine.name || "")
                      const showNameSuggestions =
                        activeNameSuggestion?.section === currentSection &&
                        activeNameSuggestion?.index === idx &&
                        nameSuggestions.length > 0
                      
                      return (
                      <div key={idx} className="bg-white rounded p-2 border border-purple-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-purple-900">#{idx + 1}</span>
                          <button
                            onClick={() => currentSection === '3d' ? removeMedicine(idx) : removeMedicine2D(idx)}
                            className="text-red-600 hover:text-red-800 text-xs font-bold"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="space-y-1.5">
                            <div className="relative flex items-center">
                              <input
                                type="text"
                                id={`name-anatomy-${currentSection}-${idx}`}
                                value={medicine.name}
                                onChange={(e) => currentSection === '3d' ? updateMedicine(idx, "name", e.target.value) : updateMedicine2D(idx, "name", e.target.value)}
                                onFocus={() => {
                                  setActiveNameSuggestion({ section: currentSection, index: idx })
                                  updateInlineSuggestion(currentSection, idx, medicine.name || "")
                                }}
                                onBlur={() => {
                                  setTimeout(() => {
                                    setActiveNameSuggestion((current) => {
                                      if (current?.section === currentSection && current.index === idx) {
                                        return null
                                      }
                                      return current
                                    })
                                  }, 150)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Tab" || e.key === "ArrowRight") {
                                    if (inlineSuggestion?.section === currentSection && inlineSuggestion.index === idx) {
                                      e.preventDefault()
                                      acceptInlineSuggestion(currentSection, idx)
                                    }
                                  } else if (e.key === "Enter") {
                                    if (inlineSuggestion?.section === currentSection && inlineSuggestion.index === idx) {
                                      e.preventDefault()
                                      acceptInlineSuggestion(currentSection, idx)
                                    } else if (nameSuggestions.length > 0) {
                                      e.preventDefault()
                                      handleSelectMedicineSuggestion(currentSection, idx, nameSuggestions[0])
                                    }
                                  } else if (e.key === "ArrowDown") {
                                    if (nameSuggestions.length > 0) {
                                      e.preventDefault()
                                      const firstOption = document.querySelector<HTMLButtonElement>(
                                        `#suggestion-btn-${currentSection}-${idx}-0`
                                      )
                                      firstOption?.focus()
                                    }
                                  } else if (e.key === "Escape") {
                                    setInlineSuggestion((prev) =>
                                      prev?.section === currentSection && prev.index === idx ? null : prev
                                    )
                                  }
                                }}
                                placeholder="Medicine name *"
                                className="w-full pl-2 pr-9 py-1 border border-purple-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                              <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-end">
                                <div className="pointer-events-auto">
                                  <VoiceInput
                                    onTranscript={(text) => {
                                      if (currentSection === '3d') {
                                        updateMedicine(idx, "name", text)
                                      } else {
                                        updateMedicine2D(idx, "name", text)
                                      }
                                      updateInlineSuggestion(currentSection, idx, text)
                                      setActiveNameSuggestion({ section: currentSection, index: idx })
                                    }}
                                    language="en-IN"
                                    useGoogleCloud={false}
                                    useMedicalModel={false}
                                    variant="inline"
                                  />
                                </div>
                              </div>
                              {inlineSuggestion?.section === currentSection &&
                              inlineSuggestion?.index === idx &&
                              inlineSuggestion?.suggestion &&
                              inlineSuggestion.suggestion.toLowerCase().startsWith((medicine.name || "").toLowerCase()) && (
                                <div className="pointer-events-none absolute inset-0 flex items-center pl-2 pr-9 text-xs text-gray-400 select-none">
                                  <span className="opacity-0">
                                    {(medicine.name || "").split("").map(() => "•").join("")}
                                  </span>
                                  <span>
                                    {
                                      inlineSuggestion.suggestion.slice(
                                        (medicine.name || "").length
                                      )
                                    }
                                  </span>
                                </div>
                              )}
                            </div>
                            {showNameSuggestions && (
                              <div className="mt-1 w-full max-h-40 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                                {nameSuggestions.map((suggestion, sugIdx) => (
                                  <button
                                    key={suggestion.name}
                                    type="button"
                                    id={`suggestion-btn-${currentSection}-${idx}-${sugIdx}`}
                                    className="w-full px-3 py-1.5 text-left hover:bg-green-50 transition text-[11px] first:rounded-t-lg last:rounded-b-lg text-gray-800"
                                    onClick={() => handleSelectMedicineSuggestion(currentSection, idx, suggestion)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault()
                                        handleSelectMedicineSuggestion(currentSection, idx, suggestion)
                                      } else if (e.key === "ArrowDown") {
                                        e.preventDefault()
                                        const next = document.querySelector<HTMLButtonElement>(
                                          `#suggestion-btn-${currentSection}-${idx}-${sugIdx + 1}`
                                        )
                                        next?.focus()
                                      } else if (e.key === "ArrowUp") {
                                        e.preventDefault()
                                        if (sugIdx === 0) {
                                          const input = document.querySelector<HTMLInputElement>(
                                            `#name-anatomy-${currentSection}-${idx}`
                                          )
                                          input?.focus()
                                        } else {
                                          const prev = document.querySelector<HTMLButtonElement>(
                                            `#suggestion-btn-${currentSection}-${idx}-${sugIdx - 1}`
                                          )
                                          prev?.focus()
                                        }
                                      }
                                    }}
                                  >
                                    <div className="font-semibold text-xs">{suggestion.name}</div>
                                    {suggestion.dosageOptions?.length ? (
                                      <div className="text-[10px] text-gray-500">
                                        Common dosage: {suggestion.dosageOptions[0].value}
                                      </div>
                                    ) : null}
                                  </button>
                                ))}
                              </div>
                            )}
                          <div className="grid grid-cols-3 gap-1.5">
                            <input
                              type="text"
                              value={medicine.dosage}
                              onChange={(e) => currentSection === '3d' ? updateMedicine(idx, "dosage", e.target.value) : updateMedicine2D(idx, "dosage", e.target.value)}
                              placeholder="Dosage"
                              className="w-full px-2 py-1 border border-purple-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                            <input
                              type="text"
                              value={medicine.frequency}
                              onChange={(e) => currentSection === '3d' ? updateMedicine(idx, "frequency", e.target.value) : updateMedicine2D(idx, "frequency", e.target.value)}
                              placeholder="Frequency"
                              className="w-full px-2 py-1 border border-purple-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                            <input
                              type="text"
                              value={medicine.duration}
                              onChange={(e) => currentSection === '3d' ? updateMedicine(idx, "duration", e.target.value) : updateMedicine2D(idx, "duration", e.target.value)}
                              placeholder="Duration"
                              className="w-full px-2 py-1 border border-purple-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                          </div>
                        </div>
                      </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* Disease Notes */}
            {(activeView === '3d' ? selectedDisease : selectedDisease2D) && (activeView === '3d' ? selectedDisease : selectedDisease2D)!.notes && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <h4 className="text-xs font-bold text-indigo-900 mb-2">Clinical Notes:</h4>
                <p className="text-xs text-indigo-800 leading-relaxed">{(activeView === '3d' ? selectedDisease : selectedDisease2D)!.notes}</p>
              </div>
            )}

            {/* Notes Section */}
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <label className="block font-semibold text-slate-800 mb-1.5 text-sm">
                Doctor Notes
              </label>
              <div className="relative flex items-center">
                <textarea
                  value={activeView === '3d' ? notes : notes2D}
                  onChange={(e) => activeView === '3d' ? setNotes(e.target.value) : setNotes2D(e.target.value)}
                  placeholder={`Document your findings from the ${activeView === '3d' ? '3D model' : '2D diagram'} examination... or use voice input`}
                  className="w-full p-2 pl-2 pr-10 border border-slate-300 rounded-lg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                />
                <div className="absolute right-2 top-2 pointer-events-none flex items-end justify-end">
                  <div className="pointer-events-auto">
                    <VoiceInput
                      onTranscript={(text) => {
                        if (activeView === '3d') setNotes(text)
                        else setNotes2D(text)
                      }}
                      language="en-IN"
                      useGoogleCloud={false}
                      useMedicalModel={false}
                      variant="inline"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Complete Checkup Button */}
            {((activeView === '3d' ? selectedDisease : selectedDisease2D) || (activeView === '3d' ? selectedMedicines : selectedMedicines2D).length > 0) && (
              <button
                onClick={activeView === '3d' ? handleCompleteCheckup : handleCompleteCheckup2D}
                disabled={completing}
                className="btn-modern btn-modern-success w-full flex items-center justify-center gap-2"
              >
                {completing ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Completing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Complete Checkup
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Completion Confirmation Modal */}
      {showCompletionModal && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <h3 className="text-2xl font-bold text-slate-800">Confirm Completion</h3>
            <button
              onClick={() => setShowCompletionModal(false)}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* Patient Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Patient Information</h4>
              <p className="text-slate-700">{patientName}</p>
            </div>

            {/* Selected Part */}
            {((activeView === '3d' ? selectedPartInfo : selectedPartInfo2D)) && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-semibold text-purple-900 mb-2">Selected Anatomy Part</h4>
                <p className="text-slate-700">{(activeView === '3d' ? selectedPartInfo : selectedPartInfo2D)?.name}</p>
              </div>
            )}

            {/* Diagnosis */}
            {(finalDiagnosis.length > 0 || customDiagnosis) && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">Diagnosis</h4>
                <div className="space-y-1">
                  {finalDiagnosis.filter(d => d !== CUSTOM_DIAGNOSIS_OPTION).map((diag, idx) => (
                    <p key={idx} className="text-slate-700">• {diag}</p>
                  ))}
                  {customDiagnosis && <p className="text-slate-700">• {customDiagnosis}</p>}
                </div>
              </div>
            )}

            {/* Medicines */}
            {((activeView === '3d' ? selectedMedicines : selectedMedicines2D).length > 0) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-2">Medicines ({((activeView === '3d' ? selectedMedicines : selectedMedicines2D).filter(m => m.name && m.name.trim()).length)})</h4>
                <div className="space-y-2">
                  {((activeView === '3d' ? selectedMedicines : selectedMedicines2D).filter(m => m.name && m.name.trim())).map((med, idx) => (
                    <div key={idx} className="bg-white rounded p-2 border border-amber-300">
                      <p className="font-medium text-slate-800">{med.name}</p>
                      {med.dosage && <p className="text-sm text-slate-600">Dosage: {med.dosage}</p>}
                      {med.frequency && <p className="text-sm text-slate-600">Frequency: {med.frequency}</p>}
                      {med.duration && <p className="text-sm text-slate-600">Duration: {med.duration}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {((activeView === '3d' ? notes : notes2D)) && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-2">Doctor Notes</h4>
                <p className="text-slate-700 whitespace-pre-wrap">{(activeView === '3d' ? notes : notes2D)}</p>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex gap-3">
            <button
              onClick={() => setShowCompletionModal(false)}
              className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (activeView === '3d') {
                  confirmCompleteCheckup()
                } else {
                  confirmCompleteCheckup2D()
                }
              }}
              disabled={completing}
              className="btn-modern btn-modern-success flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {completing ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Completing...
                </>
              ) : (
                'Confirm & Complete'
              )}
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
  )
}

