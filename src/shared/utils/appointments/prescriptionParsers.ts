// Helper function to parse and render prescription text
export const parsePrescription = (text: string) => {
  if (!text) return null
  
  const lines = text.split('\n').filter(line => line.trim())
  const medicines: Array<{emoji: string, name: string, dosage: string, frequency: string, duration: string}> = []
  let advice = ""
  
  let currentMedicine: {emoji: string, name: string, dosage: string, frequency: string, duration: string} | null = null
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Skip prescription header
    if (line.includes('🧾') && line.includes('Prescription')) continue
    
    // Check for medicine line (contains emoji and medicine name) - matches *1️⃣ Medicine Name Dosage*
    const medicineMatch = line.match(/\*([1-9]️⃣|🔟)\s+(.+?)\*/)
    if (medicineMatch) {
      // Save previous medicine
      if (currentMedicine) {
        medicines.push(currentMedicine)
      }
      
      const emoji = medicineMatch[1]
      let nameWithDosage = medicineMatch[2].trim()
      
      // Extract dosage from anywhere (e.g., "20mg", "400mg")
      const dosageMatch = nameWithDosage.match(/(\d+(?:\.\d+)?\s*(?:mg|g|ml|capsule|tablet|tab|cap))/i)
      let dosage = ""
      if (dosageMatch) {
        dosage = dosageMatch[1]
        nameWithDosage = nameWithDosage.replace(dosageMatch[0], '').trim()
      }
      
      // Extract duration if present in the line (e.g., "for 14 days", "for 7 days")
      let duration = ""
      const durationMatch = nameWithDosage.match(/(?:for|duration)\s+(\d+\s*(?:days?|weeks?|months?))/i)
      if (durationMatch) {
        duration = durationMatch[1]
        nameWithDosage = nameWithDosage.replace(durationMatch[0], '').trim()
      }
      
      // Extract frequency if present (e.g., "daily", "twice", "three times")
      let frequency = ""
      const frequencyMatch = nameWithDosage.match(/(daily|once|twice|three times|four times|\d+\s*times)/i)
      if (frequencyMatch) {
        frequency = frequencyMatch[1]
        nameWithDosage = nameWithDosage.replace(frequencyMatch[0], '').trim()
      }
      
      // Clean up name (remove brackets, dashes, extra spaces)
      const name = nameWithDosage.replace(/\[.*?\]/g, '').replace(/\s*-\s*/g, ' ').replace(/\s+/g, ' ').trim()
      
      currentMedicine = {
        emoji,
        name: name || "Medicine",
        dosage,
        frequency,
        duration
      }
    } else if (currentMedicine) {
      // Check for frequency (starts with • and doesn't contain "duration")
      if (line.startsWith('•') && !line.toLowerCase().includes('duration')) {
        const freq = line.replace('•', '').trim()
        if (freq && !currentMedicine.frequency) {
          currentMedicine.frequency = freq
        }
      }
      
      // Check for duration (starts with • and contains "duration")
      if (line.startsWith('•') && line.toLowerCase().includes('duration')) {
        const duration = line.replace('•', '').replace(/duration:/i, '').trim()
        if (duration) {
          currentMedicine.duration = duration
        }
      }
    }
    
    // Capture advice
    if (line.includes('📌') && /advice/i.test(line)) {
      advice = line.replace(/📌\s*\*?Advice:\*?\s*/i, '').trim()
    }
  }
  
  // Add last medicine
  if (currentMedicine) {
    medicines.push(currentMedicine)
  }
  
  return { medicines, advice }
}

// Helper function to parse AI prescription text into structured format
export const parseAiPrescription = (text: string): Array<{name: string, dosage: string, frequency: string, duration: string}> => {
  const medicines: Array<{name: string, dosage: string, frequency: string, duration: string}> = []
  
  // Split by newlines and try to parse each line
  const lines = text.split('\n').filter(line => line.trim())
  
  let currentMedicine: {name: string, dosage: string, frequency: string, duration: string} | null = null
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    
    // Skip empty lines
    if (!trimmedLine) continue
    
    // Check if this looks like a new medicine (starts with number, dash, or medicine name pattern)
    const medicinePattern = /^(\d+\.?\s*)?([A-Z][a-zA-Z\s]+(?:\s+\d+[a-z]{2})?)/i
    const match = trimmedLine.match(medicinePattern)
    
    if (match || trimmedLine.match(/^[A-Z]/)) {
      // Save previous medicine if exists
      if (currentMedicine && currentMedicine.name) {
        medicines.push(currentMedicine)
      }
      
      // Extract medicine name (remove numbering and common prefixes)
      let name = trimmedLine.replace(/^\d+\.?\s*/, '').replace(/^-\s*/, '').trim()
      
      // Try to extract dosage, frequency, etc. from the same line
      let dosage = ""
      let frequency = ""
      let duration = ""
      
      // Look for common patterns like "500mg", "50mcg", "1 tablet", etc.
      const dosageMatch = trimmedLine.match(/(\d+(?:\.\d+)?\s*(?:mcg|µg|mg|g|ml|tablet|tab|capsule|cap))/i)
      if (dosageMatch) {
        dosage = dosageMatch[1]
        // Remove dosage (and any surrounding brackets) from the name
        name = name
          .replace(dosageMatch[0], '')
          .replace(/\[[^\]]*\]/g, '')  // remove [50mcg] style blocks
          .trim()
      }
      
      const frequencyMatch = trimmedLine.match(/(\d+[-\s]\d+[-\s]\d+|\d+\s*(?:times|tab|cap)s?\s*(?:daily|per day|a day)|once|twice|daily)/i)
      if (frequencyMatch) {
        frequency = frequencyMatch[1]
        name = name.replace(frequencyMatch[0], '').trim()
      }
      
      const durationMatch = trimmedLine.match(/(?:for|duration|take|continue)\s+(\d+\s*(?:days?|weeks?|months?|times?))?/i)
      if (durationMatch && durationMatch[1]) {
        duration = durationMatch[1]
        // Remove the whole duration phrase from name (e.g. "for 3 months")
        name = name.replace(durationMatch[0], '').trim()
      }
      
      // Clean up name (remove extra spaces, brackets, trailing hyphens, and extra words)
      name = name
        .replace(/\[[^\]]*\]/g, '')                    // any remaining [ ... ]
        .replace(/\s*-\s*(daily|once|twice).*$/i, '')  // "- daily for 3 months" etc
        .replace(/\s*-\s*$/, '')                       // trailing hyphen
        .replace(/[,;:]\s*$/, '')                      // trailing punctuation
        .replace(/\s{2,}/g, ' ')                       // collapse multiple spaces
        .trim()
      
      currentMedicine = { name: name || "Medicine", dosage, frequency, duration }
    } else if (currentMedicine) {
      // Check if this line contains frequency or duration info
      const frequencyMatch = trimmedLine.match(/(\d+[-\s]\d+[-\s]\d+|\d+\s*(?:times|tab|cap)s?\s*(?:daily|per day|a day)|once|twice)/i)
      if (frequencyMatch && !currentMedicine.frequency) {
        currentMedicine.frequency = frequencyMatch[1]
      }
      
      const durationMatch = trimmedLine.match(/(?:for|duration|take|continue)\s+(\d+\s*(?:days?|weeks?|months?|times?))?/i)
      if (durationMatch && durationMatch[1] && !currentMedicine.duration) {
        currentMedicine.duration = durationMatch[1]
      }
    }
  }
  
  // Add last medicine if exists
  if (currentMedicine && currentMedicine.name) {
    medicines.push(currentMedicine)
  }
  
  // If parsing failed, create one medicine entry with the name from text
  if (medicines.length === 0 && text.trim()) {
    const firstLine = text.split('\n')[0].trim()
    medicines.push({
      name: firstLine || "Medicine",
      dosage: "",
      frequency: "",
      duration: ""
    })
  }
  
  return medicines
}

