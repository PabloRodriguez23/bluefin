const eur = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  useGrouping: 'always',
})
const eurRound = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
  useGrouping: 'always',
})

export const money = (n: number) => eur.format(n)
export const moneyRound = (n: number) => eurRound.format(n)
export const pct = (n: number) => `${Math.round(n * 100)} %`

/** Acepta "12,50", "12.50" o "1.234,56". Devuelve NaN si no es válido. */
export function parseAmount(raw: string): number {
  let s = raw.trim().replace(/\s|€/g, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  if (!/^\d*\.?\d+$/.test(s)) return NaN
  return Math.round(parseFloat(s) * 100) / 100
}

/** Formato de edición: 12.5 → "12,50" */
export const amountToInput = (n: number) => n.toFixed(2).replace('.', ',')

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
