import { NextResponse } from "next/server";
import axios from "axios";

// Load similar cases from Indian dataset
function loadIndianPatientDataset() {
  try {
    const fs = require('fs');
    const path = require('path');
    const datasetPath = path.join(process.cwd(), 'src', 'data', 'indian_patient_dataset.json');
    
    if (fs.existsSync(datasetPath)) {
      const data = fs.readFileSync(datasetPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading Indian patient dataset:', error);
  }
  
  return [];
}

// Extract and analyze medical information from patient history
function extractMedicalInfo(medicalHistory) {
  if (!medicalHistory) return { summary: "No medical history provided" };
  
  const history = medicalHistory.toLowerCase();
  const info = {
    conditions: [],
    medications: [],
    allergies: [],
    riskFactors: [],
    summary: ""
  };
  
  // Extract existing conditions
  if (history && history.includes('diabetes')) info.conditions.push('Diabetes');
  if (history && (history.includes('hypertension') || history.includes('high blood pressure'))) info.conditions.push('Hypertension');
  if (history && (history.includes('heart disease') || history.includes('cardiac'))) info.conditions.push('Cardiovascular Disease');
  if (history && history.includes('asthma')) info.conditions.push('Asthma');
  if (history && history.includes('copd')) info.conditions.push('COPD');
  
  // Extract medications
  const medicationPatterns = [
    { pattern: /metformin/i, name: 'Metformin', type: 'Diabetes medication' },
    { pattern: /insulin/i, name: 'Insulin', type: 'Diabetes medication' },
    { pattern: /amoxicillin/i, name: 'Amoxicillin', type: 'Antibiotic' },
    { pattern: /paracetamol/i, name: 'Paracetamol', type: 'Pain relief' },
    { pattern: /ibuprofen/i, name: 'Ibuprofen', type: 'Anti-inflammatory' },
    { pattern: /aspirin/i, name: 'Aspirin', type: 'Antiplatelet' }
  ];
  
  medicationPatterns.forEach(med => {
    if (med.pattern.test(medicalHistory)) {
      info.medications.push({ name: med.name, type: med.type });
    }
  });
  
  // Extract allergies
  if (history && (history.includes('allergies: no') || history.includes('no allergies'))) {
    info.allergies.push('No known allergies');
  } else if (history && history.includes('allergies:')) {
    // Extract specific allergies if mentioned
    const allergyMatch = medicalHistory.match(/allergies?[:\s]+([^.]*)/i);
    if (allergyMatch && allergyMatch[1]) {
      info.allergies.push(allergyMatch[1].trim());
    }
  }
  
  // Risk factors
  if (history && (history.includes('smoking') || history.includes('smoker'))) info.riskFactors.push('Smoking');
  if (history && (history.includes('alcohol') || history.includes('drinking'))) info.riskFactors.push('Alcohol use');
  if (history && history.includes('family history')) info.riskFactors.push('Family history');
  
  // Generate summary
  let summary = "MEDICAL HISTORY SUMMARY:\n";
  if (info.conditions.length > 0) {
    summary += `• Existing Conditions: ${info.conditions.join(', ')}\n`;
  }
  if (info.medications.length > 0) {
    summary += `• Current Medications: ${info.medications.map(m => m.name).join(', ')}\n`;
  }
  if (info.allergies.length > 0) {
    summary += `• Allergies: ${info.allergies.join(', ')}\n`;
  }
  if (info.riskFactors.length > 0) {
    summary += `• Risk Factors: ${info.riskFactors.join(', ')}\n`;
  }
  
  if (summary === "MEDICAL HISTORY SUMMARY:\n") {
    summary += "• No significant medical history documented";
  }
  
  return { ...info, summary };
}

// Find similar cases from Indian dataset
function findSimilarCases(symptoms, patientInfo, dataset) {
  if (!dataset || dataset.length === 0) return [];
  
  const symptomsLower = symptoms.toLowerCase();
  const patientInfoLower = patientInfo.toLowerCase();
  
  // Score cases based on symptom similarity
  const scoredCases = dataset.map(case_data => {
    let score = 0;
    
    // Exact symptom matches
    if (case_data.symptoms && Array.isArray(case_data.symptoms)) {
      case_data.symptoms.forEach(symptom => {
        if (symptom && symptomsLower.includes(symptom.toLowerCase())) {
          score += 2;
        }
      });
    }
    
    // Partial symptom matches
    if (case_data.symptoms && Array.isArray(case_data.symptoms)) {
      case_data.symptoms.forEach(symptom => {
        if (symptom) {
          const symptomWords = symptom.toLowerCase().split(' ');
          symptomWords.forEach(word => {
            if (word.length > 3 && symptomsLower.includes(word)) {
              score += 0.5;
            }
          });
        }
      });
    }
    
    // Region/environment context
    if (case_data.region && patientInfoLower.includes(case_data.region.toLowerCase())) {
      score += 1;
    }
    
    return { ...case_data, relevance_score: score };
  });
  
  // Return top 3 most relevant cases
  return scoredCases
    .filter(case_data => case_data.relevance_score > 0)
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 3);
}

// Simple AI Diagnosis
async function getAIDiagnosis(symptoms, patientInfo, medicalHistory) {
  if (!process.env.GROQ_API_KEY) {
    return { success: false, error: "GROQ_API_KEY not configured" };
  }

  // Load similar cases from dataset
  const indianPatientDataset = loadIndianPatientDataset();
  const similarCases = findSimilarCases(symptoms, patientInfo, indianPatientDataset);
  
  // Extract key medical information
  const extractedInfo = extractMedicalInfo(medicalHistory);
  
  // Build context from similar cases
  let contextExamples = "";
  if (similarCases.length > 0) {
    contextExamples = "\n\n**SIMILAR CASES FROM DATABASE:**\n";
    similarCases.forEach((case_data, index) => {
      contextExamples += `\nCase ${index + 1}: ${case_data.symptoms.join(', ')} → ${case_data.diagnosis}`;
    });
  }

  const prompt = `**PATIENT PRESENTATION:**
Symptoms: ${symptoms}
Patient Info: ${patientInfo}
Medical History: ${extractedInfo.summary}

${contextExamples}

Please provide a preliminary diagnosis, recommended tests, and treatment suggestions.`;

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are Dr. Sarah Kumar, a senior consultant physician. Provide medical diagnosis and treatment recommendations based on the patient information provided."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        top_p: 0.9
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    if (response.data?.choices?.[0]?.message?.content) {
      return {
        success: true,
        text: response.data.choices[0].message.content
      };
    }
    throw new Error("Invalid response from AI");
  } catch (error) {
    console.log("Groq AI error:", error.message);
    return { success: false, error: error.message };
  }
}

// Simple symptom diagnosis system (fallback)
function getBasicDiagnosis(symptoms, patientInfo, medicalHistory) {
  const symptomsLower = symptoms.toLowerCase();
  const extractedInfo = extractMedicalInfo(medicalHistory);
  
  // Fallback to enhanced rule-based system
  let diagnosis = "";
  let tests = [];
  let treatment = "";
  let urgent = "";

  // Check for diabetes-related concerns first
  if (extractedInfo.conditions.includes('Diabetes')) {
    if (symptomsLower.includes("unwell") || symptomsLower.includes("fatigue") || symptomsLower.includes("thirst")) {
      diagnosis = "Diabetes Complications - Hypoglycemia/Hyperglycemia";
      tests.push("Blood glucose test (immediate)", "HbA1c", "Kidney function tests (BUN, creatinine)", "Urine analysis");
      treatment = "MEDICINES:\n- Continue current diabetes medication as prescribed\n- Metformin 500mg twice daily if not contraindicated\n- Monitor blood sugar levels regularly\n\nGENERAL CARE:\n- Check blood glucose immediately\n- Maintain regular meal times\n- Stay well hydrated\n- Monitor for signs of ketoacidosis";
      urgent = "Seek immediate care if blood glucose >300 mg/dL or <70 mg/dL, signs of dehydration, or altered mental status";
      return { diagnosis, tests, treatment, urgent };
    }
  }

  // Asthma-related symptoms
  if (symptomsLower.includes("wheezing") || symptomsLower.includes("coughing") || symptomsLower.includes("shortness of breath")) {
    diagnosis = "Bronchial Asthma";
    tests.push("Pulmonary function test", "Chest X-ray", "Peak flow measurement");
    treatment = "MEDICINES:\n- Salbutamol inhaler 100mcg - 2 puffs as needed - For acute symptoms - Bronchodilator\n- Beclomethasone inhaler 50mcg - 2 puffs twice daily - For 7 days - Anti-inflammatory\n- Montelukast 10mg - 1 tablet at bedtime - Daily - For long-term control\n\nGENERAL CARE:\n- Avoid known triggers (dust, smoke, pollen)\n- Use peak flow meter daily\n- Maintain proper inhaler technique\n- Regular follow-up with doctor";
    urgent = "Seek immediate care if difficulty breathing worsens, blue lips/fingernails, or inability to speak in full sentences";
    return { diagnosis, tests, treatment, urgent };
  }

  // Fever-related conditions
  if (symptomsLower.includes("fever") || symptomsLower.includes("temperature")) {
    if (symptomsLower.includes("joint pain") && symptomsLower.includes("rash")) {
      diagnosis = "Dengue/Chikungunya/Malaria";
      tests.push("CBC", "Dengue NS1 Antigen", "Platelet Count", "Malaria parasite test");
      treatment = "MEDICINES:\n- Paracetamol 500mg - 1 tablet every 6 hours - For 5 days - For fever and pain\n- Avoid Aspirin and NSAIDs\n\nGENERAL CARE:\n- Adequate hydration (3-4 liters daily)\n- Complete bed rest\n- Monitor platelet count daily\n- Use mosquito repellent";
      urgent = "Seek immediate care if platelet count <50,000, bleeding, severe abdominal pain, or persistent vomiting";
      return { diagnosis, tests, treatment, urgent };
    } else if (symptomsLower.includes("cough") || symptomsLower.includes("cold")) {
      diagnosis = "Viral Upper Respiratory Tract Infection";
      tests.push("Complete Blood Count (CBC)", "Throat swab culture", "Chest X-ray if needed");
      treatment = "MEDICINES:\n- Paracetamol 500mg - 1 tablet every 6 hours - For 3-5 days - For fever\n- Cetirizine 10mg - 1 tablet at bedtime - For 5 days - For nasal congestion\n- Dextromethorphan cough syrup - 10ml three times daily - For 5 days - For cough\n\nGENERAL CARE:\n- Rest and adequate hydration\n- Warm fluids and steam inhalation\n- Vitamin C 500mg once daily\n- Avoid cold foods";
      urgent = "Seek immediate care if fever exceeds 103°F, difficulty breathing, or symptoms persist beyond 3 days";
      return { diagnosis, tests, treatment, urgent };
    }
  }

  // Headache-related
  if (symptomsLower.includes("headache") || symptomsLower.includes("head pain")) {
    if (!diagnosis) {
      diagnosis = "Tension Headache or Migraine";
      tests.push("Blood pressure check", "Eye examination if persistent", "CT scan if severe or recurrent");
      treatment = "MEDICINES:\n- Ibuprofen 400mg - 1 tablet every 8 hours - As needed (max 3 days) - For pain relief\n- Paracetamol 500mg - 1 tablet every 6 hours - As needed - Alternative pain relief\n\nGENERAL CARE:\n- Rest in a dark, quiet room\n- Stay well hydrated (at least 8 glasses water daily)\n- Avoid triggers (stress, bright lights, loud noise)\n- Cold compress on forehead";
      urgent = "Seek immediate care if accompanied by vision changes, severe nausea, neck stiffness, confusion, or sudden onset severe headache";
    }
  }

  // Respiratory symptoms
  if (symptomsLower.includes("cough") && !diagnosis) {
    diagnosis = "Acute Bronchitis or Upper Respiratory Tract Infection";
    tests.push("Chest X-ray if persistent", "Sputum culture", "Pulmonary function test");
    treatment = "MEDICINES:\n- Dextromethorphan 15mg - 10ml three times daily - For 5-7 days - Cough suppressant\n- Ambroxol 30mg - 1 tablet three times daily - For 5 days - Expectorant\n- Salbutamol inhaler - 2 puffs if breathing difficulty - As needed - Bronchodilator\n\nGENERAL CARE:\n- Plenty of fluids (warm preferred)\n- Honey and warm water\n- Steam inhalation twice daily\n- Avoid smoke and pollutants";
    urgent = "See a doctor immediately if cough persists beyond 2 weeks, blood in sputum, severe breathing difficulty, or chest pain";
  }

  // Digestive issues
  if (symptomsLower.includes("stomach") || symptomsLower.includes("abdominal") || symptomsLower.includes("nausea")) {
    if (!diagnosis) {
      diagnosis = "Gastroenteritis or Acute Gastritis";
      tests.push("Stool analysis", "Abdominal ultrasound if severe", "H. pylori test", "Complete Blood Count");
      treatment = "MEDICINES:\n- Omeprazole 20mg - 1 capsule before breakfast - For 7 days - For acidity and gastritis\n- Ondansetron 4mg - 1 tablet when nausea occurs - As needed - Anti-nausea\n- Loperamide 2mg - 1 tablet after loose stool - Maximum 4 per day - For diarrhea\n- ORS (Oral Rehydration Solution) - 200ml after each loose stool - As needed - Rehydration\n- Probiotic capsules - 1 capsule twice daily - For 5 days - Restore gut health\n\nGENERAL CARE:\n- Light, bland diet (BRAT: Bananas, Rice, Applesauce, Toast)\n- Avoid spicy, fatty, and dairy foods\n- Small frequent meals\n- Stay hydrated";
      urgent = "Seek immediate care if severe abdominal pain, persistent vomiting, blood in stool, signs of dehydration (dry mouth, reduced urination), or high fever";
    }
  }

  // Default fallback
  if (!diagnosis) {
    diagnosis = "Symptoms require professional medical evaluation";
    tests.push("General physical examination", "Basic laboratory tests (CBC, metabolic panel)", "Vital signs assessment");
    treatment = "GENERAL RECOMMENDATIONS:\n- Symptomatic relief as appropriate\n- Monitor symptoms closely\n- Maintain detailed symptom diary\n- Stay hydrated and well-rested\n- Follow-up with healthcare provider for proper diagnosis";
    urgent = "Schedule an appointment with a healthcare provider for proper diagnosis and treatment plan";
  }

  return {
    diagnosis,
    tests,
    treatment,
    urgent,
    patientInfo
  };
}

export async function POST(request) {
  try {
    const { symptoms, patientInfo, medicalHistory } = await request.json();
    
    console.log("🔍 Diagnosis API called with:", { symptoms, patientInfo, medicalHistory });

    // Validation
    if (!symptoms || !patientInfo) {
      console.log("❌ Validation failed - missing required fields");
      return NextResponse.json(
        { error: "Both symptoms and patient information are required" },
        { status: 400 }
      );
    }

    // Try Groq AI first
    if (process.env.GROQ_API_KEY) {
      console.log("🤖 Trying Groq AI diagnosis...");
      const aiResult = await getAIDiagnosis(symptoms, patientInfo, medicalHistory);
      
      if (aiResult.success) {
        console.log("✅ Groq AI diagnosis successful");
        return NextResponse.json([{
          generated_text: aiResult.text
        }]);
      }
      
      console.log("❌ Groq AI failed, using fallback:", aiResult.error);
    } else {
      console.log("⚠️ No GROQ_API_KEY found, using fallback");
    }

    // Fallback to rule-based system
    console.log("🔄 Using fallback diagnosis system...");
    const result = getBasicDiagnosis(symptoms, patientInfo, medicalHistory);
    console.log("📋 Fallback result:", result);
    
    const formattedText = `**PRELIMINARY DIAGNOSIS:**
${result.diagnosis}

**PATIENT INFORMATION:**
${result.patientInfo}

**RECOMMENDED TESTS:**
${result.tests.map((test, i) => `${i + 1}. ${test}`).join('\n')}

**TREATMENT RECOMMENDATIONS:**
${result.treatment}

**⚠️ WHEN TO SEEK IMMEDIATE CARE:**
${result.urgent}

---
*Note: This is an AI-assisted preliminary analysis. Always consult with a qualified healthcare professional for accurate diagnosis and treatment.*`;

    return NextResponse.json([{
      generated_text: formattedText
    }]);

  } catch (error) {
    console.error("Diagnosis API Error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });

    return NextResponse.json(
      { 
        error: error.response?.data?.error || error.message || "Failed to get diagnosis. Please try again." 
      },
      { status: error.response?.status || 500 }
    );
  }
}