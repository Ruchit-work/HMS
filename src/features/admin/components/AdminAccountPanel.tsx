"use client"

import UserProfile from "@/shared/components/profile/UserProfile"

interface AdminAccountPanelProps {
  userEmail: string
  displayName: string
  isSuperAdmin?: boolean
  onNotify: (type: "success" | "error", message: string) => void
}

export default function AdminAccountPanel({
  onNotify,
}: AdminAccountPanelProps) {
  return <UserProfile onNotify={onNotify} />
}
