// Parse AI diagnosis into structured format for better display
export const parseAIDiagnosis = (text: string) => {
  const sections: {
    diagnosis: string
    tests: string[]
    treatment: string
    urgent: string
    notes: string
  } = {
    diagnosis: '',
    tests: [],
    treatment: '',
    urgent: '',
    notes: ''
  }

  // Extract sections using regex - Updated to match new AI format
  const diagnosisMatch = text.match(/\*\*.*?DIAGNOSIS:\*\*\s*([\s\S]*?)(?=\*\*|$)/i)
  const testsMatch = text.match(/\*\*.*?TESTS:\*\*\s*([\s\S]*?)(?=\*\*|$)/i)
  const treatmentMatch = text.match(/\*\*.*?TREATMENT.*?:\*\*\s*([\s\S]*?)(?=\*\*|$)/i)
  const urgentMatch = text.match(/\*\*.*?(?:WHEN TO SEEK|WARNING SIGNS|RED FLAGS).*?:\*\*\s*([\s\S]*?)(?=\*\*|---|\n\n\*Note|$)/i)
  const notesMatch = text.match(/\*\*.*?(?:⚠️\s*IMPORTANT NOTES|IMPORTANT NOTES|NOTES|EDUCATION).*?:\*\*\s*([\s\S]*?)(?=\*\*|---|\n\n\*Note|$)/i)

  if (diagnosisMatch) sections.diagnosis = diagnosisMatch[1].trim()
  if (testsMatch) {
    const testsList = testsMatch[1].match(/\d+\.\s*(.+?)(?=\n\d+\.|\n\n|$)/g)
    if (testsList) {
      sections.tests = testsList.map((t: string) => t.replace(/^\d+\.\s*/, '').trim()).filter(test => test.length > 0)
    }
  }
  if (treatmentMatch) sections.treatment = treatmentMatch[1].trim()
  if (urgentMatch) sections.urgent = urgentMatch[1].trim()
  if (notesMatch) sections.notes = notesMatch[1].trim()

  return sections
}

