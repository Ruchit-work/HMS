"use client"

import React, { useState, useRef, useEffect } from "react"
import { kidneyPartsData } from "@/constants/kidneyDiseases"

interface InteractiveKidneySVGProps {
  onPartSelect: (partName: string | null, partInfo?: { name: string; description: string }) => void
  selectedPart: string | null
}

// Map text labels in kidney SVGs to kidneyPartsData keys
// Note: public/images/kidey (typo for kidney) - Kidney-Cross-Section-Illustration.svg
const textLabelToPart: Record<string, string> = {
  'Kidney': 'Kidney',
  'kidney': 'Kidney',
  'Kidneys': 'Kidney',
  'kidneys': 'Kidney',
  'Renal': 'Kidney',
  'renal': 'Kidney',
  'Renal pelvis': 'Renal_Pelvis',
  'Renal Pelvis': 'Renal_Pelvis',
  'renal pelvis': 'Renal_Pelvis',
  'Ureter': 'Ureter',
  'ureter': 'Ureter',
  'Ureters': 'Ureter',
  'ureters': 'Ureter',
  'Cortex': 'Cortex',
  'cortex': 'Cortex',
  'Medulla': 'Medulla',
  'medulla': 'Medulla',
  'Renal cortex': 'Cortex',
  'Renal medulla': 'Medulla',
  'Nephron': 'Kidney',
  'nephron': 'Kidney',
  'Glomerulus': 'Cortex',
  'glomerulus': 'Cortex',
}

// Overlay regions for Kidney-Cross-Section-Illustration.svg (viewBox 0 0 1169.755 1700.532)
const KIDNEY_OVERLAY_REGIONS: Array<{ partName: string; x: number; y: number; width: number; height: number }> = [
  { partName: "Kidney", x: 200, y: 200, width: 350, height: 1100 },
  { partName: "Kidney", x: 620, y: 200, width: 350, height: 1100 },
  { partName: "Cortex", x: 250, y: 300, width: 250, height: 900 },
  { partName: "Cortex", x: 670, y: 300, width: 250, height: 900 },
  { partName: "Medulla", x: 400, y: 500, width: 150, height: 600 },
  { partName: "Medulla", x: 620, y: 500, width: 150, height: 600 },
  { partName: "Renal_Pelvis", x: 380, y: 700, width: 180, height: 300 },
  { partName: "Renal_Pelvis", x: 610, y: 700, width: 180, height: 300 },
  { partName: "Ureter", x: 380, y: 1200, width: 200, height: 400 },
  { partName: "Ureter", x: 590, y: 1200, width: 200, height: 400 },
]

export default function InteractiveKidneySVG({ onPartSelect, selectedPart }: InteractiveKidneySVGProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredPart, setHoveredPart] = useState<string | null>(null)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const hitAreaRefs = useRef<Map<SVGRectElement, string>>(new Map())

  useEffect(() => {
    fetch("/images/kidey/Kidney-Cross-Section-Illustration.svg")
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
        if (textToMatch.includes(key.toLowerCase())) return value
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
      const regions = KIDNEY_OVERLAY_REGIONS
      regions.forEach(({ partName, x, y, width, height }) => {
        if (!kidneyPartsData[partName]) return
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
          const partData = kidneyPartsData[partName]
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
        if (!partName || !kidneyPartsData[partName]) return

        try {
          const textBox = text.getBBox()
          if (textBox.width <= 0 || textBox.height <= 0) return
        } catch {
          return
        }

        interactiveElements.set(text, partName)
        text.setAttribute("pointer-events", "all")
        text.style.cursor = "pointer"
        text.querySelectorAll("tspan").forEach((tspan) => {
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
            const partData = kidneyPartsData[partName]
            if (partData) onPartSelect(partName, { name: partData.partName, description: partData.description })
          }
          const mouseEnterHandler = () => { if (selectedPart !== partName) setHoveredPart(partName) }
          const mouseLeaveHandler = () => setHoveredPart(null)

          hitArea.addEventListener("click", clickHandler)
          text.addEventListener("click", clickHandler)
          hitArea.addEventListener("mouseenter", mouseEnterHandler)
          hitArea.addEventListener("mouseleave", mouseLeaveHandler)
          text.addEventListener("mouseenter", mouseEnterHandler)
          text.addEventListener("mouseleave", mouseLeaveHandler)
          cleanupFunctions.push(() => {
            hitArea.removeEventListener("click", clickHandler)
            text.removeEventListener("click", clickHandler)
            hitArea.removeEventListener("mouseenter", mouseEnterHandler)
            hitArea.removeEventListener("mouseleave", mouseLeaveHandler)
            text.removeEventListener("mouseenter", mouseEnterHandler)
            text.removeEventListener("mouseleave", mouseLeaveHandler)
            if (hitArea.parentElement) svgElement.removeChild(hitArea)
          })
        } catch {
          /* skip */
        }
      })
    }

    const disablePaths = () => {
      svgElement.querySelectorAll("path").forEach((path) => {
        (path as SVGPathElement).setAttribute("pointer-events", "none")
      })
    }

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

    const timeoutId = setTimeout(() => {
      processTextElements()
      if (interactiveElements.size === 0) addOverlayRegions()
      disablePaths()
      updateHighlights()
    }, 100)

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
        <div className="text-slate-500">Loading kidney diagram...</div>
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
        className="w-full h-full flex items-center justify-center min-w-0 min-h-0 [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:h-auto [&>svg]:object-contain"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  )
}
