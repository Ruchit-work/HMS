// Female reproductive system anatomy parts with associated conditions, symptoms, and prescriptions
export interface Disease {
  id: string
  name: string
  description: string
  symptoms: string[]
  prescriptions: string[]
  medicines: Array<{
    name: string
    dosage: string
    frequency: string
    duration: string
  }>
  notes: string
}

export interface FemaleReproductivePartData {
  partName: string
  description: string
  diseases: Disease[]
}

export const femaleReproductivePartsData: Record<string, FemaleReproductivePartData> = {
  Pelvic_Bone: {
    partName: "Pelvic Bone (Bony Pelvis)",
    description: "The bony pelvis provides structural support and protects organs in the pelvic cavity.",
    diseases: [],
  },
  Bladder: {
    partName: "Bladder",
    description: "Muscular urinary organ that stores urine before elimination.",
    diseases: [
      {
        id: "uti",
        name: "UTI / Cystitis (General)",
        description: "Infection/inflammation of the bladder causing urinary symptoms.",
        symptoms: ["Burning urination", "Urgency", "Frequency", "Lower abdominal discomfort"],
        prescriptions: ["Urinalysis/urine culture if indicated", "Hydration", "Antibiotics per clinician decision"],
        medicines: [{ name: "Antibiotic (as per sensitivity)", dosage: "As advised", frequency: "As per protocol", duration: "As advised" }],
        notes: "Treatment depends on culture results and patient history.",
      },
    ],
  },
  Rectum: {
    partName: "Rectum",
    description: "Terminal part of the large intestine that stores stool before elimination.",
    diseases: [],
  },
  Uterus: {
    partName: "Uterus",
    description: "Muscular organ where a fetus develops during pregnancy. Responsible for menstrual bleeding and uterine contractions.",
    diseases: [
      {
        id: "uterine_fibroids",
        name: "Uterine Fibroids",
        description: "Benign smooth muscle tumors of the uterus that may cause heavy bleeding and pelvic pressure.",
        symptoms: ["Heavy menstrual bleeding", "Pelvic pressure", "Frequent urination", "Painful periods", "Anemia"],
        prescriptions: ["Ultrasound evaluation", "Iron supplementation if anemic", "Follow up with Gynecology", "Discuss medical vs surgical options"],
        medicines: [
          { name: "Tranexamic Acid", dosage: "500mg", frequency: "3 times daily (during heavy days)", duration: "3–5 days" },
          { name: "Mefenamic Acid", dosage: "500mg", frequency: "2–3 times daily", duration: "2–3 days" },
          { name: "Iron + Folic Acid", dosage: "As per label", frequency: "Daily", duration: "4–8 weeks" },
        ],
        notes: "Management depends on severity, age, fertility goals, and size/location of fibroids.",
      },
      {
        id: "adenomyosis",
        name: "Adenomyosis",
        description: "Endometrial tissue within the uterine muscle causing painful and heavy periods.",
        symptoms: ["Dysmenorrhea", "Heavy bleeding", "Pelvic pain", "Enlarged tender uterus"],
        prescriptions: ["Pelvic ultrasound/MRI if needed", "NSAIDs for pain", "Gynecology consultation"],
        medicines: [
          { name: "Naproxen", dosage: "500mg", frequency: "Twice daily", duration: "2–3 days" },
          { name: "Pantoprazole", dosage: "40mg", frequency: "Once daily", duration: "While on NSAIDs" },
        ],
        notes: "Consider hormonal therapy options under Gynecology supervision.",
      },
    ],
  },
  Ovary: {
    partName: "Ovary",
    description: "Produces eggs (oocytes) and hormones (estrogen, progesterone).",
    diseases: [
      {
        id: "ovarian_cyst",
        name: "Ovarian Cyst",
        description: "Fluid-filled sac in the ovary. Many are benign and resolve spontaneously.",
        symptoms: ["Pelvic pain", "Bloating", "Irregular periods", "Pain during intercourse"],
        prescriptions: ["Pelvic ultrasound", "Repeat imaging if advised", "Urgent evaluation if severe pain (torsion concern)"],
        medicines: [
          { name: "Ibuprofen", dosage: "400mg", frequency: "Every 8 hours as needed", duration: "2–3 days" },
        ],
        notes: "If acute severe pain + nausea/vomiting: rule out torsion urgently.",
      },
      {
        id: "pcos",
        name: "PCOS (Polycystic Ovary Syndrome)",
        description: "Hormonal disorder with ovulatory dysfunction and hyperandrogenism.",
        symptoms: ["Irregular periods", "Acne", "Weight gain", "Excess hair growth", "Infertility"],
        prescriptions: ["Lifestyle optimization", "Screen for diabetes/thyroid", "Gynecology/endocrine follow-up"],
        medicines: [
          { name: "Metformin", dosage: "500mg", frequency: "Once daily with food", duration: "As advised" },
        ],
        notes: "Medication depends on patient goals (cycle regulation, fertility, metabolic).",
      },
    ],
  },
  Cervix: {
    partName: "Cervix",
    description: "Lower narrow part of uterus opening into the vagina. Important for Pap screening and childbirth dilation.",
    diseases: [
      {
        id: "cervicitis",
        name: "Cervicitis",
        description: "Inflammation of cervix, often infectious (STIs) or non-infectious irritation.",
        symptoms: ["Vaginal discharge", "Bleeding after intercourse", "Pelvic pain", "Burning urination"],
        prescriptions: ["Speculum exam", "STI testing", "Treat partner if STI confirmed"],
        medicines: [
          { name: "Azithromycin", dosage: "1g", frequency: "Once", duration: "Single dose" },
        ],
        notes: "Antibiotics depend on suspected organism and local protocols.",
      },
    ],
  },
  Vagina: {
    partName: "Vagina",
    description: "Muscular canal from cervix to the vulva. Maintains protective microbiome and acidic pH.",
    diseases: [
      {
        id: "vaginitis",
        name: "Vaginitis",
        description: "Inflammation/infection of vagina (yeast, BV, trichomoniasis).",
        symptoms: ["Itching", "Discharge", "Odor", "Burning", "Pain during urination"],
        prescriptions: ["Vaginal swab if needed", "Avoid douching", "Hygiene guidance"],
        medicines: [
          { name: "Fluconazole", dosage: "150mg", frequency: "Once", duration: "Single dose" },
        ],
        notes: "Treatment depends on cause. Confirm diagnosis if recurrent.",
      },
    ],
  },
  Vulva: {
    partName: "Vulva",
    description: "External part of female genitalia. Includes labia and clitoral structures.",
    diseases: [
      {
        id: "vulvitis",
        name: "Vulvitis",
        description: "Inflammation/irritation of the vulva, often due to infection, allergy, or hygiene-related irritation.",
        symptoms: ["Itching", "Burning", "Redness", "Soreness", "Discharge (if infectious)"],
        prescriptions: ["Clinical examination", "Swab/assessment if infection suspected", "Avoid irritants and maintain hygiene"],
        medicines: [
          { name: "Antifungal or antibiotic", dosage: "As advised", frequency: "As per diagnosis", duration: "As advised" },
        ],
        notes: "Specific treatment depends on the cause (fungal, bacterial, dermatitis, STI).",
      },
    ],
  },
  Uterine_Tube: {
    partName: "Uterine Tube (Fallopian Tube)",
    description: "Transports egg from ovary to uterus. Common site of ectopic pregnancy.",
    diseases: [
      {
        id: "pid",
        name: "PID (Pelvic Inflammatory Disease)",
        description: "Ascending infection affecting uterus, tubes, ovaries; may cause infertility if untreated.",
        symptoms: ["Lower abdominal pain", "Fever", "Discharge", "Pain during intercourse", "Cervical motion tenderness"],
        prescriptions: ["Urgent clinical evaluation", "STI testing", "Partner treatment if indicated"],
        medicines: [
          { name: "Doxycycline", dosage: "100mg", frequency: "Twice daily", duration: "14 days" },
        ],
        notes: "Use local antibiotic protocols; severe PID may require IV antibiotics.",
      },
    ],
  },
  Endometrium: {
    partName: "Endometrium",
    description: "Inner lining of uterus that thickens and sheds during the menstrual cycle.",
    diseases: [
      {
        id: "endometriosis",
        name: "Endometriosis",
        description: "Endometrium-like tissue outside the uterus causing chronic pelvic pain and infertility.",
        symptoms: ["Painful periods", "Chronic pelvic pain", "Pain during intercourse", "Infertility"],
        prescriptions: ["Gynecology evaluation", "Pain management", "Consider imaging/laparoscopy if advised"],
        medicines: [
          { name: "Naproxen", dosage: "500mg", frequency: "Twice daily", duration: "2–3 days" },
        ],
        notes: "Long-term management often includes hormonal therapy under specialist care.",
      },
    ],
  },
  Myometrium: {
    partName: "Myometrium",
    description: "Muscular middle layer of uterus responsible for contractions.",
    diseases: [],
  },
  Fundus: {
    partName: "Fundus",
    description: "Top portion of uterus above the openings of the uterine tubes.",
    diseases: [],
  },
  Infundibulum: {
    partName: "Infundibulum",
    description: "Funnel-shaped end of the uterine tube near the ovary.",
    diseases: [],
  },
  Fimbriae: {
    partName: "Fimbriae",
    description: "Finger-like projections of the uterine tube that help capture the ovulated egg.",
    diseases: [],
  },
}

