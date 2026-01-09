// Nose anatomy parts with associated diseases, symptoms, prescriptions, and medicines
import { EarPartData } from './earDiseases'

export type NosePartData = EarPartData

export const nosePartsData: Record<string, NosePartData> = {
  Nostrils: {
    partName: 'Nostrils (Nasal Vestibule)',
    description: 'The external openings of the nose that allow air to enter and exit the nasal cavity.',
    diseases: [
      {
        id: 'vestibulitis',
        name: 'Nasal Vestibulitis',
        description: 'Inflammation or infection of the nasal vestibule, often caused by bacteria or irritation.',
        symptoms: ['Redness', 'Swelling', 'Crusting', 'Pain', 'Bleeding', 'Boils'],
        prescriptions: [
          'Keep area clean and dry',
          'Avoid picking nose',
          'Warm compresses',
          'Topical antibiotic ointment'
        ],
        medicines: [
          { name: 'Mupirocin Ointment', dosage: '2%', frequency: 'Apply 2-3 times daily', duration: '7-10 days' },
          { name: 'Bacitracin Ointment', dosage: 'As needed', frequency: 'Apply 2-3 times daily', duration: '7-10 days' },
          { name: 'Amoxicillin', dosage: '500mg', frequency: 'Three times daily', duration: '7-10 days' }
        ],
        notes: 'Usually resolves with topical treatment. Oral antibiotics if severe or spreading.'
      },
      {
        id: 'nasal_furuncle',
        name: 'Nasal Furuncle (Boil)',
        description: 'A painful, pus-filled bump in the nasal vestibule, usually caused by Staphylococcus infection.',
        symptoms: ['Painful bump', 'Redness', 'Swelling', 'Pus formation', 'Fever'],
        prescriptions: [
          'Warm compresses',
          'Avoid squeezing',
          'Topical antibiotics',
          'Oral antibiotics if severe'
        ],
        medicines: [
          { name: 'Mupirocin Ointment', dosage: '2%', frequency: 'Apply 2-3 times daily', duration: '7-10 days' },
          { name: 'Cephalexin', dosage: '500mg', frequency: 'Four times daily', duration: '7-10 days' },
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '3-5 days' }
        ],
        notes: 'May require incision and drainage if large. Monitor for signs of spreading infection.'
      }
    ]
  },
  Nasal_Cavity: {
    partName: 'Nasal Cavity',
    description: 'The large air-filled space behind the nose that filters, warms, and humidifies inhaled air.',
    diseases: [
      {
        id: 'rhinitis',
        name: 'Rhinitis',
        description: 'Inflammation of the nasal mucosa, causing nasal congestion, runny nose, and sneezing.',
        symptoms: ['Nasal congestion', 'Runny nose', 'Sneezing', 'Itching', 'Post-nasal drip'],
        prescriptions: [
          'Nasal saline irrigation',
          'Avoid allergens',
          'Humidify air',
          'Nasal decongestants (short-term)'
        ],
        medicines: [
          { name: 'Cetirizine', dosage: '10mg', frequency: 'Once daily', duration: 'As needed' },
          { name: 'Loratadine', dosage: '10mg', frequency: 'Once daily', duration: 'As needed' },
          { name: 'Fluticasone Nasal Spray', dosage: '50mcg', frequency: '2 sprays each nostril daily', duration: 'As needed' },
          { name: 'Oxymetazoline Nasal Spray', dosage: '0.05%', frequency: '2 sprays each nostril twice daily', duration: '3-5 days max' }
        ],
        notes: 'Allergic rhinitis is chronic. Infectious rhinitis usually resolves in 7-10 days.'
      },
      {
        id: 'nasal_polyps',
        name: 'Nasal Polyps',
        description: 'Soft, non-cancerous growths in the nasal cavity or sinuses, often associated with allergies or asthma.',
        symptoms: ['Nasal congestion', 'Loss of smell', 'Runny nose', 'Post-nasal drip', 'Facial pressure'],
        prescriptions: [
          'Nasal corticosteroid sprays',
          'Oral corticosteroids if severe',
          'Surgical removal if needed',
          'Allergy management'
        ],
        medicines: [
          { name: 'Fluticasone Nasal Spray', dosage: '50mcg', frequency: '2 sprays each nostril twice daily', duration: 'Long-term' },
          { name: 'Mometasone Nasal Spray', dosage: '50mcg', frequency: '2 sprays each nostril daily', duration: 'Long-term' },
          { name: 'Prednisone', dosage: '20-40mg', frequency: 'Once daily', duration: '5-7 days' }
        ],
        notes: 'May require surgical removal if medical treatment fails. Often recurs.'
      }
    ]
  },
  Nasal_Septum: {
    partName: 'Nasal Septum',
    description: 'The wall of cartilage and bone that divides the nasal cavity into left and right sides.',
    diseases: [
      {
        id: 'deviated_septum',
        name: 'Deviated Septum',
        description: 'A condition where the nasal septum is displaced to one side, causing nasal obstruction.',
        symptoms: ['Nasal obstruction', 'Difficulty breathing', 'Frequent sinus infections', 'Nosebleeds', 'Snoring'],
        prescriptions: [
          'Nasal decongestants',
          'Nasal steroid sprays',
          'Surgical correction (septoplasty)',
          'Allergy management'
        ],
        medicines: [
          { name: 'Fluticasone Nasal Spray', dosage: '50mcg', frequency: '2 sprays each nostril daily', duration: 'Long-term' },
          { name: 'Oxymetazoline Nasal Spray', dosage: '0.05%', frequency: '2 sprays each nostril twice daily', duration: '3-5 days max' }
        ],
        notes: 'Severe cases may require septoplasty. Conservative management for mild cases.'
      },
      {
        id: 'septal_perforation',
        name: 'Septal Perforation',
        description: 'A hole in the nasal septum, often caused by trauma, surgery, or drug use.',
        symptoms: ['Whistling sound', 'Nasal crusting', 'Bleeding', 'Nasal obstruction', 'Saddle nose deformity'],
        prescriptions: [
          'Nasal saline irrigation',
          'Nasal ointments',
          'Surgical repair',
          'Avoid irritants'
        ],
        medicines: [
          { name: 'Saline Nasal Spray', dosage: 'As needed', frequency: 'Multiple times daily', duration: 'Long-term' },
          { name: 'Bacitracin Ointment', dosage: 'As needed', frequency: 'Apply to edges daily', duration: 'Long-term' }
        ],
        notes: 'Small perforations may be asymptomatic. Large perforations may require surgical repair.'
      }
    ]
  },
  Turbinates: {
    partName: 'Turbinates (Nasal Conchae)',
    description: 'Bony structures covered with mucosa that warm, humidify, and filter air as it passes through the nose.',
    diseases: [
      {
        id: 'turbinate_hypertrophy',
        name: 'Turbinate Hypertrophy',
        description: 'Enlargement of the turbinates, causing nasal obstruction and congestion.',
        symptoms: ['Nasal obstruction', 'Congestion', 'Difficulty breathing', 'Snoring', 'Mouth breathing'],
        prescriptions: [
          'Nasal steroid sprays',
          'Nasal decongestants',
          'Surgical reduction if severe',
          'Allergy management'
        ],
        medicines: [
          { name: 'Fluticasone Nasal Spray', dosage: '50mcg', frequency: '2 sprays each nostril daily', duration: 'Long-term' },
          { name: 'Mometasone Nasal Spray', dosage: '50mcg', frequency: '2 sprays each nostril daily', duration: 'Long-term' },
          { name: 'Oxymetazoline Nasal Spray', dosage: '0.05%', frequency: '2 sprays each nostril twice daily', duration: '3-5 days max' }
        ],
        notes: 'Often associated with allergies. Surgical reduction (turbinoplasty) if medical treatment fails.'
      }
    ]
  },
  Sinuses: {
    partName: 'Sinuses (Paranasal Sinuses)',
    description: 'Air-filled spaces in the bones around the nose (frontal, maxillary, ethmoid, sphenoid) that help lighten the skull and produce mucus.',
    diseases: [
      {
        id: 'sinusitis',
        name: 'Sinusitis',
        description: 'Inflammation or infection of the sinuses, causing facial pain, congestion, and pressure.',
        symptoms: ['Facial pain', 'Nasal congestion', 'Thick nasal discharge', 'Headache', 'Fever', 'Cough'],
        prescriptions: [
          'Nasal saline irrigation',
          'Nasal decongestants',
          'Warm compresses',
          'Rest and hydration'
        ],
        medicines: [
          { name: 'Amoxicillin-Clavulanate', dosage: '875mg/125mg', frequency: 'Twice daily', duration: '10-14 days' },
          { name: 'Azithromycin', dosage: '500mg', frequency: 'Once daily', duration: '5 days' },
          { name: 'Fluticasone Nasal Spray', dosage: '50mcg', frequency: '2 sprays each nostril twice daily', duration: '10-14 days' },
          { name: 'Pseudoephedrine', dosage: '30-60mg', frequency: 'Every 6 hours', duration: '5-7 days' },
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '5-7 days' }
        ],
        notes: 'Acute sinusitis usually resolves in 10-14 days. Chronic sinusitis (>12 weeks) requires further evaluation.'
      },
      {
        id: 'chronic_sinusitis',
        name: 'Chronic Sinusitis',
        description: 'Long-term inflammation of the sinuses lasting more than 12 weeks, often associated with allergies or structural issues.',
        symptoms: ['Persistent nasal congestion', 'Facial pressure', 'Loss of smell', 'Post-nasal drip', 'Fatigue'],
        prescriptions: [
          'Long-term nasal steroid sprays',
          'Nasal saline irrigation',
          'Allergy management',
          'Surgical intervention if needed'
        ],
        medicines: [
          { name: 'Fluticasone Nasal Spray', dosage: '50mcg', frequency: '2 sprays each nostril twice daily', duration: 'Long-term' },
          { name: 'Mometasone Nasal Spray', dosage: '50mcg', frequency: '2 sprays each nostril daily', duration: 'Long-term' },
          { name: 'Prednisone', dosage: '20-40mg', frequency: 'Once daily', duration: '5-7 days (for flares)' }
        ],
        notes: 'May require functional endoscopic sinus surgery (FESS) if medical management fails.'
      }
    ]
  }
}

