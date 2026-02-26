// Lungs anatomy parts with associated diseases, symptoms, prescriptions, and medicines
// 16 parts: Left lung, Right lung, Left ventricle, Right ventricle, Right atrium, Left atrium,
// Aorta, Left pulmonary artery, Right pulmonary artery, Superior caval vein, Inferior caval vein,
// Pulmonary trunk, Right pulmonary vein, Left pulmonary vein, Trachea, Bronchi
import { EarPartData } from './earDiseases'

export type LungsPartData = EarPartData

const lungDiseases = [
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

const bronchitisDiseases = [
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

const tracheitisDiseases = [
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

export const lungsPartsData: Record<string, LungsPartData> = {
  Left_Lung: {
    partName: 'Left lung',
    description: 'Left organ for gas exchange - brings oxygen into the bloodstream and removes carbon dioxide.',
    diseases: lungDiseases
  },
  Right_Lung: {
    partName: 'Right lung',
    description: 'Right organ for gas exchange - brings oxygen into the bloodstream and removes carbon dioxide.',
    diseases: lungDiseases
  },
  Left_Ventricle: {
    partName: 'Left ventricle',
    description: 'Chamber that pumps oxygenated blood to the body via the aorta.',
    diseases: []
  },
  Right_Ventricle: {
    partName: 'Right ventricle',
    description: 'Chamber that pumps deoxygenated blood to the lungs via the pulmonary artery.',
    diseases: []
  },
  Right_Atrium: {
    partName: 'Right atrium',
    description: 'Chamber that receives deoxygenated blood from the body.',
    diseases: []
  },
  Left_Atrium: {
    partName: 'Left atrium',
    description: 'Chamber that receives oxygenated blood from the lungs.',
    diseases: []
  },
  Aorta: {
    partName: 'Aorta',
    description: 'Main artery carrying oxygenated blood from the heart to the body.',
    diseases: []
  },
  Left_Pulmonary_Artery: {
    partName: 'Left pulmonary artery',
    description: 'Carries deoxygenated blood from the heart to the left lung.',
    diseases: []
  },
  Right_Pulmonary_Artery: {
    partName: 'Right pulmonary artery',
    description: 'Carries deoxygenated blood from the heart to the right lung.',
    diseases: []
  },
  Superior_Caval_Vein: {
    partName: 'Superior caval vein',
    description: 'Large vein bringing deoxygenated blood from the upper body to the right atrium.',
    diseases: []
  },
  Inferior_Caval_Vein: {
    partName: 'Inferior caval vein',
    description: 'Large vein bringing deoxygenated blood from the lower body to the right atrium.',
    diseases: []
  },
  Pulmonary_Trunk: {
    partName: 'Pulmonary trunk',
    description: 'Main vessel that splits into the left and right pulmonary arteries.',
    diseases: []
  },
  Right_Pulmonary_Vein: {
    partName: 'Right pulmonary vein',
    description: 'Carries oxygenated blood from the right lung to the left atrium.',
    diseases: []
  },
  Left_Pulmonary_Vein: {
    partName: 'Left pulmonary vein',
    description: 'Carries oxygenated blood from the left lung to the left atrium.',
    diseases: []
  },
  Trachea: {
    partName: 'Trachea',
    description: 'The tube that connects the larynx to the bronchi, allowing air to pass to and from the lungs.',
    diseases: tracheitisDiseases
  },
  Bronchi: {
    partName: 'Bronchi',
    description: 'The main air passages that branch from the trachea into each lung.',
    diseases: bronchitisDiseases
  }
}
