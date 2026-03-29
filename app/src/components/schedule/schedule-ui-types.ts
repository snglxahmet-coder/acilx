/** Schedule UI types & utility constants (no mock data) */

import type { Zone } from '@/types/schedule'

// ── UI-specific types ──

export interface UIResident {
  uid: string
  name: string
  seniority: number
}

export interface DayShift {
  day: number
  dayOfWeek: number
  isWeekend: boolean
  isToday: boolean
  assignments: { zone: Zone; residents: UIResident[] }[]
  totalCount: number
  myZone?: Zone
}

export interface ShiftStats {
  totalShifts: number
  weekendShifts: number
  holidayShifts: number
  weekdayShifts: number
}

// ── Constants ──

export const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
]

export const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

// ── Helpers ──

export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 1) return parts[0] || ''
  const first = parts[0]
  const rest = parts
    .slice(1)
    .map((p) => p[0].toUpperCase() + '.')
    .join('')
  return first + ' ' + rest
}
