// Lungs anatomy parts with associated diseases, symptoms, prescriptions, and medicines
import { EarPartData } from './earDiseases'

export type LungsPartData = EarPartData

export const lungsPartsData: Record<string, LungsPartData> = {
  Trachea: {
    partName: 'Trachea (Windpipe)',
    description: 'The tube that connects the larynx to the bronchi, allowing air to pass to and from the lungs.',
    diseases: [
      {
        id: 'tracheitis',
        name: 'Tracheitis',
        description: 'Inflammation of the trachea, often caused by bacterial or viral infection.',
        symptoms: ['Cough', 'Fever', 'Difficulty breathing', 'Stridor'],
        prescriptions: ['Humidified air', 'Rest', 'Antibiotics if bacterial'],
        medicines: [
          { name: 'Amoxicillin-Clavulanate', dosage: '875mg/125mg', frequency: 'Twice daily', duration: '7-10 days' },
          { name: 'Dexamethasone', dosage: '0.6mg/kg', frequency: 'Single dose', duration: '1 day' }
        ],
        notes: 'Bacterial tracheitis is a medical emergency. Monitor airway.'
      }
    ]
  },
  Bronchi: {
    partName: 'Bronchi',
    description: 'The main air passages that branch from the trachea into each lung.',
    diseases: [
      {
        id: 'bronchitis',
        name: 'Bronchitis',
        description: 'Inflammation of the bronchi causing coughing and mucus production.',
        symptoms: ['Cough', 'Mucus production', 'Wheezing', 'Shortness of breath'],
        prescriptions: ['Rest', 'Hydration', 'Avoid irritants'],
        medicines: [
          { name: 'Albuterol Inhaler', dosage: '2 puffs', frequency: 'Every 4-6 hours', duration: 'As needed' },
          { name: 'Azithromycin', dosage: '500mg', frequency: 'Once daily', duration: '5 days' }
        ],
        notes: 'Acute bronchitis usually resolves in 2-3 weeks.'
      }
    ]
  },
  Lungs: {
    partName: 'Lungs',
    description: 'Paired organs responsible for gas exchange - bringing oxygen into the bloodstream and removing carbon dioxide.',
    diseases: [
      {
        id: 'pneumonia',
        name: 'Pneumonia',
        description: 'Infection that inflames air sacs in one or both lungs.',
        symptoms: ['Cough', 'Fever', 'Difficulty breathing', 'Chest pain'],
        prescriptions: ['Rest', 'Hydration', 'Oxygen if needed'],
        medicines: [
          { name: 'Amoxicillin', dosage: '500mg', frequency: 'Three times daily', duration: '7-10 days' },
          { name: 'Azithromycin', dosage: '500mg', frequency: 'Once daily', duration: '5 days' }
        ],
        notes: 'Severity varies. Hospitalization may be needed for severe cases.'
      },
      {
        id: 'copd',
        name: 'COPD',
        description: 'Chronic obstructive pulmonary disease - progressive lung disease causing breathing difficulty.',
        symptoms: ['Chronic cough', 'Shortness of breath', 'Wheezing', 'Mucus production'],
        prescriptions: ['Smoking cessation', 'Pulmonary rehabilitation', 'Oxygen therapy'],
        medicines: [
          { name: 'Albuterol Inhaler', dosage: '2 puffs', frequency: 'Every 4-6 hours', duration: 'Long-term' },
          { name: 'Tiotropium', dosage: '18mcg', frequency: 'Once daily', duration: 'Long-term' }
        ],
        notes: 'Management focuses on symptom control and preventing exacerbations.'
      }
    ]
  },
  Heart: {
    partName: 'Heart',
    description: 'The muscular organ that pumps blood through the circulatory system.',
    diseases: [
      {
        id: 'heart_failure',
        name: 'Heart Failure',
        description: 'Condition where the heart cannot pump enough blood to meet body needs.',
        symptoms: ['Shortness of breath', 'Fatigue', 'Swelling', 'Rapid heartbeat'],
        prescriptions: ['Low sodium diet', 'Fluid restriction', 'Regular exercise'],
        medicines: [
          { name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily', duration: 'Long-term' },
          { name: 'Metoprolol', dosage: '25mg', frequency: 'Twice daily', duration: 'Long-term' }
        ],
        notes: 'Requires cardiology follow-up.'
      }
    ]
  }
}
