"use client"

import { useEffect, useState } from "react"

interface NewItemHighlightProps {
  isNew: boolean
  children: React.ReactNode
  className?: string
  fadeOutAfter?: number // milliseconds to fade out after
}

/**
 * Component that highlights new items with a pulsing background effect
 * Automatically fades out after a specified time
 */
export default function NewItemHighlight({ 
  isNew, 
  children, 
  className = "",
  fadeOutAfter = 10000 // 10 seconds default
}: NewItemHighlightProps) {
  const [shouldHighlight, setShouldHighlight] = useState(isNew)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (isNew) {
      setShouldHighlight(true)
      setFading(false)

      // Start fade out animation after specified time
      const fadeTimer = setTimeout(() => {
        setFading(true)
        // Remove highlight after fade animation completes
        setTimeout(() => {
          setShouldHighlight(false)
        }, 500) // Match animation duration
      }, fadeOutAfter)

      return () => clearTimeout(fadeTimer)
    } else {
      setShouldHighlight(false)
      setFading(false)
    }
  }, [isNew, fadeOutAfter])

  if (!shouldHighlight) {
    return <>{children}</>
  }

  return (
    <div
      className={`
        relative
        ${fading ? 'animate-fade-out' : 'animate-pulse-glow'}
        ${className}
      `}
    >
      {/* Highlight background */}
      <div className="absolute inset-0 bg-yellow-100/50 rounded-lg -z-10" />
      {/* Border highlight */}
      <div className="absolute inset-0 border-2 border-yellow-400/50 rounded-lg -z-10 pointer-events-none" />
      {children}
    </div>
  )
}

