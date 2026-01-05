// Throat anatomy parts with associated diseases, symptoms, prescriptions, and medicines
import { Disease, EarPartData } from './earDiseases'

export type ThroatPartData = EarPartData

export const throatPartsData: Record<string, ThroatPartData> = {
  Pharynx: {
    partName: 'Pharynx',
    description: 'The muscular tube that connects the nasal cavity and mouth to the larynx and esophagus. It serves as a passageway for both air and food.',
    diseases: [
      {
        id: 'pharyngitis',
        name: 'Pharyngitis (Sore Throat)',
        description: 'Inflammation of the pharynx, commonly caused by viral or bacterial infections.',
        symptoms: ['Sore throat', 'Difficulty swallowing', 'Redness', 'Swelling', 'Fever', 'Hoarseness'],
        prescriptions: [
          'Gargle with warm salt water',
          'Stay hydrated',
          'Rest voice',
          'Avoid irritants (smoke, alcohol)'
        ],
        medicines: [
          { name: 'Amoxicillin', dosage: '500mg', frequency: 'Three times daily', duration: '7-10 days' },
          { name: 'Azithromycin', dosage: '500mg', frequency: 'Once daily', duration: '3-5 days' },
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '3-5 days' },
          { name: 'Acetaminophen', dosage: '500mg', frequency: 'Every 6 hours', duration: '3-5 days' }
        ],
        notes: 'Viral pharyngitis usually resolves in 5-7 days. Bacterial pharyngitis requires antibiotics.'
      },
      {
        id: 'tonsillitis',
        name: 'Tonsillitis',
        description: 'Inflammation of the tonsils, often caused by bacterial or viral infection.',
        symptoms: ['Sore throat', 'Swollen tonsils', 'Difficulty swallowing', 'Fever', 'White patches on tonsils', 'Bad breath'],
        prescriptions: [
          'Rest and hydration',
          'Gargle with salt water',
          'Soft diet',
          'Avoid irritants'
        ],
        medicines: [
          { name: 'Penicillin V', dosage: '250-500mg', frequency: 'Four times daily', duration: '10 days' },
          { name: 'Amoxicillin', dosage: '500mg', frequency: 'Three times daily', duration: '10 days' },
          { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 6-8 hours', duration: '5-7 days' }
        ],
        notes: 'Recurrent tonsillitis may require tonsillectomy. Monitor for complications like peritonsillar abscess.'
      }
    ]
  },
  Larynx: {
    partName: 'Larynx (Voice Box)',
    description: 'The organ in the neck that contains the vocal cords and is responsible for voice production and protecting the airway during swallowing.',
    diseases: [
      {
        id: 'laryngitis',
        name: 'Laryngitis',
        description: 'Inflammation of the larynx, causing hoarseness or loss of voice.',
        symptoms: ['Hoarseness', 'Loss of voice', 'Sore throat', 'Dry cough', 'Throat irritation'],
        prescriptions: [
          'Voice rest',
          'Stay hydrated',
          'Humidify air',
          'Avoid whispering'
        ],
        medicines: [
          { name: 'Dexamethasone', dosage: '4mg', frequency: 'Once daily', duration: '3-5 days' },
          { name: 'Prednisone', dosage: '20-40mg', frequency: 'Once daily', duration: '5-7 days' },
          { name: 'Guaifenesin', dosage: '200-400mg', frequency: 'Every 4 hours', duration: '5-7 days' }
        ],
        notes: 'Acute laryngitis usually resolves in 7-10 days. Chronic laryngitis requires further evaluation.'
      },
      {
        id: 'vocal_cord_polyps',
        name: 'Vocal Cord Polyps',
        description: 'Benign growths on the vocal cords, often caused by vocal abuse or trauma.',
        symptoms: ['Hoarseness', 'Voice fatigue', 'Breathiness', 'Pitch changes'],
        prescriptions: [
          'Voice therapy',
          'Voice rest',
          'Avoid vocal abuse',
          'Surgical removal if needed'
        ],
        medicines: [
          { name: 'Prednisone', dosage: '20-40mg', frequency: 'Once daily', duration: '5-7 days' }
        ],
        notes: 'May require surgical removal if conservative treatment fails. Refer to ENT specialist.'
      }
    ]
  },
  Epiglottis: {
    partName: 'Epiglottis',
    description: 'A leaf-shaped flap of cartilage that covers the larynx during swallowing to prevent food from entering the airway.',
    diseases: [
      {
        id: 'epiglottitis',
        name: 'Epiglottitis',
        description: 'Life-threatening inflammation of the epiglottis, usually caused by bacterial infection.',
        symptoms: ['Severe sore throat', 'Difficulty swallowing', 'Drooling', 'High fever', 'Stridor', 'Respiratory distress'],
        prescriptions: [
          'Immediate medical attention required',
          'Airway management',
          'Hospitalization',
          'Intravenous antibiotics'
        ],
        medicines: [
          { name: 'Ceftriaxone', dosage: '1-2g', frequency: 'Once daily (IV)', duration: '7-10 days' },
          { name: 'Vancomycin', dosage: '15-20mg/kg', frequency: 'Every 8-12 hours (IV)', duration: '7-10 days' }
        ],
        notes: 'Medical emergency! Requires immediate hospitalization and airway protection. Do not delay treatment.'
      }
    ]
  },
  Trachea: {
    partName: 'Trachea (Windpipe)',
    description: 'The tube that connects the larynx to the bronchi, allowing air to pass to and from the lungs.',
    diseases: [
      {
        id: 'tracheitis',
        name: 'Tracheitis',
        description: 'Inflammation of the trachea, often caused by bacterial or viral infection.',
        symptoms: ['Cough', 'Chest pain', 'Fever', 'Difficulty breathing', 'Hoarseness'],
        prescriptions: [
          'Rest and hydration',
          'Humidified air',
          'Avoid irritants',
          'Cough management'
        ],
        medicines: [
          { name: 'Amoxicillin-Clavulanate', dosage: '875mg/125mg', frequency: 'Twice daily', duration: '7-10 days' },
          { name: 'Azithromycin', dosage: '500mg', frequency: 'Once daily', duration: '5 days' },
          { name: 'Guaifenesin', dosage: '200-400mg', frequency: 'Every 4 hours', duration: '5-7 days' }
        ],
        notes: 'Severe cases may require hospitalization. Monitor for respiratory distress.'
      },
      {
        id: 'tracheal_stenosis',
        name: 'Tracheal Stenosis',
        description: 'Narrowing of the trachea, which can cause breathing difficulties.',
        symptoms: ['Difficulty breathing', 'Wheezing', 'Stridor', 'Chronic cough', 'Recurrent infections'],
        prescriptions: [
          'Surgical intervention',
          'Tracheal dilation',
          'Stent placement',
          'Long-term monitoring'
        ],
        medicines: [
          { name: 'Prednisone', dosage: '20-40mg', frequency: 'Once daily', duration: 'As needed' }
        ],
        notes: 'Requires ENT specialist evaluation. May need surgical correction or stenting.'
      }
    ]
  },
  Vocal_Cords: {
    partName: 'Vocal Cords',
    description: 'Two bands of muscle tissue in the larynx that vibrate to produce sound when air passes through.',
    diseases: [
      {
        id: 'vocal_cord_nodules',
        name: 'Vocal Cord Nodules',
        description: 'Small, benign growths on the vocal cords caused by vocal abuse or overuse.',
        symptoms: ['Hoarseness', 'Voice fatigue', 'Breathiness', 'Pitch breaks'],
        prescriptions: [
          'Voice therapy',
          'Voice rest',
          'Hydration',
          'Avoid vocal abuse'
        ],
        medicines: [
          { name: 'Prednisone', dosage: '20-40mg', frequency: 'Once daily', duration: '5-7 days' }
        ],
        notes: 'Usually responds to voice therapy. Surgical removal rarely needed.'
      },
      {
        id: 'vocal_cord_paralysis',
        name: 'Vocal Cord Paralysis',
        description: 'Loss of movement in one or both vocal cords, affecting voice and breathing.',
        symptoms: ['Hoarseness', 'Breathiness', 'Weak voice', 'Difficulty swallowing', 'Choking'],
        prescriptions: [
          'Voice therapy',
          'Surgical intervention',
          'Medialization thyroplasty',
          'Long-term monitoring'
        ],
        medicines: [
          { name: 'Prednisone', dosage: '20-40mg', frequency: 'Once daily', duration: 'As needed' }
        ],
        notes: 'Requires ENT specialist evaluation. May need surgical correction depending on cause.'
      }
    ]
  }
}

