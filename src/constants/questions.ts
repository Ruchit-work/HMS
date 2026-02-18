export type QuestionType = 'buttonGroup' | 'select' | 'multiSelect' | 'text' | 'textarea'
export type QuestionColor = 'red' | 'blue' | 'green' | 'purple' | 'teal' | 'yellow' | 'orange'

export interface QuestionConfig {
  type: QuestionType
  key: string
  label: string
  required?: boolean
  options?: string[] | Array<{ value: string; label: string }>
  gridCols?: number
  placeholder?: string
  rows?: number
  color?: QuestionColor
}

export interface CategoryQuestions {
  questions: QuestionConfig[]
}

export interface QuestionsConfig {
  [category: string]: CategoryQuestions
}

export const QUESTIONS_CONFIG: QuestionsConfig = {
  "monsoon_diseases": {
    "questions": [
      {
        "type": "buttonGroup",
        "key": "hasFever",
        "label": "Do you have high fever?",
        "required": false,
        "options": ["Yes (>100°F)", "No", "I don't know"],
        "color": "red"
      },
      {
        "type": "select",
        "key": "duration",
        "label": "How many days?",
        "required": false,
        "options": [
          { "value": "today", "label": "Started today" },
          { "value": "1-2", "label": "1-2 days" },
          { "value": "3-5", "label": "3-5 days" },
          { "value": "week+", "label": "More than a week" },
          { "value": "unknown", "label": "I don't know" }
        ],
        "color": "red"
      },
      {
        "type": "multiSelect",
        "key": "symptoms",
        "label": "Main associated symptom (optional):",
        "required": false,
        "options": ["Body Pain", "Headache", "Rash", "Joint Pain", "Nausea", "None / I don't know"],
        "gridCols": 3,
        "color": "red"
      }
    ]
  },
  "chest_breathing": {
    "questions": [
      {
        "type": "buttonGroup",
        "key": "severity",
        "label": "Pain severity?",
        "required": false,
        "options": ["Mild", "Moderate", "Severe"],
        "gridCols": 3,
        "color": "red"
      },
      {
        "type": "select",
        "key": "duration",
        "label": "When?",
        "required": false,
        "options": [
          { "value": "today", "label": "Today" },
          { "value": "this-week", "label": "This week" },
          { "value": "earlier", "label": "Earlier" },
          { "value": "unknown", "label": "I don't know" }
        ],
        "color": "red"
      },
      {
        "type": "multiSelect",
        "key": "symptoms",
        "label": "Main associated symptom (optional):",
        "required": false,
        "options": ["Shortness of Breath", "Sweating", "Nausea", "Dizziness", "None / I don't know"],
        "gridCols": 2,
        "color": "red"
      }
    ]
  },
  "diabetes_complications": {
    "questions": [
      {
        "type": "buttonGroup",
        "key": "visitType",
        "label": "Visit type?",
        "required": true,
        "options": ["Regular Checkup", "New Complications"],
        "gridCols": 2,
        "color": "purple"
      },
      {
        "type": "multiSelect",
        "key": "symptoms",
        "label": "Any complications?",
        "required": false,
        "options": ["Diabetic Foot", "Eye Problems", "Kidney Issues", "Nerve Pain", "Heart Problems", "None"],
        "gridCols": 2,
        "color": "purple"
      },
      {
        "type": "multiSelect",
        "key": "medications",
        "label": "Current medications:",
        "required": false,
        "options": ["Metformin", "Insulin", "Glimepiride", "Other"],
        "gridCols": 2,
        "color": "purple"
      },
      {
        "type": "text",
        "key": "hba1c",
        "label": "Last HbA1c reading (if known):",
        "required": false,
        "placeholder": "e.g., 7.5% or last 3 months average",
        "color": "purple"
      }
    ]
  },
  "general_checkup": {
    "questions": [
      {
        "type": "buttonGroup",
        "key": "reason",
        "label": "Reason for checkup?",
        "required": true,
        "options": ["Routine Health Checkup", "Feeling Unwell", "Follow-up Visit", "Preventive Care"],
        "gridCols": 2,
        "color": "teal"
      },
      {
        "type": "textarea",
        "key": "concerns",
        "label": "Any specific concerns?",
        "required": false,
        "placeholder": "Optional: Describe any specific health concerns...",
        "rows": 3,
        "color": "teal"
      }
    ]
  },
  "cardiac_issues": {
    "questions": [
      {
        "type": "multiSelect",
        "key": "symptoms",
        "label": "What's the main concern?",
        "required": false,
        "options": ["Chest Pain", "Breathing Difficulty", "High BP", "Heart Palpitations", "Swelling", "Family History"],
        "gridCols": 2,
        "color": "red"
      },
      {
        "type": "text",
        "key": "bpReading",
        "label": "Current BP reading (if known):",
        "required": false,
        "placeholder": "e.g., 140/90 mmHg",
        "color": "red"
      },
      {
        "type": "multiSelect",
        "key": "medications",
        "label": "Current heart medications:",
        "required": false,
        "options": ["ACE Inhibitors", "Beta Blockers", "Diuretics", "Statins", "Aspirin", "None"],
        "gridCols": 2,
        "color": "red"
      }
    ]
  },
  "stomach_digestive": {
    "questions": [
      {
        "type": "multiSelect",
        "key": "symptoms",
        "label": "मुख्य समस्या: (Main problem:)",
        "required": false,
        "options": [
          "पेट दर्द (Stomach Pain)",
          "उल्टी/मतली (Nausea/Vomiting)",
          "दस्त (Diarrhea)",
          "कब्ज (Constipation)",
          "एसिडिटी (Acidity)",
          "गैस/सूजन (Bloating)"
        ],
        "gridCols": 2,
        "color": "green"
      },
      {
        "type": "select",
        "key": "duration",
        "label": "कितने दिन से? (How long?)",
        "required": false,
        "options": [
          { "value": "today", "label": "आज शुरू हुआ (Started today)" },
          { "value": "few-days", "label": "कुछ दिनों से (Few days)" },
          { "value": "week-plus", "label": "एक सप्ताह से ज्यादा (More than a week)" }
        ],
        "color": "green"
      }
    ]
  },
  "cancer_oncology": {
    "questions": [
      {
        "type": "buttonGroup",
        "key": "cancerType",
        "label": "Type of Cancer",
        "required": true,
        "options": [
          "Breast Cancer",
          "Lung Cancer",
          "Prostate Cancer",
          "Colon Cancer",
          "Stomach Cancer",
          "Liver Cancer",
          "Blood Cancer (Leukemia)",
          "Lymphoma",
          "Skin Cancer",
          "Thyroid Cancer",
          "Cervical Cancer",
          "Ovarian Cancer",
          "Brain Tumor",
          "Bone Cancer",
          "Other Type",
          "Not Sure / Awaiting Diagnosis"
        ],
        "gridCols": 3,
        "color": "purple"
      },
      {
        "type": "buttonGroup",
        "key": "visitType",
        "label": "Visit Type?",
        "required": false,
        "options": ["Initial Consultation", "Follow-up", "Second Opinion", "Treatment Planning", "Routine Checkup"],
        "gridCols": 2,
        "color": "purple"
      },
      {
        "type": "buttonGroup",
        "key": "treatmentStatus",
        "label": "Current Treatment Status:",
        "required": false,
        "options": ["Newly Diagnosed", "Under Treatment", "Post-Treatment", "Remission", "Recurrence", "Surveillance"],
        "gridCols": 2,
        "color": "purple"
      },
      {
        "type": "multiSelect",
        "key": "symptoms",
        "label": "Current treatments (if any):",
        "required": false,
        "options": ["Chemotherapy", "Radiation", "Surgery", "Immunotherapy", "Targeted Therapy", "Hormone Therapy", "None Yet", "Other"],
        "gridCols": 2,
        "color": "purple"
      },
      {
        "type": "textarea",
        "key": "additionalConcerns",
        "label": "Additional concerns or questions:",
        "required": false,
        "placeholder": "Optional: Share any specific concerns, questions, or details about your condition...",
        "rows": 3,
        "color": "purple"
      }
    ]
  }
}

