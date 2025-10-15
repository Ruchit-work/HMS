#!/usr/bin/env node
/**
 * Helper script to add more patient data to the Indian patient dataset
 * Usage: node add_patient_data.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function loadDataset() {
  try {
    const dataPath = path.join(__dirname, 'src', 'data', 'indian_patient_dataset.json');
    const fileContent = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.log("Could not load dataset:", error.message);
    return [];
  }
}

function saveDataset(dataset) {
  try {
    const dataPath = path.join(__dirname, 'src', 'data', 'indian_patient_dataset.json');
    fs.writeFileSync(dataPath, JSON.stringify(dataset, null, 2));
    console.log("✅ Dataset saved successfully!");
    return true;
  } catch (error) {
    console.log("❌ Could not save dataset:", error.message);
    return false;
  }
}

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function addNewCase() {
  console.log("\n🏥 Adding New Indian Patient Case");
  console.log("=" * 50);
  
  const dataset = loadDataset();
  const nextId = `IND${String(dataset.length + 1).padStart(3, '0')}`;
  
  console.log(`\n📝 Case ID: ${nextId}`);
  
  const age = await prompt("Age: ");
  const gender = await prompt("Gender (Male/Female): ");
  const region = await prompt("Region (e.g., Gujarat, Delhi, Kerala): ");
  
  console.log("\n📋 Symptoms (enter one per line, type 'done' when finished):");
  const symptoms = [];
  while (true) {
    const symptom = await prompt("Symptom: ");
    if (symptom.toLowerCase() === 'done') break;
    if (symptom.trim()) symptoms.push(symptom.trim());
  }
  
  const duration = await prompt("Duration (e.g., 3 days, 2 weeks): ");
  const environment = await prompt("Environment/Context: ");
  const preConditions = await prompt("Pre-existing conditions (comma-separated, or 'none'): ");
  
  const diagnosis = await prompt("Diagnosis: ");
  
  console.log("\n🔬 Recommended Tests (enter one per line, type 'done' when finished):");
  const recommendedTests = [];
  while (true) {
    const test = await prompt("Test: ");
    if (test.toLowerCase() === 'done') break;
    if (test.trim()) recommendedTests.push(test.trim());
  }
  
  const treatmentPlan = await prompt("Treatment Plan: ");
  const aiNotes = await prompt("AI Notes: ");
  
  const newCase = {
    case_id: nextId,
    age: parseInt(age) || 0,
    gender: gender,
    region: region,
    symptoms: symptoms,
    duration: duration,
    environment: environment,
    pre_conditions: preConditions.toLowerCase() === 'none' ? ["none"] : preConditions.split(',').map(s => s.trim()),
    diagnosis: diagnosis,
    recommended_tests: recommendedTests,
    treatment_plan: treatmentPlan,
    ai_notes: aiNotes
  };
  
  dataset.push(newCase);
  
  console.log("\n📊 New Case Summary:");
  console.log(JSON.stringify(newCase, null, 2));
  
  const confirm = await prompt("\n✅ Save this case? (y/n): ");
  if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
    if (saveDataset(dataset)) {
      console.log(`\n🎉 Case ${nextId} added successfully!`);
      console.log(`📈 Total cases in dataset: ${dataset.length}`);
    }
  } else {
    console.log("❌ Case not saved.");
  }
}

async function showDatasetStats() {
  const dataset = loadDataset();
  
  console.log("\n📊 Dataset Statistics:");
  console.log("=" * 30);
  console.log(`Total Cases: ${dataset.length}`);
  
  // Disease distribution
  const diseases = {};
  dataset.forEach(case_data => {
    diseases[case_data.diagnosis] = (diseases[case_data.diagnosis] || 0) + 1;
  });
  
  console.log(`\n🏥 Disease Categories (${Object.keys(diseases).length} unique):`);
  Object.entries(diseases).forEach(([disease, count]) => {
    console.log(`  - ${disease}: ${count} cases`);
  });
  
  // Regional distribution
  const regions = {};
  dataset.forEach(case_data => {
    regions[case_data.region] = (regions[case_data.region] || 0) + 1;
  });
  
  console.log(`\n🌍 Regional Distribution (${Object.keys(regions).length} regions):`);
  Object.entries(regions).forEach(([region, count]) => {
    console.log(`  - ${region}: ${count} cases`);
  });
}

async function main() {
  console.log("🏥 Indian Patient Dataset Manager");
  console.log("=" * 40);
  
  while (true) {
    console.log("\n📋 Options:");
    console.log("1. Add new case");
    console.log("2. Show dataset statistics");
    console.log("3. Exit");
    
    const choice = await prompt("\nSelect option (1-3): ");
    
    switch (choice) {
      case '1':
        await addNewCase();
        break;
      case '2':
        await showDatasetStats();
        break;
      case '3':
        console.log("\n👋 Goodbye!");
        rl.close();
        return;
      default:
        console.log("❌ Invalid option. Please select 1-3.");
    }
  }
}

main().catch(console.error);
