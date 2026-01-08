// Date filtering functions for appointments
export const isToday = (date: string) => {
  const appointmentDate = new Date(date)
  const today = new Date()
  return appointmentDate.toDateString() === today.toDateString()
}

export const isTomorrow = (date: string) => {
  const appointmentDate = new Date(date)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return appointmentDate.toDateString() === tomorrow.toDateString()
}

export const isThisWeek = (date: string) => {
  const appointmentDate = new Date(date)
  const today = new Date()
  const endOfWeek = new Date(today)
  endOfWeek.setDate(today.getDate() + 7)
  return appointmentDate >= today && appointmentDate <= endOfWeek
}

export const isNextWeek = (date: string) => {
  const appointmentDate = new Date(date)
  const today = new Date()
  const startOfNextWeek = new Date(today)
  startOfNextWeek.setDate(today.getDate() + 8)
  const endOfNextWeek = new Date(today)
  endOfNextWeek.setDate(today.getDate() + 14)
  return appointmentDate >= startOfNextWeek && appointmentDate <= endOfNextWeek
}

// Sort functions
export const sortByDateTime = (a: { appointmentDate: string; appointmentTime: string }, b: { appointmentDate: string; appointmentTime: string }) => {
  const dateA = new Date(`${a.appointmentDate} ${a.appointmentTime}`)
  const dateB = new Date(`${b.appointmentDate} ${b.appointmentTime}`)
  return dateA.getTime() - dateB.getTime()
}

export const sortByDateTimeDesc = (a: { appointmentDate: string; appointmentTime: string }, b: { appointmentDate: string; appointmentTime: string }) => {
  const dateA = new Date(`${a.appointmentDate} ${a.appointmentTime}`)
  const dateB = new Date(`${b.appointmentDate} ${b.appointmentTime}`)
  return dateB.getTime() - dateA.getTime()
}

