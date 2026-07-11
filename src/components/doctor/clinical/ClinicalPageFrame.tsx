"use client"

import React from "react"

interface ClinicalPageFrameProps {
  children: React.ReactNode
  maxWidth?: "6xl" | "7xl" | "full"
  className?: string
}

export default function ClinicalPageFrame({
  children,
  maxWidth = "7xl",
  className = "",
}: ClinicalPageFrameProps) {
  const widthClass =
    maxWidth === "6xl"
      ? "max-w-6xl"
      : maxWidth === "full"
        ? "max-w-full"
        : "max-w-7xl"

  return (
    <div className={`clinical-page-frame ${className}`}>
      <div className={`clinical-page-frame__inner ${widthClass}`}>{children}</div>
    </div>
  )
}
