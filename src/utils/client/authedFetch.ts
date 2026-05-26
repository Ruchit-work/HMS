"use client"

import { auth } from "@/firebase/config"

type JsonLike = Record<string, unknown>

async function getCurrentUserToken(): Promise<string> {
  const currentUser = auth.currentUser
  if (!currentUser) {
    throw new Error("You must be logged in.")
  }
  return currentUser.getIdToken()
}

async function parseErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as JsonLike
  const candidates = [data?.error, data?.details, data?.message]
  const message = candidates.find((entry) => typeof entry === "string" && entry.trim().length > 0)
  return typeof message === "string" ? message : fallbackMessage
}

export async function authedFetchJson<T = JsonLike>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  fallbackErrorMessage = "Request failed"
): Promise<T> {
  const token = await getCurrentUserToken()
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(init.headers || {}),
  }

  const response = await fetch(input, { ...init, headers })
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, fallbackErrorMessage))
  }
  return (await response.json().catch(() => ({}))) as T
}
