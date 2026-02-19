"use client"

import React, { useState, useRef, useEffect } from "react"
import { skeletonPartsData } from "@/constants/skeletonDiseases"

interface InteractiveSkeletonSVGProps {
  onPartSelect: (partName: string | null, partInfo?: { name: string; description: string }) => void
  selectedPart: string | null
}

// Map fullskeleton.svg group ids, path ids, and label ids to skeletonPartsData keys
const svgIdToSkeletonPart: Record<string, string> = {
  // Skull & jaw (groups)
  Skull: 'Skull',
  Cranium: 'Skull',
  Mandible: 'Mandible',
  // Spine (groups)
  CervicalVertebrae: 'Spine',
  ThoracicVertebrae: 'Spine',
  LumbarVertebrae: 'Spine',
  Sacrum: 'Spine',
  Coccyx: 'Spine',
  // Chest
  Manubrium: 'Sternum',
  g3760: 'Ribcage',
  // Femur (paths at layer3 root)
  path479: 'Femur',
  path513: 'Femur',
  // Limbs
  ClavicleLeft: 'Clavicle',
  ClavicleRight: 'Clavicle',
  Scapula: 'Scapula',
  HumerusLeft: 'Humerus',
  HumerusRight: 'Humerus',
  UlnaLeft: 'Radius_Ulna',
  UlnaRight: 'Radius_Ulna',
  RadiusLeft: 'Radius_Ulna',
  RadiusRight: 'Radius_Ulna',
  HandLeft: 'Hand',
  HandRight: 'Hand',
  CarpalsLeft: 'Hand',
  CarpalsRight: 'Hand',
  MetacarpalsLeft: 'Hand',
  MetacarpalsRight: 'Hand',
  PhalangesLeft: 'Hand',
  PhalangesRight: 'Hand',
  TibiaLeft: 'Tibia_Fibula',
  TibiaRight: 'Tibia_Fibula',
  PatellaLeft: 'Patella',
  PatellaRight: 'Patella',
  // Foot
  TarsalsLeft: 'Tarsals',
  TarsalsRight: 'Tarsals',
  FootLeft: 'Tarsals',
  FootRight: 'Tarsals',
  MetatarsalsLeft: 'Tarsals',
  MetatarsalsRight: 'Tarsals',
  PhalangesFootLeft: 'Tarsals',
  PhalangesFootRight: 'Tarsals',
  // Label ids (layer1 text id="l_...")
  l_Cranium: 'Skull',
  l_Mandible: 'Mandible',
  l_Clavicle: 'Clavicle',
  l_Manubrium: 'Sternum',
  l_Scapula: 'Scapula',
  l_Sternum: 'Sternum',
  l_Ribs: 'Ribcage',
  l_Humerus: 'Humerus',
  l_Ulna: 'Radius_Ulna',
  l_Radius: 'Radius_Ulna',
  l_Pelvic_Girdle: 'Pelvis',
  l_Carpals: 'Hand',
  l_Metacarpals: 'Hand',
  l_Phalanges: 'Hand',
  l_Femur: 'Femur',
  l_Patella: 'Patella',
  l_Tibia: 'Tibia_Fibula',
  l_Fibula: 'Tibia_Fibula',
  l_Tarsals: 'Tarsals',
  l_Metatarsals: 'Tarsals',
  l_PhalangesFoot: 'Tarsals',
  l_Cervicle_Vertebrae: 'Spine',
  l_Thoracic_Vertebrae: 'Spine',
  l_Lumbar_Vertebrae: 'Spine',
  l_Sacrum: 'Spine',
  l_Coccyx: 'Spine',
  l_Spinal_Column: 'Spine',
}

// Fallback: first word of label text (no numbers/symbols) -> part key
const labelTextToPart: Record<string, string> = {
  Cranium: 'Skull',
  Mandible: 'Mandible',
  Clavicle: 'Clavicle',
  Manubrium: 'Sternum',
  Scapula: 'Scapula',
  Sternum: 'Sternum',
  Ribs: 'Ribcage',
  Humerus: 'Humerus',
  Ulna: 'Radius_Ulna',
  Radius: 'Radius_Ulna',
  Pelvic: 'Pelvis',
  Carpals: 'Hand',
  Metacarpals: 'Hand',
  Phalanges: 'Hand',
  Femur: 'Femur',
  Patella: 'Patella',
  Tibia: 'Tibia_Fibula',
  Fibula: 'Tibia_Fibula',
  Tarsals: 'Tarsals',
  Metatarsals: 'Tarsals',
  Cervical: 'Spine',
  Thoracic: 'Spine',
  Lumbar: 'Spine',
  Sacrum: 'Spine',
  Coccyx: 'Spine',
  Spinal: 'Spine',
}

export default function InteractiveSkeletonSVG({ onPartSelect, selectedPart }: InteractiveSkeletonSVGProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredPart, setHoveredPart] = useState<string | null>(null)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const partToElementsRef = useRef<Map<string, Element[]>>(new Map())

  useEffect(() => {
    fetch("/images/skeleton/fullskeleton.svg")
      .then((res) => res.text())
      .then((text) => setSvgContent(text))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!svgContent) return

    const timeoutId = setTimeout(() => {
      if (!containerRef.current) return
      const container = containerRef.current
      const svgElement = container.querySelector("svg") as SVGSVGElement
      if (!svgElement) return

      partToElementsRef.current.clear()

      // Layer1 (Labels): keep layer non-blocking so empty area passes through; enable only text labels
      const layer1 = svgElement.querySelector('#layer1')
      if (layer1) (layer1 as SVGElement).setAttribute('pointer-events', 'none')
      const layer4 = svgElement.querySelector('#layer4')
      if (layer4) (layer4 as SVGElement).setAttribute('pointer-events', 'none')

      const resolvePartFromLabel = (textEl: Element): string | null => {
        const id = textEl.getAttribute('id')
        if (id && svgIdToSkeletonPart[id] && skeletonPartsData[svgIdToSkeletonPart[id]]) return svgIdToSkeletonPart[id]
        const raw = (textEl.textContent || '').trim()
        const firstWord = raw.replace(/[^a-zA-Z].*$/, '').trim()
        if (firstWord && labelTextToPart[firstWord] && skeletonPartsData[labelTextToPart[firstWord]]) return labelTextToPart[firstWord]
        return null
      }

      // All label texts in layer1: make clickable and add to part map
      layer1?.querySelectorAll?.('text[id^="l_"]')?.forEach((text) => {
        const partName = resolvePartFromLabel(text)
        if (!partName) return
        text.setAttribute('pointer-events', 'all')
        ;(text as SVGElement).style.cursor = 'pointer'
        text.setAttribute('data-skeleton-part', partName)
        const list = partToElementsRef.current.get(partName) || []
        list.push(text)
        partToElementsRef.current.set(partName, list)
        text.querySelectorAll('tspan').forEach((tspan) => {
          tspan.setAttribute('pointer-events', 'all')
          ;(tspan as SVGElement).style.cursor = 'pointer'
        })
      })

      // Skeleton bones: layer3 contains all <g> with id (TarsalsLeft, Skull, etc.)
      const layer3 = svgElement.querySelector('#layer3')
      const root = layer3 || svgElement

      const collectPartElements = (node: Element, partName: string) => {
        const list = partToElementsRef.current.get(partName) || []
        if (node.tagName === 'path') {
          list.push(node)
          partToElementsRef.current.set(partName, list)
        }
        Array.from(node.children).forEach((child) => collectPartElements(child, partName))
      }

      root.querySelectorAll('g[id]').forEach((g) => {
        const id = g.getAttribute('id')
        const partName = id ? svgIdToSkeletonPart[id] : null
        if (partName && skeletonPartsData[partName]) {
          g.setAttribute('pointer-events', 'all')
          g.setAttribute('data-skeleton-part', partName)
          ;(g as SVGElement).style.cursor = 'pointer'
          collectPartElements(g, partName)
          const paths = g.querySelectorAll('path')
          paths.forEach((p) => {
            p.setAttribute('pointer-events', 'all')
          })
        }
      })

      // Root-level paths in layer3 (e.g. path479, path513 for Femur; g3760 is a g so already covered)
      root.querySelectorAll('path[id]').forEach((path) => {
        const id = path.getAttribute('id')
        const partName = id ? svgIdToSkeletonPart[id] : null
        if (partName && skeletonPartsData[partName]) {
          path.setAttribute('pointer-events', 'all')
          path.setAttribute('data-skeleton-part', partName)
          ;(path as SVGElement).style.cursor = 'pointer'
          const list = partToElementsRef.current.get(partName) || []
          list.push(path)
          partToElementsRef.current.set(partName, list)
        }
      })
    }, 150)

    return () => clearTimeout(timeoutId)
  }, [svgContent])

  const findPartFromTarget = (target: EventTarget | null): string | null => {
    let el = target as Element | null
    const svgElement = containerRef.current?.querySelector('svg')
    while (el && el !== svgElement) {
      const dataPart = el.getAttribute?.('data-skeleton-part')
      if (dataPart && skeletonPartsData[dataPart]) return dataPart
      const id = el.getAttribute?.('id')
      if (id && svgIdToSkeletonPart[id]) return svgIdToSkeletonPart[id]
      el = el.parentElement
    }
    return null
  }

  const handleSvgClick = (e: React.MouseEvent) => {
    const partName = findPartFromTarget(e.target)
    if (partName && skeletonPartsData[partName]) {
      e.stopPropagation()
      e.preventDefault()
      const partData = skeletonPartsData[partName]
      onPartSelect(partName, { name: partData.partName, description: partData.description })
    } else {
      // Click on empty area, background, or non-part element: clear selection
      onPartSelect(null)
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const partName = findPartFromTarget(e.target)
    setHoveredPart(partName && skeletonPartsData[partName] ? partName : null)
  }

  const handleMouseLeave = () => setHoveredPart(null)

  // Highlight selected/hovered parts
  useEffect(() => {
    if (!svgContent || !containerRef.current) return
    const svgEl = containerRef.current.querySelector('svg')
    if (!svgEl) return

    partToElementsRef.current.forEach((elements, partName) => {
      const isSelected = partName === selectedPart
      const isHovered = partName === hoveredPart
      const fill = isSelected ? '#10b981' : isHovered ? '#3b82f6' : null

      elements.forEach((el) => {
        if (el.tagName === 'path') {
          const path = el as SVGPathElement
          if (!path.getAttribute('data-original-fill'))
            path.setAttribute('data-original-fill', path.getAttribute('fill') || path.style.fill || '#f3d48c')
          if (fill) path.setAttribute('fill', fill)
          else path.setAttribute('fill', path.getAttribute('data-original-fill') || '#f3d48c')
        }
        if (el.tagName === 'text') {
          const text = el as SVGTextElement
          if (!text.getAttribute('data-original-fill'))
            text.setAttribute('data-original-fill', text.getAttribute('fill') || '#000')
          if (fill) {
            text.setAttribute('fill', fill)
            text.style.fontWeight = 'bold'
          } else {
            text.setAttribute('fill', text.getAttribute('data-original-fill') || '#000')
            text.style.fontWeight = 'normal'
          }
        }
      })
    })
  }, [svgContent, selectedPart, hoveredPart])

  if (!svgContent) {
    return (
      <div className="w-full h-full bg-white rounded-lg flex items-center justify-center" style={{ minHeight: "600px" }}>
        <div className="text-slate-500">Loading skeleton diagram...</div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-auto bg-white rounded-lg p-4"
      onClick={handleSvgClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ minHeight: "600px" }}
    >
      <div
        className="w-full h-full flex items-center justify-center min-w-0 min-h-0 [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:h-auto [&>svg]:object-contain"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  )
}
