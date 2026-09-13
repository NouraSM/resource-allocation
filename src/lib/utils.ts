import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number, locale: string, digits = 0) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

export function formatPercent(value: number, locale: string) {
  return `${formatNumber(value, locale, 0)}%`
}

/** Consistent "4,780 hrs" formatting for every effort/capacity hour figure in the app — never attach qualifiers like "est." to the number itself; put that context in the surrounding label instead. */
export function formatHours(value: number, locale: string) {
  return `${formatNumber(value, locale, 0)} hrs`
}

export function formatDate(value: string | Date, locale: string) {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

export function daysBetween(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}
