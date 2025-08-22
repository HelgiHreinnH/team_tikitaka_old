import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ResponseStatus } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getStatusColor(status: ResponseStatus): string {
  switch (status) {
    case 'yes':
      return 'status-yes'
    case 'maybe':
      return 'status-maybe'  
    case 'no':
      return 'status-no'
    case 'no_response':
    default:
      return 'status-no_response'
  }
}

export function getStatusLabel(status: ResponseStatus): string {
  switch (status) {
    case 'yes':
      return 'Playing'
    case 'maybe':
      return 'Maybe'
    case 'no':
      return 'Not Playing'
    case 'no_response':
    default:
      return 'No Response'
  }
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export function getNextWednesday(): Date {
  const today = new Date()
  const daysUntilWednesday = (3 - today.getDay() + 7) % 7 || 7
  const nextWednesday = new Date(today)
  nextWednesday.setDate(today.getDate() + daysUntilWednesday)
  return nextWednesday
}

export function formatWeekDate(date: Date): string {
  return date.toISOString().split('T')[0]
}