// Kidney anatomy parts with associated diseases, symptoms, prescriptions, and medicines
import { EarPartData } from './earDiseases'

export type KidneyPartData = EarPartData

export const kidneyPartsData: Record<string, KidneyPartData> = {
  Kidney: {
    partName: 'Kidney',
    description: 'Paired bean-shaped organs that filter blood, remove waste, and regulate fluid balance.',
    diseases: [
      {
        id: 'ckd',
        name: 'Chronic Kidney Disease',
        description: 'Progressive loss of kidney function over time, often caused by diabetes or hypertension.',
        symptoms: ['Fatigue', 'Swelling', 'Nausea', 'Changes in urination'],
        prescriptions: ['Blood pressure control', 'Blood sugar management', 'Low-protein diet'],
        medicines: [
          { name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily', duration: 'Long-term' },
          { name: 'Atenolol', dosage: '50mg', frequency: 'Once daily', duration: 'Long-term' }
        ],
        notes: 'Regular monitoring of kidney function. Nephrology referral if GFR declining.'
      }
    ]
  },
  Renal_Pelvis: {
    partName: 'Renal Pelvis',
    description: 'Funnel-shaped structure in the kidney that collects urine before it flows to the ureter.',
    diseases: [
      {
        id: 'kidney_stones',
        name: 'Kidney Stones',
        description: 'Hard deposits of minerals and salts that form in the kidneys.',
        symptoms: ['Severe flank pain', 'Blood in urine', 'Nausea', 'Frequent urination'],
        prescriptions: ['Increased fluid intake', 'Pain management', 'Strain urine for stones'],
        medicines: [
          { name: 'Ketorolac', dosage: '10mg', frequency: 'Every 6 hours', duration: '3-5 days' },
          { name: 'Tamsulosin', dosage: '0.4mg', frequency: 'Once daily', duration: '2-4 weeks' }
        ],
        notes: 'Stone analysis recommended. Urology referral for larger stones.'
      }
    ]
  },
  Ureter: {
    partName: 'Ureter',
    description: 'Tubes that carry urine from the kidneys to the bladder.',
    diseases: [
      {
        id: 'ureteral_stones',
        name: 'Ureteral Stones',
        description: 'Kidney stones that have passed into the ureter, causing obstruction and pain.',
        symptoms: ['Colicky flank pain', 'Blood in urine', 'Nausea', 'Urgency'],
        prescriptions: ['Hydration', 'Pain control', 'Follow-up imaging'],
        medicines: [
          { name: 'Naproxen', dosage: '500mg', frequency: 'Twice daily', duration: '5-7 days' },
          { name: 'Oxybutynin', dosage: '5mg', frequency: 'Twice daily', duration: 'As needed' }
        ],
        notes: 'Refer to urology for stones > 5mm or persistent obstruction.'
      }
    ]
  },
  Cortex: {
    partName: 'Renal Cortex',
    description: 'Outer region of the kidney containing glomeruli and convoluted tubules.',
    diseases: [
      {
        id: 'glomerulonephritis',
        name: 'Glomerulonephritis',
        description: 'Inflammation of the glomeruli affecting kidney filtration.',
        symptoms: ['Blood in urine', 'Foamy urine', 'Swelling', 'Hypertension'],
        prescriptions: ['Blood pressure control', 'Fluid restriction', 'Low sodium diet'],
        medicines: [
          { name: 'Prednisone', dosage: '1mg/kg', frequency: 'Once daily', duration: '4-8 weeks' },
          { name: 'Lisinopril', dosage: '10mg', frequency: 'Once daily', duration: 'Long-term' }
        ],
        notes: 'Nephrology referral for biopsy and management.'
      }
    ]
  },
  Medulla: {
    partName: 'Renal Medulla',
    description: 'Inner region of the kidney containing loops of Henle and collecting ducts.',
    diseases: [
      {
        id: 'pyelonephritis',
        name: 'Pyelonephritis',
        description: 'Bacterial infection of the kidney, often ascending from the bladder.',
        symptoms: ['Fever', 'Flank pain', 'Nausea', 'Dysuria'],
        prescriptions: ['Antibiotics', 'Hydration', 'Rest'],
        medicines: [
          { name: 'Ciprofloxacin', dosage: '500mg', frequency: 'Twice daily', duration: '7-14 days' },
          { name: 'Trimethoprim-Sulfamethoxazole', dosage: '160/800mg', frequency: 'Twice daily', duration: '14 days' }
        ],
        notes: 'Consider hospitalization for severe cases or immunocompromised patients.'
      }
    ]
  }
}
