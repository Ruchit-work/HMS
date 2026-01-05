"use client"

import React, { useState, useRef, useEffect } from 'react'
import { dentalPartsData } from '@/constants/dentalDiseases'

interface InteractiveMouthSVGProps {
  onPartSelect: (partName: string | null, partInfo?: { name: string; description: string }) => void
  selectedPart: string | null
}

// Map SVG text labels to dentalPartsData keys
const textLabelToPart: Record<string, string> = {
  'Gingiva': 'Gums',
  'gingiva': 'Gums',
  'gums': 'Gums',
  'Gums': 'Gums',
  'Teeth': 'Teeth',
  'teeth': 'Teeth',
  'Tooth': 'Teeth',
  'tooth': 'Teeth',
  'Incisor': 'Teeth',
  'incisor': 'Teeth',
  'Incisors': 'Teeth',
  'incisors': 'Teeth',
  'Canine': 'Teeth',
  'canine': 'Teeth',
  'Canines': 'Teeth',
  'canines': 'Teeth',
  'Premolar': 'Teeth',
  'premolar': 'Teeth',
  'Premolars': 'Teeth',
  'premolars': 'Teeth',
  'Molar': 'Teeth',
  'molar': 'Teeth',
  'Molars': 'Teeth',
  'molars': 'Teeth',
  'Tongue': 'Tongue',
  'tongue': 'Tongue',
  'Hard palate': 'Palate',
  'hard palate': 'Palate',
  'Hard Palate': 'Palate',
  'Soft palate': 'Palate',
  'soft palate': 'Soft Palate',
  'Soft Palate': 'Palate',
  'Palate': 'Palate',
  'palate': 'Palate',
  'Uvula': 'Palate',
  'uvula': 'Palate',
  'Mandible': 'Mandible',
  'mandible': 'Mandible',
  'Lower jaw': 'Mandible',
  'lower jaw': 'Mandible',
  'Jaw': 'Mandible',
  'jaw': 'Mandible',
  'Oral mucosa': 'Oral_Mucosa',
  'oral mucosa': 'Oral_Mucosa',
  'Oral Mucosa': 'Oral_Mucosa',
  'Mucosa': 'Oral_Mucosa',
  'mucosa': 'Oral_Mucosa',
  'Lips': 'Oral_Mucosa',
  'lips': 'Oral_Mucosa',
  'Lip': 'Oral_Mucosa',
  'lip': 'Oral_Mucosa',
  'Salivary glands': 'Salivary_Glands',
  'salivary glands': 'Salivary_Glands',
  'Salivary Glands': 'Salivary_Glands',
  'Salivary gland': 'Salivary_Glands',
  'salivary gland': 'Salivary_Glands',
  'Wisdom teeth': 'Wisdom_Teeth',
  'wisdom teeth': 'Wisdom_Teeth',
  'Wisdom Teeth': 'Wisdom_Teeth',
  'Third molars': 'Wisdom_Teeth',
  'third molars': 'Wisdom_Teeth',
  'Third Molars': 'Wisdom_Teeth',
}

export default function InteractiveMouthSVG({ onPartSelect, selectedPart }: InteractiveMouthSVGProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredPart, setHoveredPart] = useState<string | null>(null)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const hitAreaRefs = useRef<Map<SVGRectElement, string>>(new Map())

  // Load SVG content
  useEffect(() => {
    fetch('/images/ear/Illu_mouth.svg')
      .then(res => res.text())
      .then(text => setSvgContent(text))
      .catch(() => {
        // Ignore SVG load errors
      })
  }, [])

  // Get full text content
  const getFullTextContent = (element: SVGTextElement): string => {
    let content = (element.textContent || '').trim()
    content = content.replace(/\s+/g, ' ')
    return content
  }

  // Find part name from text
  const findPartNameFromText = (textContent: string): string | null => {
    const normalizedText = textContent.trim().toLowerCase()
    
    // Direct match
    if (textLabelToPart[textContent]) {
      return textLabelToPart[textContent]
    }
    
    // Case-insensitive match
    if (textLabelToPart[normalizedText]) {
      return textLabelToPart[normalizedText]
    }
    
    // Partial match
    for (const [label, partName] of Object.entries(textLabelToPart)) {
      if (normalizedText.includes(label.toLowerCase()) || label.toLowerCase().includes(normalizedText)) {
        return partName
      }
    }
    
    return null
  }

  // Process SVG and make parts interactive
  useEffect(() => {
    if (!svgContent || !containerRef.current) return

    const container = containerRef.current
    const svgElement = container.querySelector('svg')
    if (!svgElement) return

    const interactiveElements = new Map<SVGElement, string>()
    const cleanupFunctions: (() => void)[] = []

    // Process text elements
    const processTextElements = () => {
      const textElements = svgElement.querySelectorAll('text')
      
      textElements.forEach((textElement) => {
        const text = textElement as SVGTextElement
        const textContent = getFullTextContent(text)
        if (!textContent) return

        const partName = findPartNameFromText(textContent)
        if (!partName || !dentalPartsData[partName]) return

        interactiveElements.set(text, partName)

        try {
          const bbox = text.getBBox()
          if (bbox.width === 0 || bbox.height === 0) return

          // Create hit area rectangle
          const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
          hitArea.setAttribute('x', String(bbox.x - 5))
          hitArea.setAttribute('y', String(bbox.y - 5))
          hitArea.setAttribute('width', String(bbox.width + 10))
          hitArea.setAttribute('height', String(bbox.height + 10))
          hitArea.setAttribute('fill', 'transparent')
          hitArea.setAttribute('stroke', 'none')
          hitArea.setAttribute('pointer-events', 'all')
          hitArea.style.cursor = 'pointer'

          // Insert hit area at the end of SVG (highest z-index)
          svgElement.appendChild(hitArea)
          hitAreaRefs.current.set(hitArea, partName)

          // Click handler on hit area
          const clickHandler = (e: MouseEvent) => {
            e.stopPropagation()
            e.preventDefault()
            
            const partData = dentalPartsData[partName]
            if (partData) {
              onPartSelect(partName, {
                name: partData.partName,
                description: partData.description
              })
            }
          }

          hitArea.addEventListener('click', clickHandler)
          cleanupFunctions.push(() => {
            hitArea.removeEventListener('click', clickHandler)
            if (hitArea.parentElement) {
              svgElement.removeChild(hitArea)
            }
          })

          // Also add click handler directly to text element
          const textClickHandler = (e: MouseEvent) => {
            e.stopPropagation()
            e.preventDefault()
            
            const partData = dentalPartsData[partName]
            if (partData) {
              onPartSelect(partName, {
                name: partData.partName,
                description: partData.description
              })
            }
          }

          text.addEventListener('click', textClickHandler)
          cleanupFunctions.push(() => {
            text.removeEventListener('click', textClickHandler)
          })

          // Hover handlers on hit area
          const mouseEnterHandler = () => {
            if (selectedPart !== partName) {
              setHoveredPart(partName)
            }
          }

          const mouseLeaveHandler = () => {
            setHoveredPart(null)
          }

          hitArea.addEventListener('mouseenter', mouseEnterHandler)
          hitArea.addEventListener('mouseleave', mouseLeaveHandler)
          text.addEventListener('mouseenter', mouseEnterHandler)
          text.addEventListener('mouseleave', mouseLeaveHandler)
          cleanupFunctions.push(() => {
            hitArea.removeEventListener('mouseenter', mouseEnterHandler)
            hitArea.removeEventListener('mouseleave', mouseLeaveHandler)
            text.removeEventListener('mouseenter', mouseEnterHandler)
            text.removeEventListener('mouseleave', mouseLeaveHandler)
          })
        } catch (e) {
          // Skip if text doesn't have valid bbox
        }
      })
    }

    // Disable all paths (arrows) - not clickable
    const disablePaths = () => {
      const allPaths = svgElement.querySelectorAll('path')
      allPaths.forEach((pathElement) => {
        const path = pathElement as SVGPathElement
        path.setAttribute('pointer-events', 'none')
      })
    }

    // Wait for SVG to render
    const timeoutId = setTimeout(() => {
      processTextElements()
      disablePaths()
    }, 100)

    // Update highlights (only for text elements)
    const updateHighlights = () => {
      interactiveElements.forEach((partName, element) => {
        if (element.tagName === 'text') {
          const text = element as SVGTextElement
          const originalFill = text.getAttribute('data-original-fill') || text.getAttribute('fill') || '#000'
          if (!text.getAttribute('data-original-fill')) {
            text.setAttribute('data-original-fill', originalFill)
          }

          if (partName === selectedPart) {
            text.setAttribute('fill', '#10b981')
            text.style.fontWeight = 'bold'
            text.style.fontSize = '1.1em'
          } else if (partName === hoveredPart) {
            text.setAttribute('fill', '#3b82f6')
            text.style.fontWeight = 'bold'
          } else {
            text.setAttribute('fill', originalFill)
            text.style.fontWeight = 'normal'
            text.style.fontSize = ''
          }

          const tspans = text.querySelectorAll('tspan')
          tspans.forEach(tspan => {
            const tspanElement = tspan as SVGTextElement
            if (!tspanElement.getAttribute('data-original-fill')) {
              const tspanFill = tspanElement.getAttribute('fill') || originalFill
              tspanElement.setAttribute('data-original-fill', tspanFill)
            }

            if (partName === selectedPart) {
              tspanElement.setAttribute('fill', '#10b981')
              tspanElement.style.fontWeight = 'bold'
            } else if (partName === hoveredPart) {
              tspanElement.setAttribute('fill', '#3b82f6')
              tspanElement.style.fontWeight = 'bold'
            } else {
              const tspanOriginalFill = tspanElement.getAttribute('data-original-fill') || originalFill
              tspanElement.setAttribute('fill', tspanOriginalFill)
              tspanElement.style.fontWeight = 'normal'
            }
          })
        }
      })
    }

    updateHighlights()

    return () => {
      clearTimeout(timeoutId)
      cleanupFunctions.forEach(cleanup => cleanup())
      hitAreaRefs.current.clear()
    }
  }, [svgContent, selectedPart, hoveredPart, onPartSelect])

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === containerRef.current || (e.target as Element).tagName === 'svg') {
      onPartSelect(null)
    }
  }

  if (!svgContent) {
    return (
      <div className="w-full h-full bg-white rounded-lg flex items-center justify-center" style={{ minHeight: '600px' }}>
        <div className="text-slate-500">Loading SVG diagram...</div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-white rounded-lg overflow-auto"
      onClick={handleContainerClick}
      style={{ minHeight: '600px' }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  )
}


