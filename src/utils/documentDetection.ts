import { DocumentType } from "@/types/document"

/**
 * Detect document type from filename
 */
export function detectDocumentType(fileName: string): DocumentType {
  const lowerName = fileName.toLowerCase()
  
  // Prescription patterns
  if (lowerName.includes('prescription') || lowerName.includes('presc') || lowerName.includes('rx')) {
    return "prescription"
  }

  // Laboratory reports: blood/urine tests, pathology, lab results
  if (
    lowerName.includes('lab') ||
    lowerName.includes('laboratory') ||
    lowerName.includes('blood test') ||
    lowerName.includes('urine') ||
    lowerName.includes('pathology') ||
    lowerName.includes('cbc') ||
    lowerName.includes('biochemistry') ||
    lowerName.includes('hba1c') ||
    lowerName.includes('lipid profile')
  ) {
    return "laboratory-report"
  }

  // Cardiology reports: ECG/EKG, echo, treadmill, angiography, cardiac
  if (
    lowerName.includes('ecg') ||
    lowerName.includes('ekg') ||
    lowerName.includes('electrocardiogram') ||
    lowerName.includes('echo') ||
    lowerName.includes('2d echo') ||
    lowerName.includes('tmt') ||
    lowerName.includes('stress test') ||
    lowerName.includes('angiography') ||
    lowerName.includes('cardio') ||
    lowerName.includes('cardiac') ||
    lowerName.includes('holter')
  ) {
    return "cardiology-report"
  }

  // Radiology reports: X‑ray, CT, MRI, ultrasound and imaging scans
  if (
    lowerName.includes('xray') ||
    lowerName.includes('x-ray') ||
    lowerName.includes('x_ray') ||
    lowerName.includes('radiograph') ||
    lowerName.includes('radiology') ||
    lowerName.includes('imaging') ||
    lowerName.includes('scan') ||
    lowerName.includes('ct') ||
    lowerName.includes('cat scan') ||
    lowerName.includes('computed tomography') ||
    lowerName.includes('mri') ||
    lowerName.includes('magnetic resonance') ||
    lowerName.includes('ultrasound') ||
    lowerName.includes('sonography') ||
    lowerName.endsWith('.dcm')
  ) {
    return "radiology-report"
  }
  
  // Default to "other" if no pattern matches
  return "other"
}

/**
 * Detect specialty from filename
 */
export function detectSpecialty(fileName: string): string | undefined {
  const lowerName = fileName.toLowerCase()
  
  // ENT patterns
  if (lowerName.includes('ent') || lowerName.includes('ear') || 
      lowerName.includes('nose') || lowerName.includes('throat') ||
      lowerName.includes('otolaryngology')) {
    return "ENT"
  }
  
  // Cardiology patterns
  if (lowerName.includes('cardio') || lowerName.includes('heart') || 
      lowerName.includes('ecg') || lowerName.includes('ekg')) {
    return "Cardiology"
  }
  
  // Orthopedics patterns
  if (lowerName.includes('ortho') || lowerName.includes('bone') || 
      lowerName.includes('fracture') || lowerName.includes('joint')) {
    return "Orthopedics"
  }
  
  // Neurology patterns
  if (lowerName.includes('neuro') || lowerName.includes('brain') || 
      lowerName.includes('mri') || lowerName.includes('neurological')) {
    return "Neurology"
  }
  
  // Ophthalmology patterns
  if (lowerName.includes('eye') || lowerName.includes('ophthal') || 
      lowerName.includes('vision') || lowerName.includes('retina')) {
    return "Ophthalmology"
  }
  
  // Dermatology patterns
  if (lowerName.includes('derma') || lowerName.includes('skin')) {
    return "Dermatology"
  }
  
  // Gastroenterology patterns
  if (lowerName.includes('gastro') || lowerName.includes('stomach') || 
      lowerName.includes('liver') || lowerName.includes('endoscopy')) {
    return "Gastroenterology"
  }
  
  // Urology patterns
  if (lowerName.includes('uro') || lowerName.includes('kidney') || 
      lowerName.includes('urine')) {
    return "Urology"
  }
  
  // Gynecology patterns
  if (lowerName.includes('gyne') || lowerName.includes('gynae') || 
      lowerName.includes('obstetric') || lowerName.includes('pregnancy')) {
    return "Gynecology"
  }
  
  // Pediatrics patterns
  if (lowerName.includes('pediatric') || lowerName.includes('paediatric') || 
      lowerName.includes('child')) {
    return "Pediatrics"
  }
  
  return undefined // Return undefined if no specialty detected
}

/**
 * Detect document type from message text (for WhatsApp images/documents)
 * Uses keyword matching similar to filename detection
 */
export function detectDocumentTypeFromText(text: string): DocumentType {
  const lowerText = text.toLowerCase()
  
  // Prescription patterns
  if (lowerText.includes('prescription') || lowerText.includes('presc') || 
      lowerText.includes('rx') || lowerText.includes('medication') ||
      lowerText.includes('medicine') || lowerText.includes('drug')) {
    return "prescription"
  }
  
  // Laboratory report patterns
  if (
    lowerText.includes('lab') ||
    lowerText.includes('laboratory') ||
    lowerText.includes('blood test') ||
    lowerText.includes('urine test') ||
    lowerText.includes('pathology') ||
    lowerText.includes('lab report') ||
    lowerText.includes('test report') ||
    lowerText.includes('cbc') ||
    lowerText.includes('biochemistry')
  ) {
    return "laboratory-report"
  }

  // Cardiology report patterns
  if (
    lowerText.includes('ecg') ||
    lowerText.includes('ekg') ||
    lowerText.includes('electrocardiogram') ||
    lowerText.includes('cardio') ||
    lowerText.includes('cardiac') ||
    lowerText.includes('echo') ||
    lowerText.includes('2d echo') ||
    lowerText.includes('tmt') ||
    lowerText.includes('stress test') ||
    lowerText.includes('angiography') ||
    lowerText.includes('holter')
  ) {
    return "cardiology-report"
  }

  // Radiology report patterns
  if (
    lowerText.includes('xray') ||
    lowerText.includes('x-ray') ||
    lowerText.includes('x_ray') ||
    lowerText.includes('radiograph') ||
    lowerText.includes('radiography') ||
    lowerText.includes('radiology') ||
    lowerText.includes('imaging') ||
    lowerText.includes('mri') ||
    lowerText.includes('magnetic resonance') ||
    lowerText.includes('ct scan') ||
    lowerText.includes('ct-scan') ||
    lowerText.includes('cat scan') ||
    lowerText.includes('computed tomography') ||
    lowerText.includes('ultrasound') ||
    lowerText.includes('sonography') ||
    lowerText.includes('sonogram') ||
    lowerText.includes('scan')
  ) {
    return "radiology-report"
  }
  
  // Default to "other" if no pattern matches
  return "other"
}

/**
 * Validate file type (MIME type and extension)
 */
export function validateFileType(file: File): { valid: boolean; error?: string } {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf',
    'application/dicom',
    'application/dicom+xml',
    'image/dicom',
  ]
  
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.dcm']
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
  
  if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${allowedExtensions.join(', ')}`
    }
  }
  
  return { valid: true }
}

/**
 * Validate file size
 * PDFs: 1KB to 20MB
 * Images: 50KB to 20MB
 * Other files: 2MB to 10MB
 */
export function validateFileSize(file: File): { valid: boolean; error?: string } {
  const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  const isImage = file.type?.startsWith('image/') || 
                  ['.jpg', '.jpeg', '.png'].some(ext => file.name.toLowerCase().endsWith(ext))
  
  let minSize: number
  let maxSize: number
  let minSizeLabel: string
  let maxSizeLabel: string
  
  if (isPDF) {
    minSize = 1 * 1024 // 1KB
    maxSize = 20 * 1024 * 1024 // 20MB
    minSizeLabel = "1KB"
    maxSizeLabel = "20MB"
  } else if (isImage) {
    minSize = 50 * 1024 // 50KB
    maxSize = 20 * 1024 * 1024 // 20MB
    minSizeLabel = "50KB"
    maxSizeLabel = "20MB"
  } else {
    minSize = 2 * 1024 * 1024 // 2MB
    maxSize = 10 * 1024 * 1024 // 10MB
    minSizeLabel = "2MB"
    maxSizeLabel = "10MB"
  }
  
  if (file.size < minSize) {
    return {
      valid: false,
      error: `File size too small. Minimum size: ${minSizeLabel}`
    }
  }
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size too large. Maximum size: ${maxSizeLabel}`
    }
  }
  
  return { valid: true }
}

/**
 * Get file extension from filename
 */
export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot === -1) return ''
  return fileName.substring(lastDot).toLowerCase()
}

/**
 * Generate a safe filename (sanitize and add timestamp)
 */
export function generateSafeFileName(originalFileName: string, patientId: string): string {
  // Remove extension
  const lastDot = originalFileName.lastIndexOf('.')
  const nameWithoutExt = lastDot > 0 ? originalFileName.substring(0, lastDot) : originalFileName
  const extension = lastDot > 0 ? originalFileName.substring(lastDot) : ''
  
  // Sanitize filename (remove special characters, keep alphanumeric, dash, underscore)
  const sanitized = nameWithoutExt
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .substring(0, 50) // Limit length
  
  // Add timestamp and patient ID for uniqueness
  const timestamp = Date.now()
  return `${patientId}_${sanitized}_${timestamp}${extension}`
}

/**
 * Extract text from PDF buffer (first 2 pages for performance)
 */
// Apply polyfills at module level so they're available when pdf-parse loads
if (typeof globalThis !== 'undefined') {
  // Polyfill DOMMatrix - simple stub
  if (!globalThis.DOMMatrix) {
    (globalThis as any).DOMMatrix = class DOMMatrix {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(..._args: any[]) {
        // Stub implementation
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      static fromMatrix(..._args: any[]) { return new DOMMatrix() }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      static fromFloat32Array(..._args: any[]) { return new DOMMatrix() }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      static fromFloat64Array(..._args: any[]) { return new DOMMatrix() }
    }
  }
  
  // Polyfill ImageData - use canvas if available, otherwise stub
  if (!globalThis.ImageData) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ImageData: CanvasImageData } = require('canvas')
      globalThis.ImageData = CanvasImageData
    } catch {
      // Fallback stub
      (globalThis as any).ImageData = class ImageData {
        constructor(public data: Uint8ClampedArray, public width: number, public height?: number) {}
      }
    }
  }
  
  // Polyfill Path2D - simple stub
  if (!globalThis.Path2D) {
    (globalThis as any).Path2D = class Path2D {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(..._args: any[]) {}
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      addPath(..._args: any[]) {}
      closePath() {}
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      moveTo(..._args: any[]) {}
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      lineTo(..._args: any[]) {}
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      bezierCurveTo(..._args: any[]) {}
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      quadraticCurveTo(..._args: any[]) {}
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      arc(..._args: any[]) {}
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      arcTo(..._args: any[]) {}
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ellipse(..._args: any[]) {}
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      rect(..._args: any[]) {}
    }
  }
}

export async function extractPdfText(pdfBuffer: Buffer, maxPages: number = 2): Promise<string> {
  try {
    // Polyfills are applied at module level (above) before pdf-parse loads
    let pdfParse: any = null
    
    // Method 1: Try require() first (CommonJS - gives us the actual function)
    // IMPORTANT: Polyfills must be applied BEFORE requiring pdf-parse
    if (typeof require !== 'undefined') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const required = require("pdf-parse")
        
        if (typeof required === 'function') {
          pdfParse = required
        } else if (required.default && typeof required.default === 'function') {
          pdfParse = required.default
        } else if (required.PDFParse) {
          if (typeof required.PDFParse.parse === 'function') {
            pdfParse = required.PDFParse.parse.bind(required.PDFParse)
          } else {
            pdfParse = async (buffer: Buffer, options: any) => {
              const parser = new required.PDFParse({ data: buffer, ...options })
              const result = await parser.getText()
              return { text: result.text || result }
            }
          }
        } else {
          pdfParse = required
        }
      } catch {
        // Silently fail and try next method
      }
    }
    
    // Method 2: Skip createRequire to avoid build-time module resolution issues
    // The require() method above should work in Node.js environments
    
    // Method 3: Try dynamic import if require() didn't work
    if (!pdfParse || typeof pdfParse !== 'function') {
      try {
        const pdfParseModule = await import("pdf-parse")
        const moduleAny = pdfParseModule as any
        
        if (moduleAny.PDFParse && typeof moduleAny.PDFParse === 'function') {
          pdfParse = moduleAny.PDFParse
        } else if (moduleAny.default && typeof moduleAny.default === 'function') {
          pdfParse = moduleAny.default
        } else if (moduleAny.pdfParse && typeof moduleAny.pdfParse === 'function') {
          pdfParse = moduleAny.pdfParse
        } else if (typeof moduleAny === 'function') {
          pdfParse = moduleAny
        } else {
          const excludedKeys = ['AbortException', 'FormatError', 'InvalidPDFException', 
                               'PasswordException', 'ResponseException', 'UnknownErrorException',
                               'Line', 'LineDirection', 'LineStore', 'Rectangle', 'Shape', 
                               'Table', 'Point', 'VerbosityLevel', 'getException']
          
          if (moduleAny.PDFParse && typeof moduleAny.PDFParse === 'function') {
            pdfParse = moduleAny.PDFParse
          } else {
            for (const key in moduleAny) {
              if (excludedKeys.includes(key)) continue
              
              const func = moduleAny[key]
              if (typeof func === 'function') {
                if (key === 'PDFParse') {
                  pdfParse = func
                  break
                }
                if (!pdfParse) {
                  pdfParse = func
                }
              }
            }
          }
        }
      } catch {
        // Silently fail
      }
    }
    
    if (!pdfParse) {
      return ""
    }
    
    let data: any
    try {
      const isClass = typeof pdfParse === 'function' && 
                     pdfParse.prototype && 
                     pdfParse.prototype.constructor === pdfParse &&
                     pdfParse.name === 'PDFParse'
      
      if (isClass) {
        const parser = new pdfParse({ 
          data: pdfBuffer,
          verbosity: 0
        })
        
        const textResult = await parser.getText({ 
          first: 0,
          last: maxPages > 0 ? maxPages : undefined,
          partial: []
        })
        
        data = { text: textResult.text || textResult }
      } else if (typeof pdfParse === 'function') {
        data = await pdfParse(pdfBuffer, {
          max: maxPages,
        })
      } else {
        throw new Error("pdfParse is neither a class nor a function")
      }
    } catch (callError: any) {
      if (callError.message?.includes('cannot be invoked without') || 
          callError.message?.includes('Class constructor') ||
          callError.message?.includes('is not a constructor')) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const pdfParseLib = require("pdf-parse")
          const PDFParseClass = pdfParseLib.PDFParse || pdfParseLib.default?.PDFParse || pdfParseLib
          
          if (PDFParseClass && typeof PDFParseClass === 'function') {
            const parser = new PDFParseClass({ data: pdfBuffer, verbosity: 0 })
            const textResult = await parser.getText({ first: 0, last: maxPages })
            data = { text: textResult.text || textResult }
          } else {
            throw new Error("Could not find PDFParse class")
          }
        } catch {
          throw callError
        }
      } else {
        throw callError
      }
    }
    
    const extractedText = data?.text || data?.Text || ""
    return extractedText
  } catch {
    // Return empty string on error - don't throw, just fail silently
    return ""
  }
}

/**
 * Detect document type from PDF content (text analysis)
 * Searches for keywords in headers and content
 */
export function detectDocumentTypeFromContent(content: string): DocumentType | null {
  if (!content || content.trim().length === 0) {
    return null
  }

  const lowerContent = content.toLowerCase()
  const headerSection = lowerContent.substring(0, 3000)
  
  // MRI patterns (used as part of radiology-report detection)
  const mriPatterns = [
    /\bmri\b/i,  // "MRI" as a word
    /mri\s+of\s+the/i,  // "MRI OF THE"
    /mri\s+report/i,  // "MRI REPORT"
    /mri\s+brain/i,  // "MRI BRAIN"
    /mri\s+scan/i,  // "MRI SCAN"
    /mri\s+without/i,  // "MRI WITHOUT"
    /mri\s+with/i,  // "MRI WITH"
    /magnetic\s+resonance\s+imaging/i,  // "MAGNETIC RESONANCE IMAGING"
    /magnetic\s+resonance/i,  // "MAGNETIC RESONANCE"
  ]
  
  // Also check simple string includes (more lenient with spacing)
  const mriStrings = [
    'mri of the',
    'mri report',
    'mri brain',
    'mri scan',
    'mri without',
    'mri with',
    'magnetic resonance imaging',
    'magnetic resonance',
  ]
  
  // Try regex patterns first (more precise)
  for (const pattern of mriPatterns) {
    if (pattern.test(headerSection)) {
      return "radiology-report"
    }
  }
  
  // Fallback to simple string matching (handles spacing variations)
  for (const mriString of mriStrings) {
    if (headerSection.includes(mriString)) {
      return "radiology-report"
    }
  }
  
  // Last resort: check if "mri" appears anywhere (very lenient)
  if (/\bmri\b/i.test(headerSection) || headerSection.includes('mri')) {
    return "radiology-report"
  }
  
  // Prescription patterns
  if (headerSection.includes('prescription') || headerSection.includes('rx') || 
      headerSection.includes('medication') || headerSection.includes('medicine')) {
    return "prescription"
  }
  
  // CT scan patterns (radiology)
  if (headerSection.includes('ct scan') || headerSection.includes('computed tomography') ||
      headerSection.includes('cat scan') || headerSection.includes('ct-scan')) {
    return "radiology-report"
  }
  
  // X-ray patterns (radiology)
  if (headerSection.includes('x-ray') || headerSection.includes('xray') ||
      headerSection.includes('radiograph') || headerSection.includes('radiography')) {
    return "radiology-report"
  }
  
  // Ultrasound patterns (radiology)
  if (headerSection.includes('ultrasound') || headerSection.includes('sonography') ||
      headerSection.includes('usg')) {
    return "radiology-report"
  }
  
  // Lab report patterns (laboratory-report)
  if (headerSection.includes('lab report') || headerSection.includes('laboratory report') ||
      headerSection.includes('blood test') || headerSection.includes('pathology report') ||
      headerSection.includes('cbc') || headerSection.includes('complete blood count') ||
      headerSection.includes('urine test') || headerSection.includes('biochemistry')) {
    return "laboratory-report"
  }
  
  // ECG patterns (cardiology-report)
  if (headerSection.includes('ecg') || headerSection.includes('ekg') ||
      headerSection.includes('electrocardiogram') || headerSection.includes('electrocardiography')) {
    return "cardiology-report"
  }
  
  // Generic "report" wording without specific hints – let filename decide
  const hasReport =
    headerSection.includes('report') ||
    headerSection.includes('result') ||
    headerSection.includes('findings') ||
    headerSection.includes('diagnosis')

  if (hasReport) {
    return null
  }
  
  return null
}

/**
 * Detect specialty from PDF content
 */
export function detectSpecialtyFromContent(content: string): string | undefined {
  if (!content || content.trim().length === 0) {
    return undefined
  }

  const lowerContent = content.toLowerCase()
  const headerSection = lowerContent.substring(0, 2000)
  
  // ENT patterns
  if (headerSection.includes('ent') || headerSection.includes('ear') ||
      headerSection.includes('nose') || headerSection.includes('throat') ||
      headerSection.includes('otolaryngology')) {
    return "ENT"
  }
  
  // Cardiology patterns
  if (headerSection.includes('cardio') || headerSection.includes('heart') ||
      headerSection.includes('cardiac')) {
    return "Cardiology"
  }
  
  // Neurology patterns
  if (headerSection.includes('neuro') || headerSection.includes('brain') ||
      headerSection.includes('neurological')) {
    return "Neurology"
  }
  
  // Orthopedics patterns
  if (headerSection.includes('ortho') || headerSection.includes('bone') ||
      headerSection.includes('fracture') || headerSection.includes('joint')) {
    return "Orthopedics"
  }
  
  // Ophthalmology patterns
  if (headerSection.includes('eye') || headerSection.includes('ophthal') ||
      headerSection.includes('vision') || headerSection.includes('retina')) {
    return "Ophthalmology"
  }
  
  // Dermatology patterns
  if (headerSection.includes('derma') || headerSection.includes('skin')) {
    return "Dermatology"
  }
  
  // Gastroenterology patterns
  if (headerSection.includes('gastro') || headerSection.includes('stomach') ||
      headerSection.includes('liver') || headerSection.includes('endoscopy')) {
    return "Gastroenterology"
  }
  
  // Urology patterns
  if (headerSection.includes('uro') || headerSection.includes('kidney') ||
      headerSection.includes('urine')) {
    return "Urology"
  }
  
  // Gynecology patterns
  if (headerSection.includes('gyne') || headerSection.includes('gynae') ||
      headerSection.includes('obstetric') || headerSection.includes('pregnancy')) {
    return "Gynecology"
  }
  
  return undefined
}

/**
 * Enhanced document type detection: tries filename first, then PDF content
 */
export async function detectDocumentTypeEnhanced(
  fileName: string,
  fileBuffer?: Buffer,
  mimeType?: string
): Promise<{ type: DocumentType; specialty?: string; source: 'filename' | 'content' | 'default' }> {
  // Step 1: Try filename detection first (fast)
  const filenameType = detectDocumentType(fileName)
  const filenameSpecialty = detectSpecialty(fileName)
  
  // Step 2: For PDFs, ALWAYS analyze content to get accurate type
  // This ensures we catch cases like "dnhdnb.pdf" which is actually an MRI report
  if (fileBuffer && mimeType === 'application/pdf') {
    try {
      const pdfText = await extractPdfText(fileBuffer, 2)
      
      if (pdfText && pdfText.trim().length > 0) {
        const contentType = detectDocumentTypeFromContent(pdfText)
        const contentSpecialty = detectSpecialtyFromContent(pdfText)
        
        // If content analysis found a specific type (not "other"), ALWAYS use it
        if (contentType && contentType !== "other") {
          return {
            type: contentType,
            specialty: contentSpecialty || filenameSpecialty,
            source: 'content'
          }
        }

        // If content analysis returned null or "other", but filename gave us something specific, use filename
        if ((!contentType || contentType === "other") && filenameType !== "other") {
          return {
            type: filenameType,
            specialty: filenameSpecialty,
            source: 'filename'
          }
        }
      }
    } catch {
      // Silently fall back to filename detection
    }
  } else {
    // For non-PDFs, use filename detection if it's specific
    if (filenameType !== "other") {
      return {
        type: filenameType,
        specialty: filenameSpecialty,
        source: 'filename'
      }
    }
  }
  
  // Step 3: Fallback to filename detection result
  return {
    type: filenameType,
    specialty: filenameSpecialty,
    source: filenameType !== "other" ? 'filename' : 'default'
  }
}
