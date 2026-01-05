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
  
  // X-ray patterns
  if (lowerName.includes('xray') || lowerName.includes('x-ray') || lowerName.includes('x_ray') || 
      lowerName.includes('radiograph') || lowerName.endsWith('.dcm')) {
    return "x-ray"
  }
  
  // Lab report patterns
  if (lowerName.includes('lab') || lowerName.includes('laboratory') || 
      lowerName.includes('test') || lowerName.includes('blood') || 
      lowerName.includes('urine') || lowerName.includes('pathology')) {
    return "lab-report"
  }
  
  // MRI patterns (check before generic scan)
  if (lowerName.includes('mri') || lowerName.includes('magnetic resonance')) {
    return "mri"
  }
  
  // CT scan patterns (check before generic scan)
  if (lowerName.includes('ct') || lowerName.includes('cat') || 
      lowerName.includes('computed tomography')) {
    return "ct-scan"
  }
  
  // Ultrasound patterns
  if (lowerName.includes('ultrasound') || lowerName.includes('sonography')) {
    return "ultrasound"
  }
  
  // Generic scan patterns (check last)
  if (lowerName.includes('scan')) {
    return "scan"
  }
  
  // ECG patterns
  if (lowerName.includes('ecg') || lowerName.includes('ekg') || 
      lowerName.includes('electrocardiogram')) {
    return "ecg"
  }
  
  // Report patterns (generic)
  if (lowerName.includes('report') || lowerName.includes('result') || 
      lowerName.includes('findings')) {
    return "report"
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
  
  // X-ray patterns
  if (lowerText.includes('xray') || lowerText.includes('x-ray') || 
      lowerText.includes('x_ray') || lowerText.includes('radiograph') ||
      lowerText.includes('radiography')) {
    return "x-ray"
  }
  
  // Lab report patterns
  if (lowerText.includes('lab') || lowerText.includes('laboratory') || 
      lowerText.includes('test') || lowerText.includes('blood test') ||
      lowerText.includes('urine test') || lowerText.includes('pathology') ||
      lowerText.includes('lab report') || lowerText.includes('test report')) {
    return "lab-report"
  }
  
  // MRI patterns (check before generic scan)
  if (lowerText.includes('mri') || lowerText.includes('magnetic resonance')) {
    return "mri"
  }
  
  // CT scan patterns (check before generic scan)
  if (lowerText.includes('ct scan') || lowerText.includes('ct-scan') || 
      lowerText.includes('cat scan') || lowerText.includes('computed tomography')) {
    return "ct-scan"
  }
  
  // Ultrasound patterns
  if (lowerText.includes('ultrasound') || lowerText.includes('sonography') ||
      lowerText.includes('sonogram')) {
    return "ultrasound"
  }
  
  // ECG patterns
  if (lowerText.includes('ecg') || lowerText.includes('ekg') || 
      lowerText.includes('electrocardiogram')) {
    return "ecg"
  }
  
  // Generic scan patterns (check last)
  if (lowerText.includes('scan')) {
    return "scan"
  }
  
  // Report patterns (generic)
  if (lowerText.includes('report') || lowerText.includes('result') || 
      lowerText.includes('findings') || lowerText.includes('medical report')) {
    return "report"
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
      constructor(init?: string | number[]) {
        // Stub implementation
      }
      static fromMatrix(other?: any) { return new DOMMatrix() }
      static fromFloat32Array(array: Float32Array) { return new DOMMatrix() }
      static fromFloat64Array(array: Float64Array) { return new DOMMatrix() }
    }
  }
  
  // Polyfill ImageData - use canvas if available, otherwise stub
  if (!globalThis.ImageData) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ImageData: CanvasImageData } = require('canvas')
      globalThis.ImageData = CanvasImageData
    } catch (e) {
      // Fallback stub
      (globalThis as any).ImageData = class ImageData {
        constructor(public data: Uint8ClampedArray, public width: number, public height?: number) {}
      }
    }
  }
  
  // Polyfill Path2D - simple stub
  if (!globalThis.Path2D) {
    (globalThis as any).Path2D = class Path2D {
      constructor(path?: string | Path2D) {}
      addPath(path: Path2D, transform?: any) {}
      closePath() {}
      moveTo(x: number, y: number) {}
      lineTo(x: number, y: number) {}
      bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {}
      quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {}
      arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise?: boolean) {}
      arcTo(x1: number, y1: number, x2: number, y2: number, radius: number) {}
      ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, anticlockwise?: boolean) {}
      rect(x: number, y: number, w: number, h: number) {}
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
      } catch (requireError: any) {
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
      } catch (importError: any) {
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
        } catch (requireError: any) {
          throw callError
        }
      } else {
        throw callError
      }
    }
    
    const extractedText = data?.text || data?.Text || ""
    return extractedText
  } catch (error: any) {
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
  
  // MRI patterns (check FIRST - before other patterns, as it's very specific)
  // Use both regex and simple string matching for maximum coverage
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
      return "mri"
    }
  }
  
  // Fallback to simple string matching (handles spacing variations)
  for (const mriString of mriStrings) {
    if (headerSection.includes(mriString)) {
      return "mri"
    }
  }
  
  // Last resort: check if "mri" appears anywhere (very lenient)
  if (/\bmri\b/i.test(headerSection) || headerSection.includes('mri')) {
    return "mri"
  }
  
  // Prescription patterns
  if (headerSection.includes('prescription') || headerSection.includes('rx') || 
      headerSection.includes('medication') || headerSection.includes('medicine')) {
    return "prescription"
  }
  
  // CT scan patterns (check before generic scan)
  if (headerSection.includes('ct scan') || headerSection.includes('computed tomography') ||
      headerSection.includes('cat scan') || headerSection.includes('ct-scan')) {
    return "ct-scan"
  }
  
  // X-ray patterns
  if (headerSection.includes('x-ray') || headerSection.includes('xray') ||
      headerSection.includes('radiograph') || headerSection.includes('radiography')) {
    return "x-ray"
  }
  
  // Ultrasound patterns
  if (headerSection.includes('ultrasound') || headerSection.includes('sonography') ||
      headerSection.includes('usg')) {
    return "ultrasound"
  }
  
  // Lab report patterns
  if (headerSection.includes('lab report') || headerSection.includes('laboratory report') ||
      headerSection.includes('blood test') || headerSection.includes('pathology report') ||
      headerSection.includes('cbc') || headerSection.includes('complete blood count') ||
      headerSection.includes('urine test') || headerSection.includes('biochemistry')) {
    return "lab-report"
  }
  
  // ECG patterns
  if (headerSection.includes('ecg') || headerSection.includes('ekg') ||
      headerSection.includes('electrocardiogram') || headerSection.includes('electrocardiography')) {
    return "ecg"
  }
  
  // Generic scan patterns
  if (headerSection.includes('scan report') || headerSection.includes('scanning')) {
    return "scan"
  }
  
  // Report patterns (generic - check last, but be careful not to match MRI reports)
  // Only match "report" if it's NOT part of "mri report", "ct scan report", etc.
  const hasReport = headerSection.includes('report') || headerSection.includes('findings') ||
      headerSection.includes('diagnosis')
  
  // Only return "report" if we haven't already matched a specific type above
  // This prevents "MRI REPORT" from being classified as just "report"
  if (hasReport && !headerSection.includes('mri') && !headerSection.includes('ct scan') && 
      !headerSection.includes('x-ray') && !headerSection.includes('ultrasound') &&
      !headerSection.includes('lab report') && !headerSection.includes('ecg')) {
    return "report"
  }
  
  // If we found "report" but it's part of a specific type, return null to let filename detection handle it
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
        
        // If content analysis found a specific type (not "other" or "report"), ALWAYS use it
        if (contentType && contentType !== "other" && contentType !== "report") {
          return {
            type: contentType,
            specialty: contentSpecialty || filenameSpecialty,
            source: 'content'
          }
        }
        
        // If content found "report" and filename was "other", use "report"
        if (contentType === "report" && filenameType === "other") {
          return {
            type: "report",
            specialty: contentSpecialty || filenameSpecialty,
            source: 'content'
          }
        }
        
        // If content analysis returned null or "other", but filename gave us something specific, use filename
        if ((!contentType || contentType === "other") && filenameType !== "other" && filenameType !== "report") {
          return {
            type: filenameType,
            specialty: filenameSpecialty,
            source: 'filename'
          }
        }
      }
    } catch (error: any) {
      // Silently fall back to filename detection
    }
  } else {
    // For non-PDFs, use filename detection if it's specific
    if (filenameType !== "other" && filenameType !== "report") {
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
