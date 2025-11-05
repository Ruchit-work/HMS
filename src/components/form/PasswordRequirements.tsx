"use client"

interface PasswordRequirementsProps {
  password: string
}

interface Requirements {
  length: boolean
  uppercase: boolean
  lowercase: boolean
  digit: boolean
  special: boolean
}

export default function PasswordRequirements({ password }: PasswordRequirementsProps) {
  const validatePassword = (pass: string): Requirements => {
    return {
      length: pass.length >= 8,
      uppercase: /[A-Z]/.test(pass),
      lowercase: /[a-z]/.test(pass),
      digit: /[0-9]/.test(pass),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pass)
    }
  }

  const requirements = validatePassword(password)

  if (!password) return null

  return (
    <div className="mt-2 flex items-center gap-1.5">
      <span className="text-xs text-gray-500">Requires:</span>
      <div className="flex gap-1.5">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded ${
          requirements.length ? 'bg-green-100 text-green-700 ring-1 ring-green-200' : 'bg-gray-100 text-gray-500 ring-1 ring-gray-300'
        }`}>
          8+
        </span>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded ${
          requirements.uppercase ? 'bg-green-100 text-green-700 ring-1 ring-green-200' : 'bg-gray-100 text-gray-500 ring-1 ring-gray-300'
        }`}>
          A
        </span>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded ${
          requirements.lowercase ? 'bg-green-100 text-green-700 ring-1 ring-green-200' : 'bg-gray-100 text-gray-500 ring-1 ring-gray-300'
        }`}>
          a
        </span>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded ${
          requirements.digit ? 'bg-green-100 text-green-700 ring-1 ring-green-200' : 'bg-gray-100 text-gray-500 ring-1 ring-gray-300'
        }`}>
          1
        </span>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded ${
          requirements.special ? 'bg-green-100 text-green-700 ring-1 ring-green-200' : 'bg-gray-100 text-gray-500 ring-1 ring-gray-300'
        }`}>
          @ /
        </span>
      </div>
    </div>
  )
}

// Export the validation function for use in forms
export const validatePassword = (pass: string): Requirements => {
  return {
    length: pass.length >= 8,
    uppercase: /[A-Z]/.test(pass),
    lowercase: /[a-z]/.test(pass),
    digit: /[0-9]/.test(pass),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(pass)
  }
}

export const isPasswordValid = (pass: string): boolean => {
  const requirements = validatePassword(pass)
  return Object.values(requirements).every(Boolean)
}



