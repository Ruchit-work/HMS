// Dental/Oral anatomy parts with associated diseases, symptoms, prescriptions, and medicines
import { Disease, EarPartData } from './earDiseases'

export type DentalPartData = EarPartData

export const dentalPartsData: Record<string, DentalPartData> = {
  Teeth: {
    partName: 'Teeth (Dentition)',
    description: 'Hard, calcified structures in the mouth used for biting and chewing food. Each tooth consists of enamel, dentin, pulp, and cementum.',
    diseases: [
      {
        id: 'dental_caries',
        name: 'Dental Caries (Tooth Decay)',
        description: 'Destruction of tooth structure caused by acid-producing bacteria that metabolize sugars, leading to demineralization of enamel and dentin.',
        symptoms: ['Tooth pain', 'Sensitivity to hot/cold', 'Visible holes or pits in teeth', 'Brown/black staining', 'Bad breath', 'Toothache'],
        prescriptions: [
          'Regular brushing with fluoride toothpaste',
          'Limit sugary foods and drinks',
          'Dental fillings for cavities',
          'Root canal treatment if pulp affected',
          'Fluoride treatments'
        ],
        medicines: [
          { name: 'Fluoride Toothpaste', dosage: '1450 ppm', frequency: 'Twice daily', duration: 'Long-term' },
          { name: 'Chlorhexidine Mouthwash', dosage: '0.12%', frequency: 'Twice daily', duration: '2 weeks' },
          { name: 'Amoxicillin (if infection)', dosage: '500mg', frequency: 'Three times daily', duration: '7-10 days' },
          { name: 'Ibuprofen (for pain)', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '3-5 days' }
        ],
        notes: 'Early detection prevents extensive treatment. Regular dental check-ups every 6 months recommended.'
      },
      {
        id: 'pulpitis',
        name: 'Pulpitis',
        description: 'Inflammation of the dental pulp, the innermost part of the tooth containing nerves and blood vessels.',
        symptoms: ['Severe tooth pain', 'Sensitivity to temperature', 'Spontaneous pain', 'Pain when biting', 'Swelling'],
        prescriptions: [
          'Root canal treatment',
          'Pulp capping if reversible',
          'Pain management',
          'Avoid hot/cold foods',
          'Dental extraction if severe'
        ],
        medicines: [
          { name: 'Ibuprofen', dosage: '400-600mg', frequency: 'Every 6-8 hours', duration: '5-7 days' },
          { name: 'Acetaminophen', dosage: '500-1000mg', frequency: 'Every 6 hours', duration: '5-7 days' },
          { name: 'Amoxicillin-Clavulanate', dosage: '875mg/125mg', frequency: 'Twice daily', duration: '7-10 days' },
          { name: 'Clindamycin (if penicillin allergic)', dosage: '300mg', frequency: 'Four times daily', duration: '7-10 days' }
        ],
        notes: 'Irreversible pulpitis requires root canal treatment or extraction. Early treatment prevents abscess formation.'
      },
      {
        id: 'tooth_abscess',
        name: 'Dental Abscess',
        description: 'Collection of pus caused by bacterial infection in the tooth or surrounding tissues.',
        symptoms: ['Severe throbbing pain', 'Swelling of face/jaw', 'Fever', 'Sensitivity to pressure', 'Bad taste in mouth', 'Difficulty swallowing'],
        prescriptions: [
          'Drainage of abscess',
          'Root canal treatment or extraction',
          'Antibiotic therapy',
          'Warm salt water rinses',
          'Pain management'
        ],
        medicines: [
          { name: 'Amoxicillin-Clavulanate', dosage: '875mg/125mg', frequency: 'Twice daily', duration: '7-10 days' },
          { name: 'Metronidazole', dosage: '400mg', frequency: 'Three times daily', duration: '7-10 days' },
          { name: 'Clindamycin', dosage: '300mg', frequency: 'Four times daily', duration: '7-10 days' },
          { name: 'Ibuprofen', dosage: '400-600mg', frequency: 'Every 6-8 hours', duration: '5-7 days' },
          { name: 'Acetaminophen', dosage: '500-1000mg', frequency: 'Every 6 hours', duration: '5-7 days' }
        ],
        notes: 'Medical emergency if swelling affects breathing. Immediate dental treatment required. May need incision and drainage.'
      },
      {
        id: 'tooth_sensitivity',
        name: 'Dentin Hypersensitivity',
        description: 'Pain or discomfort in teeth when exposed to hot, cold, sweet, or acidic stimuli, often due to exposed dentin.',
        symptoms: ['Sharp pain with temperature changes', 'Pain with sweet/sour foods', 'Pain when brushing', 'Exposed tooth roots'],
        prescriptions: [
          'Desensitizing toothpaste',
          'Fluoride treatments',
          'Avoid acidic foods',
          'Soft-bristled toothbrush',
          'Dental bonding or sealants'
        ],
        medicines: [
          { name: 'Potassium Nitrate Toothpaste', dosage: '5%', frequency: 'Twice daily', duration: '4-8 weeks' },
          { name: 'Stannous Fluoride Gel', dosage: '0.4%', frequency: 'Daily application', duration: '4-6 weeks' },
          { name: 'Fluoride Varnish', dosage: '5%', frequency: 'Professional application every 3-6 months', duration: 'Long-term' }
        ],
        notes: 'Usually responds well to desensitizing agents. If persistent, may indicate underlying dental issues requiring treatment.'
      },
      {
        id: 'tooth_erosion',
        name: 'Dental Erosion',
        description: 'Loss of tooth structure due to chemical dissolution by acids, not caused by bacteria.',
        symptoms: ['Tooth sensitivity', 'Discoloration', 'Rounded teeth', 'Transparent edges', 'Cracks or chips'],
        prescriptions: [
          'Reduce acidic food/drink consumption',
          'Use straw for acidic beverages',
          'Rinse with water after acidic foods',
          'Fluoride treatments',
          'Dental restorations if needed'
        ],
        medicines: [
          { name: 'High-Fluoride Toothpaste', dosage: '5000 ppm', frequency: 'Twice daily', duration: 'Long-term' },
          { name: 'Calcium Phosphate Paste', dosage: 'As prescribed', frequency: 'Daily', duration: '4-8 weeks' },
          { name: 'Fluoride Mouthwash', dosage: '0.05%', frequency: 'Daily', duration: 'Long-term' }
        ],
        notes: 'Prevention is key. Identify and eliminate acid sources. May require extensive restorations if severe.'
      }
    ]
  },
  Gums: {
    partName: 'Gums (Gingiva)',
    description: 'The soft tissue that surrounds and supports the teeth, protecting the underlying bone and tooth roots.',
    diseases: [
      {
        id: 'gingivitis',
        name: 'Gingivitis',
        description: 'Inflammation of the gums caused by bacterial plaque accumulation, characterized by redness, swelling, and bleeding.',
        symptoms: ['Bleeding gums', 'Red/swollen gums', 'Bad breath', 'Tender gums', 'Gum recession'],
        prescriptions: [
          'Improved oral hygiene',
          'Professional dental cleaning',
          'Regular flossing',
          'Antimicrobial mouthwash',
          'Regular dental check-ups'
        ],
        medicines: [
          { name: 'Chlorhexidine Mouthwash', dosage: '0.12%', frequency: 'Twice daily', duration: '2-4 weeks' },
          { name: 'Fluoride Toothpaste', dosage: '1450 ppm', frequency: 'Twice daily', duration: 'Long-term' },
          { name: 'Metronidazole Gel (topical)', dosage: '0.75%', frequency: 'Twice daily', duration: '7-10 days' }
        ],
        notes: 'Reversible with proper oral hygiene. If left untreated, can progress to periodontitis.'
      },
      {
        id: 'periodontitis',
        name: 'Periodontitis',
        description: 'Advanced gum disease causing destruction of supporting structures around teeth, including bone loss.',
        symptoms: ['Persistent bad breath', 'Receding gums', 'Loose teeth', 'Gum pockets', 'Bone loss', 'Tooth loss'],
        prescriptions: [
          'Scaling and root planing',
          'Periodontal surgery if advanced',
          'Antibiotic therapy',
          'Improved oral hygiene',
          'Regular maintenance'
        ],
        medicines: [
          { name: 'Doxycycline', dosage: '100mg', frequency: 'Twice daily', duration: '14-21 days' },
          { name: 'Metronidazole', dosage: '400mg', frequency: 'Three times daily', duration: '7-10 days' },
          { name: 'Amoxicillin', dosage: '500mg', frequency: 'Three times daily', duration: '7-10 days' },
          { name: 'Chlorhexidine Mouthwash', dosage: '0.12%', frequency: 'Twice daily', duration: '2-4 weeks' }
        ],
        notes: 'Requires professional treatment. Early intervention prevents tooth loss. Regular maintenance essential.'
      },
      {
        id: 'gum_abscess',
        name: 'Periodontal Abscess',
        description: 'Localized collection of pus in the periodontal tissues, usually caused by bacterial infection.',
        symptoms: ['Severe gum pain', 'Swelling', 'Pus discharge', 'Fever', 'Bad taste', 'Tooth mobility'],
        prescriptions: [
          'Drainage of abscess',
          'Scaling and root planing',
          'Antibiotic therapy',
          'Warm salt water rinses',
          'Pain management'
        ],
        medicines: [
          { name: 'Amoxicillin-Clavulanate', dosage: '875mg/125mg', frequency: 'Twice daily', duration: '7-10 days' },
          { name: 'Metronidazole', dosage: '400mg', frequency: 'Three times daily', duration: '7-10 days' },
          { name: 'Ibuprofen', dosage: '400-600mg', frequency: 'Every 6-8 hours', duration: '5-7 days' }
        ],
        notes: 'Requires immediate drainage and antibiotic treatment. May need periodontal surgery if recurrent.'
      },
      {
        id: 'gum_recession',
        name: 'Gingival Recession',
        description: 'Exposure of tooth roots due to loss of gum tissue, often caused by aggressive brushing or periodontal disease.',
        symptoms: ['Exposed tooth roots', 'Tooth sensitivity', 'Longer appearing teeth', 'Root decay risk'],
        prescriptions: [
          'Gentle brushing technique',
          'Soft-bristled toothbrush',
          'Gum grafting surgery',
          'Desensitizing toothpaste',
          'Regular monitoring'
        ],
        medicines: [
          { name: 'Desensitizing Toothpaste', dosage: '5% potassium nitrate', frequency: 'Twice daily', duration: '4-8 weeks' },
          { name: 'Fluoride Gel', dosage: '1.1%', frequency: 'Daily application', duration: 'Long-term' }
        ],
        notes: 'Prevent further recession with proper technique. Surgical correction may be needed for aesthetic or functional reasons.'
      }
    ]
  },
  Tongue: {
    partName: 'Tongue',
    description: 'A muscular organ in the mouth responsible for taste, speech, swallowing, and oral hygiene.',
    diseases: [
      {
        id: 'oral_thrush',
        name: 'Oral Candidiasis (Oral Thrush)',
        description: 'Fungal infection of the mouth caused by Candida albicans, characterized by white patches on tongue and oral mucosa.',
        symptoms: ['White patches on tongue', 'Redness', 'Burning sensation', 'Loss of taste', 'Difficulty swallowing', 'Cracking at corners of mouth'],
        prescriptions: [
          'Antifungal medication',
          'Good oral hygiene',
          'Rinse mouth after using inhalers',
          'Clean dentures properly',
          'Avoid smoking'
        ],
        medicines: [
          { name: 'Nystatin Oral Suspension', dosage: '100,000 units/ml', frequency: '4 times daily', duration: '7-14 days' },
          { name: 'Fluconazole', dosage: '150mg', frequency: 'Once daily', duration: '7-14 days' },
          { name: 'Clotrimazole Lozenges', dosage: '10mg', frequency: '5 times daily', duration: '7-14 days' },
          { name: 'Miconazole Oral Gel', dosage: '20mg/g', frequency: '4 times daily', duration: '7-14 days' }
        ],
        notes: 'Common in immunocompromised patients, infants, and denture wearers. Treat underlying conditions if present.'
      },
      {
        id: 'geographic_tongue',
        name: 'Geographic Tongue (Benign Migratory Glossitis)',
        description: 'Harmless condition causing map-like patches on the tongue surface due to loss of papillae.',
        symptoms: ['Smooth red patches', 'Irregular borders', 'Mild burning sensation', 'Pattern changes over time'],
        prescriptions: [
          'Usually no treatment needed',
          'Avoid irritating foods',
          'Topical anesthetics if symptomatic',
          'Good oral hygiene',
          'Monitor for changes'
        ],
        medicines: [
          { name: 'Benzocaine Gel (topical)', dosage: '20%', frequency: 'As needed', duration: 'Short-term' },
          { name: 'Antihistamine (if allergic component)', dosage: 'As prescribed', frequency: 'As prescribed', duration: 'As needed' }
        ],
        notes: 'Benign condition, usually asymptomatic. No treatment required unless causing discomfort.'
      },
      {
        id: 'tongue_tie',
        name: 'Ankyloglossia (Tongue Tie)',
        description: 'Condition where the lingual frenulum is too short or tight, restricting tongue movement.',
        symptoms: ['Difficulty lifting tongue', 'Speech difficulties', 'Breastfeeding problems', 'Gap between front teeth'],
        prescriptions: [
          'Frenectomy (surgical release)',
          'Speech therapy if needed',
          'Tongue exercises',
          'Monitor feeding in infants'
        ],
        medicines: [
          { name: 'Ibuprofen (post-surgery)', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '3-5 days' },
          { name: 'Acetaminophen', dosage: '500mg', frequency: 'Every 6 hours', duration: '3-5 days' }
        ],
        notes: 'Surgical intervention (frenectomy) is the primary treatment. Early treatment in infants improves outcomes.'
      },
      {
        id: 'hairy_tongue',
        name: 'Hairy Tongue',
        description: 'Benign condition where tongue papillae become elongated, giving a hairy appearance, often due to poor oral hygiene or tobacco use.',
        symptoms: ['Elongated papillae', 'Discoloration (black, brown, white)', 'Bad breath', 'Altered taste'],
        prescriptions: [
          'Improve oral hygiene',
          'Tongue scraping/brushing',
          'Discontinue tobacco use',
          'Antifungal if secondary infection',
          'Good hydration'
        ],
        medicines: [
          { name: 'Antifungal (if secondary infection)', dosage: 'As prescribed', frequency: 'As prescribed', duration: '7-14 days' }
        ],
        notes: 'Usually resolves with improved oral hygiene. Tongue scraping helps remove debris and bacteria.'
      }
    ]
  },
  Mandible: {
    partName: 'Mandible (Lower Jaw)',
    description: 'The largest and strongest bone of the face, forming the lower jaw and supporting the lower teeth.',
    diseases: [
      {
        id: 'tmj_disorder',
        name: 'Temporomandibular Joint (TMJ) Disorder',
        description: 'Disorders affecting the jaw joint and surrounding muscles, causing pain and dysfunction.',
        symptoms: ['Jaw pain', 'Clicking/popping sounds', 'Difficulty opening mouth', 'Headaches', 'Ear pain', 'Locked jaw'],
        prescriptions: [
          'Jaw rest',
          'Soft diet',
          'Heat/cold therapy',
          'Physical therapy',
          'Stress management',
          'Mouth guard if bruxism'
        ],
        medicines: [
          { name: 'Ibuprofen', dosage: '400-600mg', frequency: 'Every 6-8 hours', duration: '7-10 days' },
          { name: 'Naproxen', dosage: '500mg', frequency: 'Twice daily', duration: '7-10 days' },
          { name: 'Muscle Relaxants (Cyclobenzaprine)', dosage: '5-10mg', frequency: 'At bedtime', duration: '7-14 days' },
          { name: 'Amitriptyline (for chronic pain)', dosage: '10-25mg', frequency: 'At bedtime', duration: '4-8 weeks' }
        ],
        notes: 'Most cases resolve with conservative treatment. Surgery reserved for severe cases. Address underlying causes like stress or bruxism.'
      },
      {
        id: 'jaw_fracture',
        name: 'Mandibular Fracture',
        description: 'Break in the mandible bone, usually caused by trauma, falls, or accidents.',
        symptoms: ['Severe jaw pain', 'Swelling', 'Bruising', 'Difficulty opening mouth', 'Malocclusion', 'Numbness'],
        prescriptions: [
          'Surgical fixation',
          'Jaw wiring if needed',
          'Soft diet',
          'Pain management',
          'Antibiotics if open fracture',
          'Follow-up imaging'
        ],
        medicines: [
          { name: 'Amoxicillin-Clavulanate', dosage: '875mg/125mg', frequency: 'Twice daily', duration: '7-10 days' },
          { name: 'Ibuprofen', dosage: '400-600mg', frequency: 'Every 6-8 hours', duration: '7-14 days' },
          { name: 'Acetaminophen', dosage: '500-1000mg', frequency: 'Every 6 hours', duration: '7-14 days' },
          { name: 'Opioid analgesics (if severe)', dosage: 'As prescribed', frequency: 'As prescribed', duration: 'Short-term' }
        ],
        notes: 'Requires immediate medical attention. Surgical intervention usually necessary. Monitor for complications.'
      },
      {
        id: 'osteomyelitis_jaw',
        name: 'Osteomyelitis of the Jaw',
        description: 'Bone infection of the mandible, often following dental procedures, trauma, or spread from dental infections.',
        symptoms: ['Severe jaw pain', 'Swelling', 'Fever', 'Trismus (lockjaw)', 'Drainage', 'Bone exposure'],
        prescriptions: [
          'Long-term antibiotic therapy',
          'Surgical debridement',
          'Hyperbaric oxygen therapy',
          'Pain management',
          'Nutritional support'
        ],
        medicines: [
          { name: 'Clindamycin', dosage: '600mg', frequency: 'Every 8 hours (IV)', duration: '4-6 weeks' },
          { name: 'Penicillin G', dosage: '2-4 million units', frequency: 'Every 4-6 hours (IV)', duration: '4-6 weeks' },
          { name: 'Metronidazole', dosage: '500mg', frequency: 'Three times daily', duration: '4-6 weeks' },
          { name: 'Ibuprofen', dosage: '400-600mg', frequency: 'Every 6-8 hours', duration: 'As needed' }
        ],
        notes: 'Serious condition requiring aggressive treatment. Long-term antibiotics essential. May require surgical intervention.'
      }
    ]
  },
  Oral_Mucosa: {
    partName: 'Oral Mucosa',
    description: 'The mucous membrane lining the inside of the mouth, including cheeks, lips, floor of mouth, and palate.',
    diseases: [
      {
        id: 'oral_ulcers',
        name: 'Aphthous Ulcers (Canker Sores)',
        description: 'Painful, recurring ulcers in the mouth, typically on non-keratinized mucosa.',
        symptoms: ['Painful round ulcers', 'White/yellow center', 'Red border', 'Difficulty eating', 'Burning sensation'],
        prescriptions: [
          'Topical anesthetics',
          'Corticosteroid ointments',
          'Avoid spicy/acidic foods',
          'Good oral hygiene',
          'Stress reduction'
        ],
        medicines: [
          { name: 'Triamcinolone Acetonide Paste', dosage: '0.1%', frequency: '3-4 times daily', duration: '5-7 days' },
          { name: 'Benzocaine Gel', dosage: '20%', frequency: 'As needed for pain', duration: 'Short-term' },
          { name: 'Chlorhexidine Mouthwash', dosage: '0.12%', frequency: 'Twice daily', duration: '7-10 days' },
          { name: 'Amlexanox Paste', dosage: '5%', frequency: '4 times daily', duration: '5-7 days' }
        ],
        notes: 'Usually self-limiting (7-14 days). Recurrent cases may need systemic treatment. Rule out other causes.'
      },
      {
        id: 'oral_lichen_planus',
        name: 'Oral Lichen Planus',
        description: 'Chronic inflammatory condition affecting oral mucosa, characterized by white lacy patterns or red, swollen tissues.',
        symptoms: ['White lacy patterns', 'Red, swollen areas', 'Burning sensation', 'Ulcers', 'Pain with spicy foods'],
        prescriptions: [
          'Topical corticosteroids',
          'Avoid triggers (stress, certain foods)',
          'Good oral hygiene',
          'Regular monitoring',
          'Biopsy if suspicious'
        ],
        medicines: [
          { name: 'Clobetasol Propionate Gel', dosage: '0.05%', frequency: '2-3 times daily', duration: '2-4 weeks' },
          { name: 'Triamcinolone Acetonide Paste', dosage: '0.1%', frequency: '3-4 times daily', duration: '2-4 weeks' },
          { name: 'Prednisone (if severe)', dosage: '20-40mg', frequency: 'Once daily', duration: '2-4 weeks (tapering)' },
          { name: 'Tacrolimus Ointment', dosage: '0.1%', frequency: 'Twice daily', duration: '4-8 weeks' }
        ],
        notes: 'Chronic condition requiring long-term management. Regular follow-up needed. Monitor for malignant transformation.'
      },
      {
        id: 'leukoplakia',
        name: 'Oral Leukoplakia',
        description: 'White patches on oral mucosa that cannot be scraped off, potentially precancerous.',
        symptoms: ['White patches', 'Cannot be scraped off', 'Thickened areas', 'Usually asymptomatic'],
        prescriptions: [
          'Biopsy for diagnosis',
          'Remove irritants (tobacco, alcohol)',
          'Surgical removal if needed',
          'Regular monitoring',
          'Follow-up examinations'
        ],
        medicines: [
          { name: 'Topical Retinoids (if indicated)', dosage: 'As prescribed', frequency: 'As prescribed', duration: 'As prescribed' }
        ],
        notes: 'Potentially precancerous. Requires biopsy and regular monitoring. Remove all irritants. Surgical excision may be needed.'
      },
      {
        id: 'oral_cancer',
        name: 'Oral Squamous Cell Carcinoma',
        description: 'Malignant tumor of oral tissues, most commonly affecting tongue, floor of mouth, and lips.',
        symptoms: ['Non-healing ulcer', 'Red or white patches', 'Lump or thickening', 'Difficulty swallowing', 'Persistent pain', 'Loose teeth'],
        prescriptions: [
          'Surgical resection',
          'Radiation therapy',
          'Chemotherapy',
          'Rehabilitation',
          'Regular follow-up',
          'Supportive care'
        ],
        medicines: [
          { name: 'Chemotherapy agents (as per protocol)', dosage: 'As prescribed', frequency: 'As per protocol', duration: 'As per protocol' },
          { name: 'Pain management (opioids)', dosage: 'As prescribed', frequency: 'As prescribed', duration: 'As needed' },
          { name: 'Antibiotics (if infection)', dosage: 'As prescribed', frequency: 'As prescribed', duration: 'As prescribed' }
        ],
        notes: 'Early detection crucial for better prognosis. Requires multidisciplinary approach. Regular dental check-ups help with early detection.'
      }
    ]
  },
  Salivary_Glands: {
    partName: 'Salivary Glands',
    description: 'Glands that produce saliva, including parotid, submandibular, and sublingual glands, essential for digestion and oral health.',
    diseases: [
      {
        id: 'sialadenitis',
        name: 'Sialadenitis (Salivary Gland Infection)',
        description: 'Inflammation or infection of salivary glands, often caused by bacterial or viral infection, or obstruction.',
        symptoms: ['Swollen, painful gland', 'Fever', 'Pus discharge', 'Dry mouth', 'Difficulty opening mouth', 'Redness over gland'],
        prescriptions: [
          'Antibiotic therapy',
          'Warm compresses',
          'Massage of gland',
          'Hydration',
          'Sialagogues (sour candies)',
          'Surgical drainage if abscess'
        ],
        medicines: [
          { name: 'Amoxicillin-Clavulanate', dosage: '875mg/125mg', frequency: 'Twice daily', duration: '10-14 days' },
          { name: 'Clindamycin', dosage: '300mg', frequency: 'Four times daily', duration: '10-14 days' },
          { name: 'Ibuprofen', dosage: '400-600mg', frequency: 'Every 6-8 hours', duration: '5-7 days' }
        ],
        notes: 'Most common in parotid gland. Recurrent cases may indicate underlying issues. Maintain good hydration.'
      },
      {
        id: 'sialolithiasis',
        name: 'Sialolithiasis (Salivary Stones)',
        description: 'Formation of calcified stones in salivary ducts, causing obstruction and swelling.',
        symptoms: ['Painful swelling', 'Swelling during meals', 'Dry mouth', 'Infection if blocked', 'Difficulty eating'],
        prescriptions: [
          'Sialagogues to promote flow',
          'Massage of gland',
          'Warm compresses',
          'Surgical removal of stone',
          'Sialendoscopy',
          'Gland removal if recurrent'
        ],
        medicines: [
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '3-5 days' },
          { name: 'Antibiotics (if infected)', dosage: 'As prescribed', frequency: 'As prescribed', duration: '7-10 days' }
        ],
        notes: 'Most common in submandibular gland. Small stones may pass spontaneously. Large stones require surgical removal.'
      },
      {
        id: 'sjogrens_syndrome',
        name: 'Sjögren\'s Syndrome',
        description: 'Autoimmune disorder causing dry mouth and dry eyes due to destruction of salivary and lacrimal glands.',
        symptoms: ['Dry mouth (xerostomia)', 'Dry eyes', 'Difficulty swallowing', 'Increased dental caries', 'Oral infections', 'Joint pain'],
        prescriptions: [
          'Artificial saliva',
          'Frequent water intake',
          'Sugar-free candies/gum',
          'Fluoride treatments',
          'Regular dental care',
          'Immunosuppressive therapy'
        ],
        medicines: [
          { name: 'Pilocarpine', dosage: '5mg', frequency: 'Four times daily', duration: 'Long-term' },
          { name: 'Cevimeline', dosage: '30mg', frequency: 'Three times daily', duration: 'Long-term' },
          { name: 'Hydroxychloroquine', dosage: '200-400mg', frequency: 'Once daily', duration: 'Long-term' },
          { name: 'Artificial Saliva', dosage: 'As needed', frequency: 'As needed', duration: 'Long-term' }
        ],
        notes: 'Chronic autoimmune condition. Requires multidisciplinary care. High risk of dental caries due to dry mouth.'
      }
    ]
  },
  Wisdom_Teeth: {
    partName: 'Wisdom Teeth (Third Molars)',
    description: 'The last molars to erupt, typically appearing in late teens or early twenties, often causing problems due to lack of space.',
    diseases: [
      {
        id: 'impacted_wisdom_teeth',
        name: 'Impacted Wisdom Teeth',
        description: 'Wisdom teeth that fail to erupt fully due to lack of space or abnormal positioning.',
        symptoms: ['Pain', 'Swelling', 'Difficulty opening mouth', 'Bad breath', 'Gum infection', 'Crowding of other teeth'],
        prescriptions: [
          'Surgical extraction',
          'Antibiotics if infected',
          'Pain management',
          'Warm salt water rinses',
          'Soft diet post-surgery'
        ],
        medicines: [
          { name: 'Amoxicillin', dosage: '500mg', frequency: 'Three times daily', duration: '5-7 days' },
          { name: 'Metronidazole', dosage: '400mg', frequency: 'Three times daily', duration: '5-7 days' },
          { name: 'Ibuprofen', dosage: '400-600mg', frequency: 'Every 6-8 hours', duration: '5-7 days' },
          { name: 'Acetaminophen', dosage: '500-1000mg', frequency: 'Every 6 hours', duration: '5-7 days' }
        ],
        notes: 'Extraction recommended if causing problems or at risk of complications. Best done in late teens/early twenties.'
      },
      {
        id: 'pericoronitis',
        name: 'Pericoronitis',
        description: 'Inflammation of the gum tissue surrounding a partially erupted wisdom tooth.',
        symptoms: ['Pain around wisdom tooth', 'Swelling', 'Difficulty opening mouth', 'Bad taste', 'Fever', 'Swollen lymph nodes'],
        prescriptions: [
          'Antibiotic therapy',
          'Warm salt water rinses',
          'Irrigation under gum flap',
          'Extraction if recurrent',
          'Pain management'
        ],
        medicines: [
          { name: 'Amoxicillin', dosage: '500mg', frequency: 'Three times daily', duration: '7-10 days' },
          { name: 'Metronidazole', dosage: '400mg', frequency: 'Three times daily', duration: '7-10 days' },
          { name: 'Chlorhexidine Mouthwash', dosage: '0.12%', frequency: 'Twice daily', duration: '7-10 days' },
          { name: 'Ibuprofen', dosage: '400-600mg', frequency: 'Every 6-8 hours', duration: '5-7 days' }
        ],
        notes: 'Common with partially erupted wisdom teeth. Extraction usually recommended after acute episode resolves.'
      }
    ]
  },
  Palate: {
    partName: 'Palate (Roof of Mouth)',
    description: 'The roof of the mouth, consisting of the hard palate (anterior) and soft palate (posterior), separating oral and nasal cavities.',
    diseases: [
      {
        id: 'cleft_palate',
        name: 'Cleft Palate',
        description: 'Congenital defect where the palate fails to fuse during development, creating an opening between mouth and nose.',
        symptoms: ['Opening in palate', 'Feeding difficulties', 'Speech problems', 'Ear infections', 'Dental problems'],
        prescriptions: [
          'Surgical repair',
          'Speech therapy',
          'Dental/orthodontic care',
          'Ear tube placement',
          'Nutritional support',
          'Long-term follow-up'
        ],
        medicines: [
          { name: 'Antibiotics (prophylactic)', dosage: 'As prescribed', frequency: 'As prescribed', duration: 'As prescribed' },
          { name: 'Pain management (post-surgery)', dosage: 'As prescribed', frequency: 'As prescribed', duration: 'As prescribed' }
        ],
        notes: 'Requires surgical repair, usually in first year of life. Multidisciplinary team approach essential. Long-term care needed.'
      },
      {
        id: 'palatal_torus',
        name: 'Palatal Torus',
        description: 'Benign bony growth on the hard palate, usually asymptomatic.',
        symptoms: ['Bony protrusion', 'Usually asymptomatic', 'May interfere with dentures', 'Rarely painful'],
        prescriptions: [
          'Usually no treatment',
          'Surgical removal if interferes with dentures',
          'Monitor for changes',
          'Protect from trauma'
        ],
        medicines: [],
        notes: 'Benign condition, usually requires no treatment. Surgical removal only if causing functional problems.'
      }
    ]
  }
}


