"use client"

import { getPatientInitials } from "./clinicalUtils"

type AvatarSize = "sm" | "md" | "lg" | "xl"

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: "patient-avatar patient-avatar--sm",
  md: "patient-avatar",
  lg: "patient-avatar patient-avatar--lg",
  xl: "patient-avatar patient-avatar--xl",
}

interface PatientAvatarProps {
  name?: string
  size?: AvatarSize
  className?: string
}

export default function PatientAvatar({ name, size = "md", className = "" }: PatientAvatarProps) {
  return (
    <div className={`${SIZE_CLASSES[size]} ${className}`.trim()} aria-hidden>
      {getPatientInitials(name)}
    </div>
  )
}
