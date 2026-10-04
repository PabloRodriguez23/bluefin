const pad = (n: number) => String(n).padStart(2, '0')

/** YYYY-MM-DD en hora local. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const today = () => toISODate(new Date())

/** YYYY-MM del mes actual. */
export const currentMonth = () => today().slice(0, 7)

export const monthOf = (fecha: string) => fecha.slice(0, 7)

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/** Meses entre `from` y `to`, ambos incluidos. */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = []
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m)
  return out
}

export function dateInMonth(month: string, day: number): string {
  return `${month}-${pad(Math.min(Math.max(day, 1), daysInMonth(month)))}`
}

const monthFmt = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })
const shortMonthFmt = new Intl.DateTimeFormat('es-ES', { month: 'short' })
const dayFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

const parse = (s: string) => {
  const [y, m, d = 1] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const monthLabel = (month: string) => capitalize(monthFmt.format(parse(month)))
export const shortMonthLabel = (month: string) => shortMonthFmt.format(parse(month)).replace('.', '')
export const dayLabel = (fecha: string) => dayFmt.format(parse(fecha))
