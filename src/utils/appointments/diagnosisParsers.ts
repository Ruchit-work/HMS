// Parse clinical suggestion text into structured sections for display and notes

const NOT_GENERATED = /^not generated\.?$/i

const isMeaningful = (value: string) => {
  const trimmed = value.trim()
  return trimmed.length > 0 && !NOT_GENERATED.test(trimmed)
}

const extractSection = (text: string, headingPattern: RegExp): string => {
  const match = text.match(headingPattern)
  return match?.[1]?.trim() ?? ''
}

export const parseAIDiagnosis = (text: string) => {
  const normalized = (text || '').trim()
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
    notes: '',
  }

  if (!normalized) return sections

  sections.diagnosis = extractSection(
    normalized,
    /\*\*(?:PRELIMINARY\s+)?DIAGNOSIS:?\*\*\s*([\s\S]*?)(?=\*\*[A-Z]|\n##|\n---|$)/i
  )
  if (!sections.diagnosis) {
    sections.diagnosis = extractSection(
      normalized,
      /(?:^|\n)\s*(?:PRELIMINARY\s+)?DIAGNOSIS:\s*([\s\S]*?)(?=\n\s*(?:RECOMMENDED|TREATMENT|WHEN TO SEEK|ADDITIONAL|IMPORTANT|---|\*\*)|$)/im
    )
  }

  const testsBlock = extractSection(
    normalized,
    /\*\*RECOMMENDED\s+TESTS:?\*\*\s*([\s\S]*?)(?=\*\*[A-Z]|\n##|\n---|$)/i
  ) || extractSection(
    normalized,
    /(?:^|\n)\s*RECOMMENDED\s+TESTS:\s*([\s\S]*?)(?=\n\s*(?:TREATMENT|WHEN TO SEEK|ADDITIONAL|IMPORTANT|---|\*\*)|$)/im
  )
  if (testsBlock) {
    const numbered = testsBlock.match(/^\s*\d+\.\s*(.+)$/gm)
    if (numbered?.length) {
      sections.tests = numbered
        .map((line) => line.replace(/^\s*\d+\.\s*/, '').trim())
        .filter(isMeaningful)
    } else {
      sections.tests = testsBlock
        .split(/\n+/)
        .map((line) => line.replace(/^[-*•]\s*/, '').trim())
        .filter(isMeaningful)
    }
  }

  sections.treatment = extractSection(
    normalized,
    /\*\*TREATMENT\s+RECOMMENDATIONS?:?\*\*\s*([\s\S]*?)(?=\*\*[A-Z]|\n##|\n---|$)/i
  )
  if (!sections.treatment) {
    sections.treatment = extractSection(
      normalized,
      /(?:^|\n)\s*TREATMENT\s+RECOMMENDATIONS?:\s*([\s\S]*?)(?=\n\s*(?:WHEN TO SEEK|ADDITIONAL|IMPORTANT|---|\*\*)|$)/im
    )
  }

  sections.urgent = extractSection(
    normalized,
    /\*\*WHEN\s+TO\s+SEEK\s+(?:IMMEDIATE\s+)?CARE:?\*\*\s*([\s\S]*?)(?=\*\*[A-Z]|\n##|\n---|$)/i
  )
  if (!sections.urgent) {
    sections.urgent = extractSection(
      normalized,
      /(?:^|\n)\s*WHEN\s+TO\s+SEEK\s+(?:IMMEDIATE\s+)?CARE:\s*([\s\S]*?)(?=\n\s*(?:ADDITIONAL|IMPORTANT|---|\*\*)|$)/im
    )
  }

  sections.notes = extractSection(
    normalized,
    /\*\*ADDITIONAL\s+NOTES:?\*\*\s*([\s\S]*?)(?=\*\*[A-Z]|\n##|\n---|$)/i
  )
  if (!sections.notes) {
    sections.notes = extractSection(
      normalized,
      /(?:^|\n)\s*ADDITIONAL\s+NOTES:\s*([\s\S]*?)(?=\n\s*---|\n\n\*Note|$)/im
    )
  }

  return sections
}

/** Plain-text summary for consultation notes from clinical suggestion output. */
export function formatAIDiagnosisForNotes(text: string): string {
  const trimmed = (text || '').trim()
  if (!trimmed) return ''

  const p = parseAIDiagnosis(trimmed)
  const parts: string[] = []

  if (isMeaningful(p.diagnosis)) parts.push(`Preliminary diagnosis: ${p.diagnosis}`)
  if (p.tests.length > 0) {
    parts.push(`Recommended tests:\n${p.tests.map((t, i) => `${i + 1}. ${t}`).join('\n')}`)
  }
  if (isMeaningful(p.treatment)) parts.push(`Treatment recommendations: ${p.treatment}`)
  if (isMeaningful(p.urgent)) parts.push(`When to seek immediate care: ${p.urgent}`)
  if (isMeaningful(p.notes)) parts.push(`Additional notes: ${p.notes}`)

  const structured = parts.join('\n\n').trim()
  if (structured) return structured

  // Fallback: use full response (API format may vary)
  return trimmed.replace(/\*\*/g, '')
}
