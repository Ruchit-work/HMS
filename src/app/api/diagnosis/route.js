import { NextResponse } from "next/server";
import axios from "axios";
import fs from "fs";
import path from "path";

// Load Indian Patient Dataset from JSON file
function loadIndianPatientDataset() {
  try {
    const dataPath = path.join(process.cwd(), 'src', 'data', 'indian_patient_dataset.json');
    const fileContent = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.log("Could not load Indian patient dataset:", error.message);
    return [];
  }
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
    case_data.symptoms.forEach(symptom => {
      if (symptomsLower.includes(symptom.toLowerCase())) {
        score += 2;
      }
    });
    
    // Partial symptom matches
    case_data.symptoms.forEach(symptom => {
      const symptomWords = symptom.toLowerCase().split(' ');
      symptomWords.forEach(word => {
        if (word.length > 3 && symptomsLower.includes(word)) {
          score += 0.5;
        }
      });
    });
    
    // Region/environment context
    if (patientInfoLower.includes(case_data.region.toLowerCase())) {
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

// Groq AI Integration for Medical Diagnosis with Indian Patient Dataset
async function getAIDiagnosis(symptoms, patientInfo) {
  // Load dataset from JSON file
  const indianPatientDataset = loadIndianPatientDataset();
  
  // Find similar cases from Indian dataset
  const similarCases = findSimilarCases(symptoms, patientInfo, indianPatientDataset);
  
  // Log dataset usage for debugging
  console.log(`Dataset usage: Found ${similarCases.length} similar cases out of ${indianPatientDataset.length} total cases`);
  if (similarCases.length > 0) {
    console.log(`Top match: ${similarCases[0].case_id} (${similarCases[0].diagnosis}) - Score: ${similarCases[0].relevance_score}`);
  }
  
  // Build context from similar cases
  let contextExamples = "";
  if (similarCases.length > 0) {
    contextExamples = "\n\n**RELEVANT INDIAN PATIENT CASES FOR REFERENCE:**\n";
    similarCases.forEach((case_data, index) => {
      contextExamples += `\nCase ${index + 1} (${case_data.region}, Age: ${case_data.age}):
- Symptoms: ${case_data.symptoms.join(', ')}
- Duration: ${case_data.duration}
- Environment: ${case_data.environment}
- Diagnosis: ${case_data.diagnosis}
- Tests: ${case_data.recommended_tests.join(', ')}
- Treatment: ${case_data.treatment_plan}
- Notes: ${case_data.ai_notes}`;
    });
  }

  const prompt = `You are an experienced medical doctor specializing in Indian healthcare patterns and diseases. Analyze this patient case and provide a comprehensive medical assessment.

**PATIENT INFORMATION:**
${patientInfo}

**PRESENTING SYMPTOMS:**
${symptoms}${contextExamples}

**INSTRUCTIONS:**
Consider the regional healthcare patterns, common Indian diseases, and similar cases above. Focus on:
1. Indian-specific disease patterns (monsoon diseases, tropical infections, regional health issues)
2. Common Indian medications and treatment protocols
3. Regional healthcare infrastructure considerations
4. Cultural and environmental factors affecting health

**IMPORTANT:** If similar cases are provided above, reference them by case number (e.g., "Similar to Case 1 from Rajasthan") and explain how they relate to this patient.

Provide your analysis in this EXACT format:

**PRELIMINARY DIAGNOSIS:**
[State the most likely diagnosis based on the symptoms. Include brief explanation.]

**RECOMMENDED TESTS:**
1. [First specific test name]
2. [Second test name]
3. [Additional tests as needed]

**TREATMENT RECOMMENDATIONS:**
Provide specific MEDICINE NAMES with complete prescription details in this format:
- [Medicine Name (Generic/Brand)] [Strength] - [Quantity] [Frequency] - [Duration] - [Purpose]

Example:
- Paracetamol (Crocin) 500mg - 1 tablet every 6 hours - For 3 days - For fever relief
- Azithromycin 250mg - 1 tablet once daily - For 5 days - Antibiotic for bacterial infection
- Cetirizine 10mg - 1 tablet at bedtime - For 5 days - For allergic symptoms

Include 3-5 specific medicines with exact dosages. Then add general care advice (hydration, rest, diet).

**WHEN TO SEEK IMMEDIATE CARE:**
[List specific warning signs requiring urgent medical attention]

**ADDITIONAL NOTES:**
[Diet recommendations, lifestyle modifications, follow-up advice]

Be thorough and specific with medicine names, dosages, frequency, duration, and purpose.`;

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are an experienced medical doctor providing comprehensive preliminary diagnosis and treatment plans. Always include SPECIFIC medicine names with exact dosages, frequency, duration, and purpose. Use standard medical prescription format. Provide complete analysis with all sections: diagnosis, tests, medicines, urgent care warnings, and additional notes."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
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

// Simple symptom-based diagnosis system (fallback)
function getBasicDiagnosis(symptoms, patientInfo) {
  const symptomsLower = symptoms.toLowerCase();
  let diagnosis = "";
  let tests = [];
  let treatment = "";
  let urgent = "";

  // Fever-related
  if (symptomsLower.includes("fever") || symptomsLower.includes("temperature")) {
    if (symptomsLower.includes("cough") || symptomsLower.includes("cold")) {
      diagnosis = "Possible Viral Respiratory Infection (Common Cold/Flu)";
      tests.push("Complete Blood Count (CBC)", "Throat swab culture", "Chest X-ray if needed");
      treatment = "MEDICINES:\n- Paracetamol 500mg - 1 tablet every 6 hours - For 3-5 days - For fever and body ache\n- Cetirizine 10mg - 1 tablet at bedtime - For 5 days - For runny nose and sneezing\n- Dextromethorphan cough syrup - 10ml three times daily - For 5 days - For dry cough\n\nGENERAL CARE:\n- Rest and adequate hydration (8-10 glasses of water daily)\n- Warm fluids and steam inhalation twice daily\n- Vitamin C 500mg once daily\n- Avoid cold foods and beverages";
      urgent = "Seek immediate care if fever exceeds 103°F (39.4°C), difficulty breathing, or symptoms persist beyond 3 days";
    } else {
      diagnosis = "Fever of Unknown Origin - Requires Investigation";
      tests.push("Complete Blood Count", "Urine Analysis", "Blood Culture", "Malaria/Dengue test");
      treatment = "MEDICINES:\n- Paracetamol 500mg - 1 tablet every 6 hours as needed - Until fever subsides - For fever\n\nGENERAL CARE:\n- Monitor temperature every 4 hours\n- Stay well hydrated\n- Rest adequately\n- Light, easily digestible diet";
      urgent = "Consult a doctor immediately if fever persists beyond 48 hours or exceeds 102°F";
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
    const { symptoms, patientInfo } = await request.json();

    // Validation
    if (!symptoms || !patientInfo) {
      return NextResponse.json(
        { error: "Both symptoms and patient information are required" },
        { status: 400 }
      );
    }

    // Try Groq AI first
    if (process.env.GROQ_API_KEY) {
      const aiResult = await getAIDiagnosis(symptoms, patientInfo);
      
      if (aiResult.success) {
        return NextResponse.json([{
          generated_text: aiResult.text
        }]);
      }
      
      console.log("Groq AI unavailable, using fallback:", aiResult.error);
    }

    // Fallback to rule-based system
    const result = getBasicDiagnosis(symptoms, patientInfo);
    
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
