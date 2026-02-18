// Ear anatomy parts with associated diseases, symptoms, prescriptions, and medicines
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

export interface EarPartData {
  partName: string
  description: string
  diseases: Disease[]
}

export const earPartsData: Record<string, EarPartData> = {
  Outer_Ear: {
    partName: 'Outer Ear (Pinna/Auricle)',
    description: 'The visible external portion of the ear that collects sound waves and directs them into the ear canal.',
    diseases: [
      {
        id: 'otitis_externa',
        name: 'Otitis Externa (Swimmer\'s Ear)',
        description: 'Inflammation or infection of the external ear canal, often caused by water exposure or bacterial/fungal infection.',
        symptoms: ['Ear pain', 'Itching', 'Redness', 'Swelling', 'Discharge', 'Hearing loss'],
        prescriptions: [
          'Keep ear dry during treatment',
          'Avoid swimming until healed',
          'Use ear drops as prescribed',
          'Do not insert objects into ear'
        ],
        medicines: [
          { name: 'Ciprofloxacin Ear Drops', dosage: '0.3%', frequency: '2-3 times daily', duration: '7-10 days' },
          { name: 'Hydrocortisone Ear Drops', dosage: '1%', frequency: '2-3 times daily', duration: '7-10 days' },
          { name: 'Acetic Acid Solution', dosage: '2%', frequency: '2-3 times daily', duration: '5-7 days' }
        ],
        notes: 'Monitor for signs of spreading infection. If symptoms worsen, consider oral antibiotics.'
      },
      {
        id: 'perichondritis',
        name: 'Perichondritis',
        description: 'Infection of the cartilage of the outer ear, often following trauma or piercing.',
        symptoms: ['Ear pain', 'Redness', 'Swelling', 'Fever', 'Tenderness'],
        prescriptions: [
          'Oral antibiotics required',
          'Warm compresses',
          'Pain management',
          'Avoid pressure on ear'
        ],
        medicines: [
          { name: 'Amoxicillin-Clavulanate', dosage: '875mg/125mg', frequency: 'Twice daily', duration: '10-14 days' },
          { name: 'Ciprofloxacin', dosage: '500mg', frequency: 'Twice daily', duration: '10-14 days' },
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '5-7 days' }
        ],
        notes: 'Severe cases may require surgical drainage. Monitor for abscess formation.'
      },
      {
        id: 'cauliflower_ear',
        name: 'Cauliflower Ear',
        description: 'Deformity of the outer ear caused by repeated trauma, leading to blood clot formation and cartilage damage.',
        symptoms: ['Ear deformity', 'Swelling', 'Pain', 'Bruising'],
        prescriptions: [
          'Drainage of hematoma if present',
          'Compression dressing',
          'Avoid further trauma',
          'Surgical correction may be needed'
        ],
        medicines: [
          { name: 'Acetaminophen', dosage: '500mg', frequency: 'Every 6 hours', duration: '3-5 days' },
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '3-5 days' }
        ],
        notes: 'Early intervention crucial to prevent permanent deformity. Refer to ENT specialist if needed.'
      }
    ]
  },
  Ear_Canal: {
    partName: 'Ear Canal (External Auditory Canal)',
    description: 'A tube-like structure that extends from the outer ear to the eardrum, amplifying sound and protecting the inner ear.',
    diseases: [
      {
        id: 'cerumen_impaction',
        name: 'Cerumen Impaction (Earwax Blockage)',
        description: 'Excessive buildup of earwax that blocks the ear canal, causing hearing loss and discomfort.',
        symptoms: ['Hearing loss', 'Ear fullness', 'Itching', 'Tinnitus', 'Earache', 'Dizziness'],
        prescriptions: [
          'Earwax removal by irrigation or suction',
          'Avoid cotton swabs',
          'Use ear drops to soften wax',
          'Regular ear hygiene'
        ],
        medicines: [
          { name: 'Carbamide Peroxide Ear Drops', dosage: '6.5%', frequency: '2-3 times daily', duration: '3-5 days' },
          { name: 'Olive Oil Drops', dosage: 'As needed', frequency: '2-3 times daily', duration: '3-5 days' },
          { name: 'Sodium Bicarbonate Drops', dosage: 'As needed', frequency: '2-3 times daily', duration: '3-5 days' }
        ],
        notes: 'Gentle irrigation with warm water after softening. Avoid if eardrum perforation suspected.'
      },
      {
        id: 'foreign_body',
        name: 'Foreign Body in Ear Canal',
        description: 'Presence of objects or insects in the ear canal causing obstruction and potential damage.',
        symptoms: ['Ear pain', 'Hearing loss', 'Itching', 'Discharge', 'Buzzing sound'],
        prescriptions: [
          'Careful removal under visualization',
          'Antibiotic drops if infection present',
          'Pain management',
          'Follow-up if symptoms persist'
        ],
        medicines: [
          { name: 'Ciprofloxacin Ear Drops', dosage: '0.3%', frequency: '2-3 times daily', duration: '5-7 days' },
          { name: 'Acetaminophen', dosage: '500mg', frequency: 'Every 6 hours', duration: '2-3 days' }
        ],
        notes: 'Do not attempt removal if object is deeply embedded. Refer to ENT specialist if needed.'
      }
    ]
  },
  Eardrum: {
    partName: 'Eardrum (Tympanic Membrane)',
    description: 'A thin membrane that separates the external ear from the middle ear and vibrates in response to sound waves.',
    diseases: [
      {
        id: 'tympanic_perforation',
        name: 'Tympanic Membrane Perforation',
        description: 'A hole or tear in the eardrum, often caused by infection, trauma, or pressure changes.',
        symptoms: ['Hearing loss', 'Ear pain', 'Tinnitus', 'Discharge', 'Dizziness'],
        prescriptions: [
          'Keep ear dry',
          'Avoid water entry',
          'Antibiotic drops if infected',
          'Surgical repair may be needed for large perforations'
        ],
        medicines: [
          { name: 'Ciprofloxacin Ear Drops', dosage: '0.3%', frequency: '2-3 times daily', duration: '7-10 days' },
          { name: 'Amoxicillin', dosage: '500mg', frequency: 'Three times daily', duration: '7-10 days' },
          { name: 'Acetaminophen', dosage: '500mg', frequency: 'Every 6 hours', duration: '3-5 days' }
        ],
        notes: 'Small perforations often heal spontaneously. Large or persistent perforations may require tympanoplasty.'
      },
      {
        id: 'otitis_media',
        name: 'Otitis Media (Middle Ear Infection)',
        description: 'Infection of the middle ear space behind the eardrum, often following upper respiratory infections.',
        symptoms: ['Ear pain', 'Fever', 'Hearing loss', 'Ear fullness', 'Discharge if perforated'],
        prescriptions: [
          'Oral antibiotics',
          'Pain management',
          'Nasal decongestants',
          'Warm compresses'
        ],
        medicines: [
          { name: 'Amoxicillin', dosage: '500mg', frequency: 'Three times daily', duration: '10 days' },
          { name: 'Amoxicillin-Clavulanate', dosage: '875mg/125mg', frequency: 'Twice daily', duration: '10 days' },
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '5-7 days' },
          { name: 'Pseudoephedrine', dosage: '30-60mg', frequency: 'Every 6 hours', duration: '5-7 days' }
        ],
        notes: 'Monitor for complications like mastoiditis. Consider tympanocentesis if severe or unresponsive.'
      },
      {
        id: 'tympanosclerosis',
        name: 'Tympanosclerosis',
        description: 'Calcification and scarring of the eardrum, often following recurrent infections or trauma.',
        symptoms: ['Hearing loss', 'White patches on eardrum', 'Usually asymptomatic'],
        prescriptions: [
          'Hearing evaluation',
          'Monitor hearing function',
          'Surgical intervention if significant hearing loss'
        ],
        medicines: [
          { name: 'Vitamin D', dosage: '1000-2000 IU', frequency: 'Daily', duration: 'Long-term' },
          { name: 'Calcium Supplement', dosage: '1000mg', frequency: 'Daily', duration: 'Long-term' }
        ],
        notes: 'Usually benign. Surgical removal only if causing significant hearing impairment.'
      }
    ]
  },
  Ossicles: {
    partName: 'Ossicles (Middle Ear Bones)',
    description: 'Three tiny bones (malleus, incus, stapes) that amplify and transmit sound vibrations from the eardrum to the inner ear.',
    diseases: [
      {
        id: 'otosclerosis',
        name: 'Otosclerosis',
        description: 'Abnormal bone growth in the middle ear, particularly affecting the stapes, causing progressive hearing loss.',
        symptoms: ['Progressive hearing loss', 'Tinnitus', 'Dizziness', 'Usually bilateral'],
        prescriptions: [
          'Hearing aid evaluation',
          'Surgical consultation (stapedectomy)',
          'Regular hearing monitoring',
          'Avoid loud noise exposure'
        ],
        medicines: [
          { name: 'Sodium Fluoride', dosage: '20-40mg', frequency: 'Daily', duration: 'Long-term (as prescribed)' },
          { name: 'Calcium Supplement', dosage: '1000mg', frequency: 'Daily', duration: 'Long-term' },
          { name: 'Vitamin D', dosage: '1000-2000 IU', frequency: 'Daily', duration: 'Long-term' }
        ],
        notes: 'Surgical intervention (stapedectomy) is the primary treatment. Hearing aids are alternative option.'
      },
      {
        id: 'ossicular_discontinuity',
        name: 'Ossicular Chain Discontinuity',
        description: 'Break or dislocation of the ossicular chain, often due to trauma or chronic infection.',
        symptoms: ['Conductive hearing loss', 'Tinnitus', 'History of trauma or infection'],
        prescriptions: [
          'Hearing evaluation',
          'CT scan of temporal bone',
          'Surgical reconstruction (ossiculoplasty)',
          'Hearing aid consideration'
        ],
        medicines: [
          { name: 'Ciprofloxacin Ear Drops', dosage: '0.3%', frequency: '2-3 times daily', duration: '7-10 days (if infection present)' }
        ],
        notes: 'Surgical reconstruction is the primary treatment. Success depends on extent of damage.'
      }
    ]
  },
  Cochlea: {
    partName: 'Cochlea',
    description: 'A spiral-shaped organ in the inner ear responsible for converting sound vibrations into electrical signals for the brain.',
    diseases: [
      {
        id: 'sensorineural_hearing_loss',
        name: 'Sensorineural Hearing Loss',
        description: 'Hearing loss caused by damage to the cochlea or auditory nerve, often permanent.',
        symptoms: ['Hearing loss', 'Difficulty understanding speech', 'Tinnitus', 'Dizziness'],
        prescriptions: [
          'Hearing aid evaluation',
          'Cochlear implant consideration for severe cases',
          'Hearing protection',
          'Regular audiological follow-up'
        ],
        medicines: [
          { name: 'Prednisone (for sudden hearing loss)', dosage: '60mg', frequency: 'Daily', duration: '10-14 days (tapering)' },
          { name: 'Antiviral (if viral cause)', dosage: 'As prescribed', frequency: 'As prescribed', duration: 'As prescribed' }
        ],
        notes: 'Early intervention crucial for sudden sensorineural hearing loss. Refer to ENT specialist immediately.'
      },
      {
        id: 'menieres_disease',
        name: 'Ménière\'s Disease',
        description: 'Inner ear disorder causing episodes of vertigo, hearing loss, tinnitus, and ear fullness.',
        symptoms: ['Vertigo attacks', 'Hearing loss (fluctuating)', 'Tinnitus', 'Ear fullness', 'Nausea/vomiting'],
        prescriptions: [
          'Low-sodium diet (<2000mg/day)',
          'Diuretics',
          'Vestibular rehabilitation',
          'Stress management',
          'Avoid caffeine and alcohol'
        ],
        medicines: [
          { name: 'Hydrochlorothiazide', dosage: '25mg', frequency: 'Daily', duration: 'Long-term' },
          { name: 'Betahistine', dosage: '16-24mg', frequency: 'Three times daily', duration: 'Long-term' },
          { name: 'Meclizine (for vertigo)', dosage: '25mg', frequency: 'As needed', duration: 'As needed' },
          { name: 'Diazepam (for severe vertigo)', dosage: '2-5mg', frequency: 'As needed', duration: 'As needed' }
        ],
        notes: 'Symptom management is key. Consider intratympanic gentamicin or surgery for refractory cases.'
      },
      {
        id: 'noise_induced_hearing_loss',
        name: 'Noise-Induced Hearing Loss',
        description: 'Permanent hearing damage caused by exposure to loud noise, affecting the hair cells in the cochlea.',
        symptoms: ['Gradual hearing loss', 'Tinnitus', 'Difficulty hearing in noise', 'High-frequency loss'],
        prescriptions: [
          'Hearing protection (earplugs/earmuffs)',
          'Hearing aid evaluation',
          'Avoid further noise exposure',
          'Regular hearing monitoring'
        ],
        medicines: [
          { name: 'Ginkgo Biloba (for tinnitus)', dosage: '120mg', frequency: 'Twice daily', duration: 'Long-term' },
          { name: 'N-Acetylcysteine (NAC)', dosage: '600mg', frequency: 'Twice daily', duration: '3-6 months' },
          { name: 'Magnesium', dosage: '400mg', frequency: 'Daily', duration: 'Long-term' },
          { name: 'Vitamin B12', dosage: '1000mcg', frequency: 'Daily', duration: 'Long-term' }
        ],
        notes: 'Prevention is key. Once damage occurs, it is usually permanent. Hearing aids can help.'
      }
    ]
  },
  Semicircular_Canals: {
    partName: 'Semicircular Canals',
    description: 'Three fluid-filled loops that detect head movements and help maintain balance and spatial orientation.',
    diseases: [
      {
        id: 'bppv',
        name: 'Benign Paroxysmal Positional Vertigo (BPPV)',
        description: 'Disorder caused by displaced calcium crystals in the semicircular canals, causing brief episodes of vertigo.',
        symptoms: ['Brief vertigo with head movement', 'Nausea', 'Nystagmus', 'No hearing loss'],
        prescriptions: [
          'Epley maneuver (canalith repositioning)',
          'Brandt-Daroff exercises',
          'Avoid sudden head movements',
          'Sleep with head elevated'
        ],
        medicines: [
          { name: 'Meclizine', dosage: '25mg', frequency: 'As needed', duration: 'Short-term' },
          { name: 'Diazepam', dosage: '2-5mg', frequency: 'As needed', duration: 'Short-term' }
        ],
        notes: 'Canalith repositioning maneuvers are highly effective. Most cases resolve with treatment.'
      },
      {
        id: 'labyrinthitis',
        name: 'Labyrinthitis',
        description: 'Inflammation of the inner ear labyrinth, often viral or bacterial, affecting both hearing and balance.',
        symptoms: ['Severe vertigo', 'Hearing loss', 'Tinnitus', 'Nausea/vomiting', 'Nystagmus'],
        prescriptions: [
          'Bed rest during acute phase',
          'Vestibular suppressants',
          'Antibiotics if bacterial',
          'Vestibular rehabilitation'
        ],
        medicines: [
          { name: 'Amoxicillin (if bacterial)', dosage: '500mg', frequency: 'Three times daily', duration: '10-14 days' },
          { name: 'Prednisone', dosage: '60mg', frequency: 'Daily', duration: '10-14 days (tapering)' },
          { name: 'Meclizine', dosage: '25mg', frequency: 'Every 6 hours', duration: '5-7 days' },
          { name: 'Diazepam', dosage: '2-5mg', frequency: 'Every 6-8 hours', duration: '3-5 days' }
        ],
        notes: 'Viral causes are more common. Supportive care and vestibular rehabilitation are important.'
      },
      {
        id: 'vestibular_neuritis',
        name: 'Vestibular Neuritis',
        description: 'Inflammation of the vestibular nerve, causing vertigo without hearing loss.',
        symptoms: ['Acute severe vertigo', 'Nausea/vomiting', 'Nystagmus', 'No hearing loss', 'Imbalance'],
        prescriptions: [
          'Vestibular suppressants initially',
          'Vestibular rehabilitation',
          'Gradual return to activity',
          'Balance exercises'
        ],
        medicines: [
          { name: 'Prednisone', dosage: '60mg', frequency: 'Daily', duration: '10-14 days (tapering)' },
          { name: 'Meclizine', dosage: '25mg', frequency: 'Every 6 hours', duration: '3-5 days' },
          { name: 'Diazepam', dosage: '2-5mg', frequency: 'Every 6-8 hours', duration: '2-3 days' }
        ],
        notes: 'Usually self-limiting. Early vestibular rehabilitation improves recovery.'
      }
    ]
  },
  Auditory_Nerve: {
    partName: 'Auditory Nerve (Cochlear Nerve)',
    description: 'The cranial nerve that carries electrical signals from the cochlea to the brain for sound perception.',
    diseases: [
      {
        id: 'acoustic_neuroma',
        name: 'Acoustic Neuroma (Vestibular Schwannoma)',
        description: 'Benign tumor of the vestibular nerve, causing progressive hearing loss and balance issues.',
        symptoms: ['Progressive hearing loss', 'Tinnitus', 'Balance problems', 'Facial numbness (if large)'],
        prescriptions: [
          'MRI imaging',
          'ENT/Neurosurgeon consultation',
          'Hearing aid consideration',
          'Monitoring vs. surgery/radiation'
        ],
        medicines: [
          { name: 'Prednisone (for inflammation)', dosage: '40-60mg', frequency: 'Daily', duration: 'As prescribed (tapering)' },
          { name: 'Meclizine (for vertigo)', dosage: '25mg', frequency: 'As needed', duration: 'As needed' },
          { name: 'Diazepam (for severe vertigo)', dosage: '2-5mg', frequency: 'As needed', duration: 'As needed' },
          { name: 'Ginkgo Biloba (for tinnitus)', dosage: '120mg', frequency: 'Twice daily', duration: 'Long-term' }
        ],
        notes: 'Treatment depends on size and symptoms. Options include observation, surgery, or radiation therapy.'
      },
      {
        id: 'neural_presbycusis',
        name: 'Neural Presbycusis',
        description: 'Age-related hearing loss due to degeneration of auditory nerve fibers.',
        symptoms: ['Gradual hearing loss', 'Difficulty understanding speech', 'Tinnitus'],
        prescriptions: [
          'Hearing aid evaluation',
          'Communication strategies',
          'Regular hearing monitoring',
          'Hearing protection'
        ],
        medicines: [
          { name: 'Ginkgo Biloba (for tinnitus)', dosage: '120mg', frequency: 'Twice daily', duration: 'Long-term' },
          { name: 'Vitamin B12', dosage: '1000mcg', frequency: 'Daily', duration: 'Long-term' },
          { name: 'Folic Acid', dosage: '400-800mcg', frequency: 'Daily', duration: 'Long-term' },
          { name: 'Magnesium', dosage: '400mg', frequency: 'Daily', duration: 'Long-term' }
        ],
        notes: 'Progressive condition. Hearing aids are the primary treatment. Early intervention improves outcomes.'
      }
    ]
  },
  Vestibular_Nerve: {
    partName: 'Vestibular Nerve',
    description: 'Part of the vestibulocochlear nerve that carries balance information from the semicircular canals and vestibule to the brain.',
    diseases: [
      {
        id: 'vestibular_neuritis',
        name: 'Vestibular Neuritis',
        description: 'Inflammation of the vestibular nerve, causing vertigo without hearing loss.',
        symptoms: ['Acute severe vertigo', 'Nausea/vomiting', 'Nystagmus', 'No hearing loss', 'Imbalance'],
        prescriptions: [
          'Vestibular suppressants initially',
          'Vestibular rehabilitation',
          'Gradual return to activity',
          'Balance exercises'
        ],
        medicines: [
          { name: 'Prednisone', dosage: '60mg', frequency: 'Daily', duration: '10-14 days (tapering)' },
          { name: 'Meclizine', dosage: '25mg', frequency: 'Every 6 hours', duration: '3-5 days' },
          { name: 'Diazepam', dosage: '2-5mg', frequency: 'Every 6-8 hours', duration: '2-3 days' }
        ],
        notes: 'Usually self-limiting. Early vestibular rehabilitation improves recovery.'
      },
      {
        id: 'vestibular_schwannoma',
        name: 'Vestibular Schwannoma',
        description: 'Benign tumor of the vestibular nerve, causing progressive hearing loss and balance issues.',
        symptoms: ['Progressive hearing loss', 'Tinnitus', 'Balance problems', 'Facial numbness (if large)'],
        prescriptions: [
          'MRI imaging',
          'ENT/Neurosurgeon consultation',
          'Hearing aid consideration',
          'Monitoring vs. surgery/radiation'
        ],
        medicines: [
          { name: 'Prednisone (for inflammation)', dosage: '40-60mg', frequency: 'Daily', duration: 'As prescribed (tapering)' },
          { name: 'Meclizine (for vertigo)', dosage: '25mg', frequency: 'As needed', duration: 'As needed' },
          { name: 'Diazepam (for severe vertigo)', dosage: '2-5mg', frequency: 'As needed', duration: 'As needed' },
          { name: 'Ginkgo Biloba (for tinnitus)', dosage: '120mg', frequency: 'Twice daily', duration: 'Long-term' }
        ],
        notes: 'Treatment depends on size and symptoms. Options include observation, surgery, or radiation therapy.'
      }
    ]
  },
  Round_Window: {
    partName: 'Round Window',
    description: 'A membrane-covered opening in the cochlea that allows fluid movement in the inner ear, complementary to the oval window.',
    diseases: [
      {
        id: 'round_window_rupture',
        name: 'Round Window Rupture',
        description: 'Tear or perforation of the round window membrane, often caused by barotrauma or trauma.',
        symptoms: ['Sudden hearing loss', 'Tinnitus', 'Vertigo', 'Ear fullness'],
        prescriptions: [
          'Bed rest',
          'Avoid straining',
          'Surgical repair may be needed',
          'Hearing protection'
        ],
        medicines: [
          { name: 'Prednisone', dosage: '60mg', frequency: 'Daily', duration: '10-14 days (tapering)' },
          { name: 'Antibiotics (prophylactic)', dosage: 'As prescribed', frequency: 'As prescribed', duration: '7-10 days' }
        ],
        notes: 'Early diagnosis and treatment important. Surgical repair may be necessary if conservative management fails.'
      },
      {
        id: 'round_window_niche_pathology',
        name: 'Round Window Niche Pathology',
        description: 'Pathological conditions affecting the round window niche, including scarring or fibrosis.',
        symptoms: ['Hearing loss', 'Tinnitus', 'Dizziness'],
        prescriptions: [
          'Hearing evaluation',
          'CT/MRI imaging',
          'Surgical exploration if needed',
          'Hearing rehabilitation'
        ],
        medicines: [
          { name: 'Prednisone (if inflammatory)', dosage: '40-60mg', frequency: 'Daily', duration: '10-14 days (tapering)' },
          { name: 'Ciprofloxacin Ear Drops (if infection)', dosage: '0.3%', frequency: '2-3 times daily', duration: '7-10 days' },
          { name: 'Meclizine (for dizziness)', dosage: '25mg', frequency: 'As needed', duration: 'As needed' }
        ],
        notes: 'Treatment depends on underlying cause. Surgical intervention may be required for some cases.'
      }
    ]
  },
  Tympanic_Cavity: {
    partName: 'Tympanic Cavity (Middle Ear)',
    description: 'The air-filled space in the middle ear between the eardrum and the inner ear, containing the ossicles.',
    diseases: [
      {
        id: 'otitis_media',
        name: 'Otitis Media (Middle Ear Infection)',
        description: 'Infection of the middle ear space, often following upper respiratory infections.',
        symptoms: ['Ear pain', 'Fever', 'Hearing loss', 'Ear fullness', 'Discharge if perforated'],
        prescriptions: [
          'Oral antibiotics',
          'Pain management',
          'Nasal decongestants',
          'Warm compresses'
        ],
        medicines: [
          { name: 'Amoxicillin', dosage: '500mg', frequency: 'Three times daily', duration: '10 days' },
          { name: 'Amoxicillin-Clavulanate', dosage: '875mg/125mg', frequency: 'Twice daily', duration: '10 days' },
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '5-7 days' },
          { name: 'Pseudoephedrine', dosage: '30-60mg', frequency: 'Every 6 hours', duration: '5-7 days' }
        ],
        notes: 'Monitor for complications like mastoiditis. Consider tympanocentesis if severe or unresponsive.'
      },
      {
        id: 'middle_ear_effusion',
        name: 'Middle Ear Effusion',
        description: 'Fluid accumulation in the middle ear space, often following infection or Eustachian tube dysfunction.',
        symptoms: ['Hearing loss', 'Ear fullness', 'Muffled hearing', 'Sometimes asymptomatic'],
        prescriptions: [
          'Monitor for resolution',
          'Nasal decongestants',
          'Antihistamines if allergic',
          'Tympanostomy tubes if persistent'
        ],
        medicines: [
          { name: 'Pseudoephedrine', dosage: '30-60mg', frequency: 'Every 6 hours', duration: '5-7 days' },
          { name: 'Antihistamine (if allergic)', dosage: 'As prescribed', frequency: 'As prescribed', duration: 'As prescribed' }
        ],
        notes: 'Often resolves spontaneously. Consider tympanostomy tubes if persistent for 3+ months.'
      }
    ]
  }
}

