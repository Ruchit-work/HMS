"use client"

import React, { useState, useRef, useEffect } from 'react'
import { earPartsData } from '@/constants/earDiseases'

interface InteractiveEarSVGProps {
  onPartSelect: (partName: string | null, partInfo?: { name: string; description: string }) => void
  selectedPart: string | null
}

// Map SVG part IDs to earPartsData keys
const svgPartIdToEarPart: Record<string, string> = {
  'Auriklo': 'Outer_Ear',
  'auriklo': 'Outer_Ear',
  'Ekstera_Okaza_Kanalo': 'Ear_Canal',
  'ekstera_okaza_kanalo': 'Ear_Canal',
  'Timpana_Membrano': 'Eardrum',
  'timpana_membrano': 'Eardrum',
  'timpano': 'Eardrum',
  'martelo': 'Ossicles',
  'martelo_default': 'Ossicles',
  'Inko': 'Ossicles',
  'Inko_default': 'Ossicles',
  'heliko': 'Cochlea',
  'heliko_default': 'Cochlea',
  'Kanaloj_semicirculares': 'Semicircular_Canals',
  'Kanaloj_semicirculares_default': 'Semicircular_Canals',
  'Nervo_coclear': 'Auditory_Nerve',
  'nervo_coclear': 'Auditory_Nerve',
  'Nordo_Vestibular': 'Vestibular_Nerve',
  'Nordo_Vestibular_default': 'Vestibular_Nerve',
  'Ronda_Fenestro': 'Round_Window',
  'Ronda_Fenestro_default': 'Round_Window',
  'piedingo_kunigitaj_al_ovala_fenestro': 'Ossicles',
  'piedingo_kunigitaj_al_ovala_fenestro_default': 'Ossicles',
  'Eustachia_Tubo': 'Ear_Canal',
}

// Map text labels to parts
const textLabelToPart: Record<string, string> = {
  'Vestibular nerve': 'Vestibular_Nerve',
  'Cochlear nerve': 'Auditory_Nerve',
  'Round Window': 'Round_Window',
  'Round window': 'Round_Window',
  'Tympanic cavity': 'Tympanic_Cavity',
  'Tympanic Membrane': 'Eardrum',
  'Tympanic membrane': 'Eardrum',
  'External Auditory Canal': 'Ear_Canal',
  'External auditory canal': 'Ear_Canal',
  'Semicircular canals': 'Semicircular_Canals',
  'Semicircular Canals': 'Semicircular_Canals',
  'Eustachian tube': 'Ear_Canal',
  'Eustachian Tube': 'Ear_Canal',
  'Auditory Nerve': 'Auditory_Nerve',
  'Malleus': 'Ossicles',
  'Incus': 'Ossicles',
  'Stapes': 'Ossicles',
  'Cochlea': 'Cochlea',
  'Eardrum': 'Eardrum',
  'Auricle': 'Outer_Ear',
  'Pinna': 'Outer_Ear',
  'Tympanic': 'Eardrum',
  'Membrane': 'Eardrum',
  'Round': 'Round_Window',
  'Window': 'Round_Window',
  'Vestibular': 'Vestibular_Nerve',
  'Cochlear': 'Auditory_Nerve',
  'External': 'Ear_Canal',
  'Auditory': 'Auditory_Nerve',
  'Eustachian': 'Ear_Canal',
  'Tube': 'Ear_Canal',
  'Semicircular': 'Semicircular_Canals',
  'canals': 'Semicircular_Canals',
  'Nerve': 'Auditory_Nerve',
}

export default function InteractiveEarSVG({ onPartSelect, selectedPart }: InteractiveEarSVGProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredPart, setHoveredPart] = useState<string | null>(null)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const hitAreaRefs = useRef<Map<SVGRectElement, string>>(new Map())

  // Load SVG content
  useEffect(() => {
    fetch('/images/ear/Anatomy_of_the_Human_Ear.svg')
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
    const normalizedText = textContent.trim()
    const lowerText = normalizedText.toLowerCase()
    const cleanText = normalizedText.replace(/\s*\([^)]*\)/g, '').trim()
    const cleanLowerText = cleanText.toLowerCase()

    if (normalizedText && textLabelToPart[normalizedText]) return textLabelToPart[normalizedText]
    if (lowerText && textLabelToPart[lowerText]) return textLabelToPart[lowerText]
    if (cleanText && textLabelToPart[cleanText]) return textLabelToPart[cleanText]
    if (cleanLowerText && textLabelToPart[cleanLowerText]) return textLabelToPart[cleanLowerText]

    const sortedKeys = Object.entries(textLabelToPart).sort((a, b) => b[0].length - a[0].length)
    const textsToMatch = [cleanLowerText, lowerText].filter(Boolean)

    for (const textToMatch of textsToMatch) {
      for (const [key, value] of sortedKeys) {
        if (textToMatch.includes(key.toLowerCase())) {
          return value
        }
      }
    }

    return null
  }

  // Find part name from element ID
  const findPartNameFromElement = (element: Element): string | null => {
    const id = element.getAttribute('id')
    if (id && svgPartIdToEarPart[id]) {
      return svgPartIdToEarPart[id]
    }

    let parent: Element | null = element.parentElement
    while (parent) {
      if (parent.tagName === 'switch') {
        const switchId = parent.getAttribute('id')
        if (switchId && svgPartIdToEarPart[switchId]) {
          return svgPartIdToEarPart[switchId]
        }
      }
      if (parent.tagName === 'svg') break
      parent = parent.parentElement
    }

    return null
  }

  // Setup interactive elements
  useEffect(() => {
    if (!containerRef.current || !svgContent) return

    const container = containerRef.current
    const svgElement = container.querySelector('svg') as SVGSVGElement
    if (!svgElement) return

    const cleanupFunctions: Array<() => void> = []
    const interactiveElements = new Map<Element, string>()

    // Find all text elements
    const processTextElements = () => {
      const allTexts = svgElement.querySelectorAll('text')
      
      allTexts.forEach((textElement) => {
        const text = textElement as SVGTextElement
        if (text.parentElement?.tagName === 'tspan') return

        const textContent = getFullTextContent(text)
        let partName = findPartNameFromText(textContent)
        if (!partName) partName = findPartNameFromElement(text)
        if (!partName || !earPartsData[partName]) return

        interactiveElements.set(text, partName)

        // Enable pointer events on text so it's clickable
        text.setAttribute('pointer-events', 'all')
        text.style.cursor = 'pointer'
        const tspans = text.querySelectorAll('tspan')
        tspans.forEach(tspan => {
          (tspan as SVGElement).setAttribute('pointer-events', 'all')
          tspan.style.cursor = 'pointer'
        })

        // Create hit area rectangle (only for text, no paths)
        try {
          const textBox = text.getBBox()
          const expandedBox = {
            x: textBox.x - 10,
            y: textBox.y - 10,
            width: textBox.width + 20,
            height: textBox.height + 20
          }

          const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
          hitArea.setAttribute('x', expandedBox.x.toString())
          hitArea.setAttribute('y', expandedBox.y.toString())
          hitArea.setAttribute('width', expandedBox.width.toString())
          hitArea.setAttribute('height', expandedBox.height.toString())
          hitArea.setAttribute('fill', 'transparent')
          hitArea.setAttribute('pointer-events', 'all')
          hitArea.style.cursor = 'pointer'
          hitArea.setAttribute('data-part-name', partName)

          // Insert hit area at the end of SVG (highest z-index)
          svgElement.appendChild(hitArea)
          hitAreaRefs.current.set(hitArea, partName)

          // Click handler on hit area
          const clickHandler = (e: MouseEvent) => {
            e.stopPropagation()
            e.preventDefault()
            
            const partData = earPartsData[partName]
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
            
            const partData = earPartsData[partName]
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
        } catch {
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

    const currentHitAreaRefs = hitAreaRefs.current
    return () => {
      clearTimeout(timeoutId)
      cleanupFunctions.forEach(cleanup => cleanup())
      currentHitAreaRefs.clear()
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
