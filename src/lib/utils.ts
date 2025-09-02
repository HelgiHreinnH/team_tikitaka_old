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
      return '✅ Playing'
    case 'maybe':
      return '🤔 Maybe'
    case 'no':
      return '❌ Not Playing'
    case 'no_response':
    default:
      return '⚪ No Response'
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

export function generateCalendarEvent(): void {
  const now = new Date()
  const nextWednesday = getNextWednesday()
  
  // Set time to 17:30
  nextWednesday.setHours(17, 30, 0, 0)
  
  // Create end time (assume 2 hour session)
  const endTime = new Date(nextWednesday)
  endTime.setHours(19, 30, 0, 0)
  
  // Format dates for ICS (YYYYMMDDTHHMMSSZ)
  const formatICSDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }
  
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TikiTaka//Football Training//EN',
    'BEGIN:VEVENT',
    `UID:tikitaka-${Date.now()}@tikitaka.com`,
    `DTSTAMP:${formatICSDate(now)}`,
    `DTSTART:${formatICSDate(nextWednesday)}`,
    `DTEND:${formatICSDate(endTime)}`,
    'SUMMARY:TikiTaka Football Training',
    'DESCRIPTION:Weekly football training session with Tiki Taka Football Team',
    'LOCATION:Kunststofbanen\\, Arsenalvej\\, Arsenalvej 2\\, 1436 København',
    'RRULE:FREQ=WEEKLY;BYDAY=WE',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n')
  
  // Create and download the file
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'TikiTaka-Training.ics')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}