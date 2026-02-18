"use client"

import React, { useState, useRef } from 'react'
import { nosePartsData } from '@/constants/noseDiseases'

interface InteractiveNoseJPGProps {
  onPartSelect: (partName: string | null, partInfo?: { name: string; description: string }) => void
  selectedPart: string | null
}

// Define clickable regions for nose parts (percentage-based for responsiveness)
// Expanded regions to make them more clickable
const nosePartRegions: Record<string, { x: number; y: number; width: number; height: number }> = {
  Nostrils: { x: 40, y: 80, width: 20, height: 15 }, // Bottom center - nostrils (expanded)
  Nasal_Cavity: { x: 35, y: 25, width: 30, height: 55 }, // Center - main nasal cavity (expanded)
  Nasal_Septum: { x: 45, y: 20, width: 10, height: 65 }, // Center vertical - septum (expanded)
  Turbinates: { x: 30, y: 30, width: 40, height: 45 }, // Sides - turbinates (expanded)
  Sinuses: { x: 25, y: 10, width: 50, height: 30 }, // Upper area - sinuses (expanded)
}

export default function InteractiveNoseJPG({ onPartSelect, selectedPart }: InteractiveNoseJPGProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [hoveredPart, setHoveredPart] = useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)

  const handlePartClick = (partName: string) => {
    const partData = nosePartsData[partName]
    if (partData) {
      onPartSelect(partName, {
        name: partData.partName,
        description: partData.description
      })
    }
  }

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === containerRef.current || e.target === imageRef.current) {
      onPartSelect(null)
    }
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-white rounded-lg overflow-hidden relative"
      onClick={handleContainerClick}
      style={{ minHeight: '600px' }}
    >
      <img
        ref={imageRef}
        src="/images/ear/2205.i504.023.F.m005.c7.nose anatomy diagram.jpg"
        alt="Nose Anatomy Diagram"
        className="w-full h-full object-contain"
        onLoad={() => setImageLoaded(true)}
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      />
      
      {imageLoaded && (
        <div className="absolute inset-0" style={{ pointerEvents: 'auto' }}>
          {Object.entries(nosePartRegions).map(([partName, region]) => {
            const partData = nosePartsData[partName]
            if (!partData) return null

            const isSelected = selectedPart === partName
            const isHovered = hoveredPart === partName

            return (
              <div
                key={partName}
                className="absolute cursor-pointer transition-all z-10"
                style={{
                  left: `${region.x}%`,
                  top: `${region.y}%`,
                  width: `${region.width}%`,
                  height: `${region.height}%`,
                  border: isSelected 
                    ? '3px solid #10b981' 
                    : isHovered 
                    ? '2px solid #3b82f6' 
                    : '2px solid transparent',
                  backgroundColor: isSelected 
                    ? 'rgba(16, 185, 129, 0.2)' 
                    : isHovered 
                    ? 'rgba(59, 130, 246, 0.15)' 
                    : 'transparent',
                  borderRadius: '4px',
                  pointerEvents: 'auto',
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  handlePartClick(partName)
                }}
                onMouseEnter={() => {
                  if (selectedPart !== partName) {
                    setHoveredPart(partName)
                  }
                }}
                onMouseLeave={() => setHoveredPart(null)}
                title={partData.partName}
              />
            )
          })}
        </div>
      )}
      
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-slate-500">Loading nose anatomy diagram...</div>
        </div>
      )}
    </div>
  )
}

