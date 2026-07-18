// Helper function to get number emoji
export const getNumberEmoji = (num: number): string => {
  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
  return num <= 10 ? emojis[num - 1] : `${num}.`
}

// Helper function to format medicines as text for storage
export const formatMedicinesAsText = (medicines: Array<{name: string, dosage: string, frequency: string, duration: string}>, notes?: string): string => {
  if (medicines.length === 0) return ""
  
  let prescriptionText = "🧾 *Prescription*\n\n"
  
  medicines.forEach((med, index) => {
    const emoji = getNumberEmoji(index + 1)
    const name = med.name || 'Medicine'
    const dosage = med.dosage ? ` ${med.dosage}` : ''
    
    prescriptionText += `*${emoji} ${name}${dosage}*\n\n`
    
    // Format frequency line
    if (med.frequency) {
      prescriptionText += `• ${med.frequency}\n`
    }
    
    // Format duration line
    if (med.duration) {
      // Ensure "Duration:" prefix is added if not already present
      const durationText = med.duration.toLowerCase().includes('duration:') ? med.duration : `Duration: ${med.duration}`
      prescriptionText += `• ${durationText}\n`
    }
    
    prescriptionText += `\n`
  })
  
  // Add advice section if notes are provided
  if (notes && notes.trim()) {
    prescriptionText += `📌 *Advice:* ${notes.trim()}\n`
  }
  
  return prescriptionText.trim()
}

