"use client"

import React, { useState, useRef, useEffect } from "react"
import { lungsPartsData } from "@/constants/lungsDiseases"

interface InteractiveLungsSVGProps {
  onPartSelect: (partName: string | null, partInfo?: { name: string; description: string }) => void
  selectedPart: string | null
}

// Map text labels in lungs.svg to lungsPartsData keys
const textLabelToPart: Record<string, string> = {
  'Trachea': 'Trachea',
  'trachea': 'Trachea',
  'Tracheal and bronchi': 'Bronchi',
  'Trachea rings': 'Trachea',
  'rings': 'Bronchi',
  'Bronchi': 'Bronchi',
  'bronchi': 'Bronchi',
  'Lingular division bronchi': 'Bronchi',
  'Left lung': 'Lungs',
  'Right lung': 'Lungs',
  'Lung': 'Lungs',
  'lungs': 'Lungs',
  'Superior lobe': 'Lungs',
  'Middle lobe': 'Lungs',
  'Inferior lobe': 'Lungs',
  'Apex of left lung': 'Lungs',
  'Lingula of lung': 'Lungs',
  'Diaphragm': 'Lungs',
  'Horizontal fissure': 'Lungs',
  'Oblique fissure': 'Lungs',
  'Pharynx': 'Trachea',
  'pharynx': 'Trachea',
  'Epiglottis': 'Trachea',
  'epiglottis': 'Trachea',
  'Vocal folds': 'Trachea',
  'Thyroid cartilage': 'Trachea',
  'Nasal cavity': 'Trachea',
  'Nasal vestibule': 'Trachea',
  'Pulmonary artery': 'Lungs',
  'Pulmonary vein': 'Lungs',
  'Alveoli': 'Lungs',
  'Atrium': 'Heart',
  'Alveolar': 'Lungs',
  'Heart': 'Heart',
  'heart': 'Heart',
  'Frontal': 'Lungs',
  'Sphenoid': 'Lungs',
}

export default function InteractiveLungsSVG({ onPartSelect, selectedPart }: InteractiveLungsSVGProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredPart, setHoveredPart] = useState<string | null>(null)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const hitAreaRefs = useRef<Map<SVGRectElement, string>>(new Map())

  useEffect(() => {
    fetch("/images/lungs/lungs.svg")
      .then((res) => res.text())
      .then((text) => setSvgContent(text))
      .catch(() => {})
  }, [])

  const getFullTextContent = (element: SVGTextElement): string => {
    let content = (element.textContent || "").trim()
    content = content.replace(/\s+/g, " ")
    return content
  }

  const findPartNameFromText = (textContent: string): string | null => {
    const normalizedText = textContent.trim()
    const lowerText = normalizedText.toLowerCase()
    const cleanText = normalizedText.replace(/\s*\([^)]*\)/g, "").trim()
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

  useEffect(() => {
    if (!containerRef.current || !svgContent) return

    const container = containerRef.current
    const svgElement = container.querySelector("svg") as SVGSVGElement
    if (!svgElement) return

    const cleanupFunctions: Array<() => void> = []
    const interactiveElements = new Map<Element, string>()

    const processTextElements = () => {
      const allTexts = svgElement.querySelectorAll("text")
      allTexts.forEach((textElement) => {
        const text = textElement as SVGTextElement
        if (text.parentElement?.tagName === "tspan") return
        // In switch elements, only the visible/fallback text has valid bbox; skip non-matching language texts
        const textContent = getFullTextContent(text)
        const partName = findPartNameFromText(textContent)
        if (!partName || !lungsPartsData[partName]) return

        try {
          const textBox = text.getBBox()
          if (textBox.width <= 0 || textBox.height <= 0) return
        } catch {
          return
        }

        interactiveElements.set(text, partName)

        text.setAttribute("pointer-events", "all")
        text.style.cursor = "pointer"
        const tspans = text.querySelectorAll("tspan")
        tspans.forEach((tspan) => {
          (tspan as SVGElement).setAttribute("pointer-events", "all")
          ;(tspan as SVGElement).style.cursor = "pointer"
        })

        try {
          const textBox = text.getBBox()
          const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "rect")
          hitArea.setAttribute("x", String(textBox.x - 10))
          hitArea.setAttribute("y", String(textBox.y - 10))
          hitArea.setAttribute("width", String(textBox.width + 20))
          hitArea.setAttribute("height", String(textBox.height + 20))
          hitArea.setAttribute("fill", "transparent")
          hitArea.setAttribute("pointer-events", "all")
          hitArea.style.cursor = "pointer"

          svgElement.appendChild(hitArea)
          hitAreaRefs.current.set(hitArea, partName)

          const clickHandler = (e: MouseEvent) => {
            e.stopPropagation()
            e.preventDefault()
            const partData = lungsPartsData[partName]
            if (partData) onPartSelect(partName, { name: partData.partName, description: partData.description })
          }

          hitArea.addEventListener("click", clickHandler)
          text.addEventListener("click", clickHandler)
          cleanupFunctions.push(() => {
            hitArea.removeEventListener("click", clickHandler)
            text.removeEventListener("click", clickHandler)
            if (hitArea.parentElement) svgElement.removeChild(hitArea)
          })

          const mouseEnterHandler = () => { if (selectedPart !== partName) setHoveredPart(partName) }
          const mouseLeaveHandler = () => setHoveredPart(null)
          hitArea.addEventListener("mouseenter", mouseEnterHandler)
          hitArea.addEventListener("mouseleave", mouseLeaveHandler)
          text.addEventListener("mouseenter", mouseEnterHandler)
          text.addEventListener("mouseleave", mouseLeaveHandler)
          cleanupFunctions.push(() => {
            hitArea.removeEventListener("mouseenter", mouseEnterHandler)
            hitArea.removeEventListener("mouseleave", mouseLeaveHandler)
            text.removeEventListener("mouseenter", mouseEnterHandler)
            text.removeEventListener("mouseleave", mouseLeaveHandler)
          })
        } catch {
          // Skip if text doesn't have valid bbox
        }
      })
    }

    const disablePaths = () => {
      svgElement.querySelectorAll("path").forEach((path) => {
        (path as SVGPathElement).setAttribute("pointer-events", "none")
      })
    }

    const timeoutId = setTimeout(() => {
      processTextElements()
      disablePaths()
    }, 100)

    const updateHighlights = () => {
      interactiveElements.forEach((partName, element) => {
        if (element.tagName === "text") {
          const text = element as SVGTextElement
          const originalFill = text.getAttribute("data-original-fill") || text.getAttribute("fill") || "#000"
          if (!text.getAttribute("data-original-fill")) text.setAttribute("data-original-fill", originalFill)

          if (partName === selectedPart) {
            text.setAttribute("fill", "#10b981")
            text.style.fontWeight = "bold"
          } else if (partName === hoveredPart) {
            text.setAttribute("fill", "#3b82f6")
            text.style.fontWeight = "bold"
          } else {
            text.setAttribute("fill", originalFill)
            text.style.fontWeight = "normal"
          }
          text.querySelectorAll("tspan").forEach((tspan) => {
            const t = tspan as SVGTextElement
            if (!t.getAttribute("data-original-fill")) t.setAttribute("data-original-fill", t.getAttribute("fill") || originalFill)
            if (partName === selectedPart) { t.setAttribute("fill", "#10b981"); t.style.fontWeight = "bold" }
            else if (partName === hoveredPart) { t.setAttribute("fill", "#3b82f6"); t.style.fontWeight = "bold" }
            else { t.setAttribute("fill", t.getAttribute("data-original-fill") || originalFill); t.style.fontWeight = "normal" }
          })
        }
      })
    }

    updateHighlights()

    return () => {
      clearTimeout(timeoutId)
      cleanupFunctions.forEach((fn) => fn())
      hitAreaRefs.current.clear()
    }
  }, [svgContent, selectedPart, hoveredPart, onPartSelect])

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element
    if (target === containerRef.current || target.tagName === "svg") {
      onPartSelect(null)
    }
  }

  if (!svgContent) {
    return (
      <div className="w-full h-full bg-white rounded-lg flex items-center justify-center" style={{ minHeight: "600px" }}>
        <div className="text-slate-500">Loading lungs diagram...</div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-white rounded-lg overflow-auto"
      onClick={handleContainerClick}
      style={{ minHeight: "600px" }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  )
}
