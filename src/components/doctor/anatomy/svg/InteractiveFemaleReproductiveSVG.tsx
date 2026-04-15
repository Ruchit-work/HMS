"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { femaleReproductivePartsData } from "@/constants/femaleReproductiveDiseases"

interface InteractiveFemaleReproductiveSVGProps {
  onPartSelect: (partName: string | null, partInfo?: { name: string; description: string }) => void
  selectedPart: string | null
}

const textLabelToPart: Record<string, string> = {
  "uterus": "Uterus",
  "fundus": "Fundus",
  "cervix": "Cervix",
  "vagina": "Vagina",
  "vulva": "Vulva",
  "ovary": "Ovary",
  "uterine tube": "Uterine_Tube",
  "fallopian tube": "Uterine_Tube",
  "infundibulum": "Infundibulum",
  "fimbriae": "Fimbriae",
  "endometrium": "Endometrium",
  "myometrium": "Myometrium",
}

const svgIdToPart: Record<string, string> = {
  // If the SVG has stable ids for organs/labels, map here. (We still have robust text mapping.)
  Uterus: "Uterus",
  Cervix: "Cervix",
  Vagina: "Vagina",
  Vulva: "Vulva",
  Ovary: "Ovary",
  Endometrium: "Endometrium",
  Myometrium: "Myometrium",
  Fundus: "Fundus",
}

export default function InteractiveFemaleReproductiveSVG({ onPartSelect, selectedPart }: InteractiveFemaleReproductiveSVGProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const [hoveredPart, setHoveredPart] = useState<string | null>(null)

  useEffect(() => {
    fetch("/images/Reproduction/Female_Reproductive_System.svg")
      .then(res => res.text())
      .then(text => setSvgContent(text))
      .catch(() => {
        // ignore
      })
  }, [])

  const normalizedSelected = selectedPart ?? null

  const sortedTextKeys = useMemo(() => {
    return Object.keys(textLabelToPart).sort((a, b) => b.length - a.length)
  }, [])

  const normalizeText = (s: string) => s.replace(/\s+/g, " ").trim()

  const findPartFromText = (rawText: string): string | null => {
    const t = normalizeText(rawText)
    if (!t) return null
    const lower = t.toLowerCase()

    if (textLabelToPart[lower]) return textLabelToPart[lower]

    for (const key of sortedTextKeys) {
      if (lower.includes(key)) return textLabelToPart[key]
    }
    return null
  }

  const applyInteractiveEnhancements = (svgRoot: SVGSVGElement) => {
    svgRoot.style.width = "100%"
    svgRoot.style.height = "auto"

    const allTextNodes = Array.from(svgRoot.querySelectorAll("text")) as SVGTextElement[]
    for (const textNode of allTextNodes) {
      const content = normalizeText(textNode.textContent ?? "")
      const partKey = findPartFromText(content)
      if (!partKey) continue

      textNode.style.cursor = "pointer"
      textNode.style.userSelect = "none"
      ;(textNode as any).dataset.partKey = partKey
    }

    const allElementsWithId = Array.from(svgRoot.querySelectorAll("[id]")) as Array<SVGElement & { id: string }>
    for (const el of allElementsWithId) {
      const mapped = svgIdToPart[el.id]
      if (!mapped) continue
      el.style.cursor = "pointer"
      ;(el as any).dataset.partKey = mapped
    }

    const clickTargets = Array.from(svgRoot.querySelectorAll("[data-part-key]")) as SVGElement[]
    for (const el of clickTargets) {
      el.addEventListener("mouseenter", () => setHoveredPart(((el as any).dataset.partKey as string) ?? null))
      el.addEventListener("mouseleave", () => setHoveredPart(null))
      el.addEventListener("click", e => {
        e.preventDefault()
        e.stopPropagation()
        const key = ((el as any).dataset.partKey as string) ?? null
        if (!key) return
        const info = femaleReproductivePartsData[key]
        onPartSelect(key, info ? { name: info.partName, description: info.description } : undefined)
      })
    }
  }

  useEffect(() => {
    if (!svgContent) return
    const container = containerRef.current
    if (!container) return

    container.innerHTML = svgContent
    const svg = container.querySelector("svg") as SVGSVGElement | null
    if (!svg) return

    applyInteractiveEnhancements(svg)

    const handleClickOutside = () => {
      onPartSelect(null)
    }
    svg.addEventListener("click", handleClickOutside)

    return () => {
      svg.removeEventListener("click", handleClickOutside)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgContent])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const svg = container.querySelector("svg") as SVGSVGElement | null
    if (!svg) return

    const targets = Array.from(svg.querySelectorAll("[data-part-key]")) as SVGElement[]
    for (const el of targets) {
      const key = ((el as any).dataset.partKey as string) ?? null
      const isSelected = !!key && key === normalizedSelected
      const isHovered = !!key && key === hoveredPart

      if (isSelected) {
        el.style.filter = "drop-shadow(0 0 6px rgba(37, 99, 235, 0.35))"
        el.style.opacity = "1"
      } else if (isHovered) {
        el.style.filter = "drop-shadow(0 0 4px rgba(59, 130, 246, 0.25))"
        el.style.opacity = "0.95"
      } else {
        el.style.filter = ""
        el.style.opacity = "1"
      }
    }
  }, [hoveredPart, normalizedSelected])

  return (
    <div className="w-full">
      <div
        className="w-full overflow-hidden rounded-xl border bg-white shadow-sm"
        style={{ background: "#fff" }}
      >
        <div className="px-3 py-2 border-b bg-slate-50 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-800">Female reproductive system</div>
          <div className="text-xs text-slate-500">{normalizedSelected ? femaleReproductivePartsData[normalizedSelected]?.partName ?? normalizedSelected : "Tap a label to view details"}</div>
        </div>
        <div className="p-3">
          <div ref={containerRef} className="w-full" />
        </div>
      </div>
    </div>
  )
}

