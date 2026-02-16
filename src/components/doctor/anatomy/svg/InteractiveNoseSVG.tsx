"use client"

import React, { useState, useRef, useEffect } from "react"
import { nosePartsData } from "@/constants/noseDiseases"

interface InteractiveNoseSVGProps {
  onPartSelect: (partName: string | null, partInfo?: { name: string; description: string }) => void
  selectedPart: string | null
}

// Overlay regions for TE-Nose_diagram.svg (viewBox 0 0 800 737.8) - no text labels, use rect overlays
const NOSE_OVERLAY_REGIONS: Array<{ partName: string; x: number; y: number; width: number; height: number }> = [
  { partName: "Nostrils", x: 650, y: 480, width: 130, height: 120 },
  { partName: "Nasal_Cavity", x: 350, y: 200, width: 280, height: 350 },
  { partName: "Nasal_Septum", x: 550, y: 220, width: 80, height: 380 },
  { partName: "Turbinates", x: 380, y: 280, width: 150, height: 220 },
  { partName: "Sinuses", x: 100, y: 100, width: 200, height: 150 },
]

// Map text labels in nose SVG to nosePartsData keys (ear-style: clickable text in diagram)
const textLabelToPart: Record<string, string> = {
  'Nostrils': 'Nostrils',
  'nostrils': 'Nostrils',
  'Nasal vestibule': 'Nostrils',
  'Nasal Vestibule': 'Nostrils',
  'Nasal cavity': 'Nasal_Cavity',
  'Nasal Cavity': 'Nasal_Cavity',
  'Nasal septum': 'Nasal_Septum',
  'Nasal Septum': 'Nasal_Septum',
  'Septum': 'Nasal_Septum',
  'Turbinates': 'Turbinates',
  'Turbinate': 'Turbinates',
  'Nasal conchae': 'Turbinates',
  'Sinuses': 'Sinuses',
  'Sinus': 'Sinuses',
  'Paranasal sinuses': 'Sinuses',
  'Frontal': 'Sinuses',
  'Sphenoid': 'Sinuses',
  'Maxillary': 'Sinuses',
  'Ethmoid': 'Sinuses',
}

export default function InteractiveNoseSVG({ onPartSelect, selectedPart }: InteractiveNoseSVGProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredPart, setHoveredPart] = useState<string | null>(null)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const hitAreaRefs = useRef<Map<SVGRectElement, string>>(new Map())

  useEffect(() => {
    fetch("/images/nose/TE-Nose_diagram.svg")
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

    const addOverlayRegions = () => {
      NOSE_OVERLAY_REGIONS.forEach(({ partName, x, y, width, height }) => {
        if (!nosePartsData[partName]) return
        const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "rect")
        hitArea.setAttribute("x", String(x))
        hitArea.setAttribute("y", String(y))
        hitArea.setAttribute("width", String(width))
        hitArea.setAttribute("height", String(height))
        hitArea.setAttribute("fill", "transparent")
        hitArea.setAttribute("pointer-events", "all")
        hitArea.style.cursor = "pointer"
        hitArea.setAttribute("data-part-name", partName)
        svgElement.appendChild(hitArea)
        hitAreaRefs.current.set(hitArea, partName)
        interactiveElements.set(hitArea, partName)

        const clickHandler = (e: MouseEvent) => {
          e.stopPropagation()
          e.preventDefault()
          const partData = nosePartsData[partName]
          if (partData) onPartSelect(partName, { name: partData.partName, description: partData.description })
        }
        const mouseEnterHandler = () => { if (selectedPart !== partName) setHoveredPart(partName) }
        const mouseLeaveHandler = () => setHoveredPart(null)

        hitArea.addEventListener("click", clickHandler)
        hitArea.addEventListener("mouseenter", mouseEnterHandler)
        hitArea.addEventListener("mouseleave", mouseLeaveHandler)
        cleanupFunctions.push(() => {
          hitArea.removeEventListener("click", clickHandler)
          hitArea.removeEventListener("mouseenter", mouseEnterHandler)
          hitArea.removeEventListener("mouseleave", mouseLeaveHandler)
          if (hitArea.parentElement) svgElement.removeChild(hitArea)
        })
      })
    }

    const processTextElements = () => {
      const allTexts = svgElement.querySelectorAll("text")
      allTexts.forEach((textElement) => {
        const text = textElement as SVGTextElement
        if (text.parentElement?.tagName === "tspan") return

        const textContent = getFullTextContent(text)
        const partName = findPartNameFromText(textContent)
        if (!partName || !nosePartsData[partName]) return

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
            const partData = nosePartsData[partName]
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
      addOverlayRegions()
      processTextElements()
      disablePaths()
    }, 100)

    const updateHighlights = () => {
      interactiveElements.forEach((partName, element) => {
        if (element.tagName === "rect" && element.hasAttribute("data-part-name")) {
          const rect = element as SVGRectElement
          rect.setAttribute("fill", partName === selectedPart ? "rgba(16,185,129,0.2)" : partName === hoveredPart ? "rgba(59,130,246,0.2)" : "transparent")
        } else if (element.tagName === "text") {
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
    if (target === containerRef.current || target.tagName === "svg" || target === e.currentTarget) {
      onPartSelect(null)
    }
  }

  if (!svgContent) {
    return (
      <div className="w-full h-full bg-white rounded-lg flex items-center justify-center" style={{ minHeight: "600px" }}>
        <div className="text-slate-500">Loading nose diagram...</div>
      </div>
    )
  }

  return (
    <div
      className="w-full h-full flex items-center justify-center overflow-hidden bg-white rounded-lg p-4"
      onClick={handleContainerClick}
      style={{ minHeight: "600px" }}
    >
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center min-w-0 min-h-0 pointer-events-none [&>svg]:pointer-events-auto [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:h-auto [&>svg]:object-contain"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  )
}
