/**
 * Signup Form Constants
 * Medical specializations, qualifications, and blood groups
 */

// Medical specializations organized by category
export const specializationCategories = [
  {
    id: "general",
    name: "General & Primary Care",
    icon: "🩺",
    specializations: ["General Physician", "Family Medicine Specialist"]
  },
  {
    id: "heart",
    name: "Heart & Circulatory System",
    icon: "❤️",
    specializations: ["Cardiologist", "Cardiothoracic Surgeon", "Vascular Surgeon"]
  },
  {
    id: "brain",
    name: "Brain, Nerves & Mental Health",
    icon: "🧠",
    specializations: ["Neurologist", "Neurosurgeon", "Psychiatrist", "Psychologist"]
  },
  {
    id: "lungs",
    name: "Lungs & Respiratory System",
    icon: "🫁",
    specializations: ["Pulmonologist"]
  },
  {
    id: "digestive",
    name: "Digestive System",
    icon: "🍽️",
    specializations: ["Gastroenterologist", "Hepatologist"]
  },
  {
    id: "hormones",
    name: "Hormones & Metabolism",
    icon: "💉",
    specializations: ["Endocrinologist"]
  },
  {
    id: "blood_cancer",
    name: "Blood & Cancer",
    icon: "🩸",
    specializations: ["Hematologist", "Oncologist", "Radiation Oncologist"]
  },
  {
    id: "bones",
    name: "Bones, Muscles & Movement",
    icon: "🦴",
    specializations: ["Orthopedic Surgeon", "Rheumatologist", "Physiotherapist"]
  },
  {
    id: "infections",
    name: "Infections & Immunity",
    icon: "🧬",
    specializations: ["Infectious Disease Specialist", "Immunologist / Allergist"]
  },
  {
    id: "eye_ear",
    name: "Eye, Ear, Nose & Throat",
    icon: "👁️",
    specializations: ["Ophthalmologist", "ENT Specialist (Otorhinolaryngologist)"]
  },
  {
    id: "skin",
    name: "Skin, Hair & Nails",
    icon: "🧴",
    specializations: ["Dermatologist"]
  },
  {
    id: "women_children",
    name: "Women & Children",
    icon: "🤰",
    specializations: ["Gynecologist / Obstetrician (OB/GYN)", "Pediatrician", "Neonatologist"]
  },
  {
    id: "urinary",
    name: "Urinary & Reproductive System",
    icon: "🧍‍♂️",
    specializations: ["Urologist", "Andrologist"]
  },
  {
    id: "dental",
    name: "Dental & Oral",
    icon: "🦷",
    specializations: ["Dentist / Oral Surgeon"]
  },
  {
    id: "advanced",
    name: "Other Advanced Specialties",
    icon: "🧑‍⚕️",
    specializations: ["Nephrologist", "Anesthesiologist", "Pathologist", "Radiologist", "Emergency Medicine Specialist", "Geriatrician"]
  },
  {
    id: "other",
    name: "Other / Custom",
    icon: "✏️",
    specializations: ["Other"]
  }
]

// List of medical qualifications with full names
export const qualifications = [
  // 🩺 Undergraduate (Basic Medical Degrees)
  "MBBS – Bachelor of Medicine, Bachelor of Surgery",
  "BDS – Bachelor of Dental Surgery",
  "BHMS – Bachelor of Homeopathic Medicine & Surgery",
  "BAMS – Bachelor of Ayurvedic Medicine & Surgery",
  "BUMS – Bachelor of Unani Medicine & Surgery",
  "BSMS – Bachelor of Siddha Medicine & Surgery",
  "BNYS – Bachelor of Naturopathy and Yogic Sciences",
  "BVSc & AH – Bachelor of Veterinary Science and Animal Husbandry",

  // 🎓 Postgraduate (Medical Specializations)
  "MD – Doctor of Medicine",
  "MS – Master of Surgery",
  "DNB – Diplomate of National Board",
  "PG Diploma – Post Graduate Diploma in Medicine",
  "MCh – Magister Chirurgiae (Master of Surgery)",
  "DM – Doctorate of Medicine",

  // 🧠 Super-Specialization & Fellowships
  "FNB – Fellowship of National Board",
  "FRCS – Fellowship of the Royal College of Surgeons",
  "MRCP – Membership of the Royal College of Physicians",
  "MRCS – Membership of the Royal College of Surgeons",
  "FRCOG – Fellowship of the Royal College of Obstetricians & Gynecologists",
  "FRCPath – Fellowship of the Royal College of Pathologists",

  // 🧬 Allied & Paramedical
  "BPT – Bachelor of Physiotherapy",
  "MPT – Master of Physiotherapy",
  "BPharm – Bachelor of Pharmacy",
  "MPharm – Master of Pharmacy",
  "BSc Nursing",
  "MSc Nursing",
  "BMLT – Bachelor of Medical Laboratory Technology",
  "MMLT – Master of Medical Laboratory Technology",
  "BSc Optometry",
  "BSc Radiology / Imaging Technology",

  // Other
  "Other"
]

export const qualificationSpecializationMap: Record<string, string[]> = {
  "MBBS – Bachelor of Medicine, Bachelor of Surgery": [
    "General Physician",
    "Family Medicine Specialist",
    "Cardiologist",
    "Pulmonologist",
    "Gastroenterologist",
    "Hepatologist",
    "Endocrinologist",
    "Hematologist",
    "Oncologist",
    "Radiation Oncologist",
    "Neurologist",
    "Psychiatrist",
    "Dermatologist",
    "Infectious Disease Specialist",
    "Immunologist / Allergist",
    "Ophthalmologist",
    "ENT Specialist (Otorhinolaryngologist)",
    "Gynecologist / Obstetrician (OB/GYN)",
    "Pediatrician",
    "Neonatologist",
    "Urologist",
    "Andrologist",
    "Nephrologist",
    "Emergency Medicine Specialist",
    "Geriatrician",
  ],
  "MD – Doctor of Medicine": [
    "General Physician",
    "Cardiologist",
    "Neurologist",
    "Endocrinologist",
    "Hematologist",
    "Oncologist",
    "Radiation Oncologist",
    "Gastroenterologist",
    "Hepatologist",
    "Pulmonologist",
    "Psychiatrist",
    "Dermatologist",
    "Infectious Disease Specialist",
    "Immunologist / Allergist",
    "Nephrologist",
    "Emergency Medicine Specialist",
    "Geriatrician",
  ],
  "MS – Master of Surgery": [
    "Cardiothoracic Surgeon",
    "Neurosurgeon",
    "Orthopedic Surgeon",
    "Vascular Surgeon",
    "ENT Specialist (Otorhinolaryngologist)",
    "Urologist",
    "Gynecologist / Obstetrician (OB/GYN)",
  ],
  "DNB – Diplomate of National Board": [
    "General Physician",
    "Family Medicine Specialist",
    "Cardiologist",
    "Pulmonologist",
    "Gastroenterologist",
    "Hepatologist",
    "Endocrinologist",
    "Hematologist",
    "Oncologist",
    "Radiation Oncologist",
    "Neurologist",
    "Psychiatrist",
    "Dermatologist",
    "Orthopedic Surgeon",
    "Cardiothoracic Surgeon",
    "Neurosurgeon",
    "Infectious Disease Specialist",
    "Immunologist / Allergist",
    "Ophthalmologist",
    "ENT Specialist (Otorhinolaryngologist)",
    "Gynecologist / Obstetrician (OB/GYN)",
    "Pediatrician",
    "Neonatologist",
    "Urologist",
    "Andrologist",
    "Nephrologist",
    "Pathologist",
    "Radiologist",
    "Emergency Medicine Specialist",
    "Geriatrician",
  ],
  "DM – Doctorate of Medicine": [
    "Cardiologist",
    "Neurologist",
    "Endocrinologist",
    "Hematologist",
    "Oncologist",
    "Radiation Oncologist",
    "Gastroenterologist",
    "Hepatologist",
    "Pulmonologist",
    "Nephrologist",
  ],
  "MCh – Magister Chirurgiae (Master of Surgery)": [
    "Cardiothoracic Surgeon",
    "Neurosurgeon",
    "Vascular Surgeon",
    "Urologist",
    "Gynecologist / Obstetrician (OB/GYN)",
  ],
  "PG Diploma – Post Graduate Diploma in Medicine": [
    "General Physician",
    "Family Medicine Specialist",
    "Dermatologist",
    "Psychiatrist",
    "Emergency Medicine Specialist",
  ],
  "BDS – Bachelor of Dental Surgery": ["Dentist / Oral Surgeon"],
  "BPT – Bachelor of Physiotherapy": ["Physiotherapist"],
  "MPT – Master of Physiotherapy": ["Physiotherapist"],
  "BSc Optometry": ["Ophthalmologist"],
  "BSc Radiology / Imaging Technology": ["Radiologist"],
  "BSc Nursing": ["Emergency Medicine Specialist", "Other"],
  "MSc Nursing": ["Emergency Medicine Specialist", "Other"],
  "BPharm – Bachelor of Pharmacy": ["Other"],
  "MPharm – Master of Pharmacy": ["Other"],
  "Other": ["Other"],
}

// Blood groups
export const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]

