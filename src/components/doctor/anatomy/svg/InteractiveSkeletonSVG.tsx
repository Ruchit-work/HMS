"use client"

import React, { useState, useRef, useEffect } from "react"
import { skeletonPartsData } from "@/constants/skeletonDiseases"

interface InteractiveSkeletonSVGProps {
  onPartSelect: (partName: string | null, partInfo?: { name: string; description: string }) => void
  selectedPart: string | null
}

// Map fullskeleton.svg group ids and label ids to skeletonPartsData keys
const svgIdToSkeletonPart: Record<string, string> = {
  // Skull & jaw
  Skull: 'Skull',
  Cranium: 'Skull',
  Mandible: 'Mandible',
  // Spine
  CervicalVertebrae: 'Spine',
  ThoracicVertebrae: 'Spine',
  LumbarVertebrae: 'Spine',
  Sacrum: 'Spine',
  Coccyx: 'Spine',
  // Chest
  Manubrium: 'Sternum',
  // Text labels (id prefix l_)
  l_Sternum: 'Sternum',
  l_Ribs: 'Ribcage',
  l_Femur: 'Femur',
  // Limbs
  ClavicleLeft: 'Clavicle',
  ClavicleRight: 'Clavicle',
  Scapula: 'Scapula',
  HumerusLeft: 'Humerus',
  HumerusRight: 'Humerus',
  UlnaLeft: 'Ulna',
  UlnaRight: 'Ulna',
  RadiusLeft: 'Radius',
  RadiusRight: 'Radius',
  HandLeft: 'Hand',
  HandRight: 'Hand',
  TibiaLeft: 'Tibia',
  TibiaRight: 'Tibia',
  PatellaLeft: 'Patella',
  PatellaRight: 'Patella',
  // Foot
  TarsalsLeft: 'Tarsals',
  TarsalsRight: 'Tarsals',
  FootLeft: 'Tarsals',
  FootRight: 'Tarsals',
  MetatarsalsLeft: 'Tarsals',
  MetatarsalsRight: 'Tarsals',
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

      // Layer1 (Labels) is on top in DOM - make it non-blocking so clicks reach layer3 (Skeleton)
      const layer1 = svgElement.querySelector('#layer1')
      if (layer1) (layer1 as SVGElement).setAttribute('pointer-events', 'none')
      const layer4 = svgElement.querySelector('#layer4')
      if (layer4) (layer4 as SVGElement).setAttribute('pointer-events', 'none')

      // Text labels in layer1 we want clickable - re-enable pointer-events and add to map
      const labelIds = ['l_Sternum', 'l_Ribs', 'l_Femur']
      labelIds.forEach((id) => {
        const text = svgElement.querySelector(`text[id="${id}"]`)
        if (text && svgIdToSkeletonPart[id] && skeletonPartsData[svgIdToSkeletonPart[id]]) {
          text.setAttribute('pointer-events', 'all')
          ;(text as SVGElement).style.cursor = 'pointer'
          const partName = svgIdToSkeletonPart[id]
          const list = partToElementsRef.current.get(partName) || []
          list.push(text)
          partToElementsRef.current.set(partName, list)
        }
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
          g.style.cursor = 'pointer'
          collectPartElements(g, partName)
          const paths = g.querySelectorAll('path')
          paths.forEach((p) => {
            p.setAttribute('pointer-events', 'all')
          })
        }
      })
    }, 150)

    return () => clearTimeout(timeoutId)
  }, [svgContent])

  const findPartFromTarget = (target: EventTarget | null): string | null => {
    let el = target as Element | null
    const svgElement = containerRef.current?.querySelector('svg')
    while (el && el !== svgElement) {
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
      const target = e.target as Element
      if (target === containerRef.current || target?.tagName === 'svg' || target?.tagName === 'div') {
        onPartSelect(null)
      }
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
