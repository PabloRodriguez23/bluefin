import type { Categoria, Movimiento } from '../types'
import { addMonths, daysInMonth, monthOf, shortMonthLabel, today } from './dates'

export interface ResumenMes {
  ingresos: number
  gastos: number
  fijos: number
  variables: number
  balance: number
  /** Movimientos con fecha futura (p. ej. fijos que aún no han llegado): no cuentan en los totales. */
  previstoIngresos: number
  previstoGastos: number
}

/** +1 ingreso, -1 gasto, 0 traspaso (no cuenta en el balance). */
export const signo = (m: Movimiento) => (m.clase === 'ingreso' ? 1 : m.clase === 'traspaso' ? 0 : -1)

const r2 = (n: number) => Math.round(n * 100) / 100

/** Solo cuenta lo que ya ha ocurrido: lo de fecha futura se acumula aparte como previsto. */
export function resumenMes(movs: Movimiento[], month: string, hoy = today()): ResumenMes {
  let ingresos = 0
  let fijos = 0
  let variables = 0
  let previstoIngresos = 0
  let previstoGastos = 0
  for (const m of movs) {
    if (monthOf(m.fecha) !== month) continue
    if (m.fecha > hoy) {
      if (m.clase === 'ingreso') previstoIngresos += m.importe
      else if (m.clase !== 'traspaso') previstoGastos += m.importe
      continue
    }
    if (m.clase === 'traspaso') continue
    if (m.clase === 'ingreso') ingresos += m.importe
    else if (m.clase === 'fijo') fijos += m.importe
    else variables += m.importe
  }
  const gastos = fijos + variables
  return { ingresos: r2(ingresos), fijos: r2(fijos), variables: r2(variables), gastos: r2(gastos), balance: r2(ingresos - gastos), previstoIngresos: r2(previstoIngresos), previstoGastos: r2(previstoGastos) }
}

export interface PorCategoria {
  id: string
  nombre: string
  emoji: string
  slot?: number
  total: number
}

/** Gasto por categoría, de mayor a menor. Las categorías sin color se agrupan en "Otras". */
export function gastoPorCategoria(movs: Movimiento[], cats: Categoria[], month: string, hoy = today()): PorCategoria[] {
  const totals = new Map<string, number>()
  for (const m of movs) {
    if (m.clase === 'ingreso' || m.clase === 'traspaso' || monthOf(m.fecha) !== month || m.fecha > hoy) continue
    totals.set(m.categoriaId, (totals.get(m.categoriaId) ?? 0) + m.importe)
  }
  const out: PorCategoria[] = []
  let otras = 0
  for (const [id, total] of totals) {
    const c = cats.find((x) => x.id === id)
    if (c?.slot === undefined) otras += total
    else out.push({ id, nombre: c.nombre, emoji: c.emoji, slot: c.slot, total: r2(total) })
  }
  out.sort((a, b) => b.total - a.total)
  if (otras > 0) out.push({ id: '__otras', nombre: 'Otras', emoji: '📦', total: r2(otras) })
  return out
}

/** Gasto variable acumulado día a día, junto al del mes anterior. */
export function acumuladoDiario(movs: Movimiento[], month: string, hoy: string) {
  const prev = addMonths(month, -1)
  const porDia = (mes: string) => {
    const arr = new Array(daysInMonth(mes)).fill(0)
    for (const m of movs) {
      if (m.clase === 'variable' && monthOf(m.fecha) === mes) arr[Number(m.fecha.slice(8)) - 1] += m.importe
    }
    return arr
  }
  const actual = porDia(month)
  const anterior = porDia(prev)
  const hasta = monthOf(hoy) === month ? Number(hoy.slice(8)) : month < monthOf(hoy) ? actual.length : 0
  let a = 0
  let b = 0
  return actual.map((v, i) => {
    a += v
    b += anterior[i] ?? 0
    return {
      dia: i + 1,
      actual: i < hasta ? r2(a) : null,
      anterior: i < anterior.length ? r2(b) : null,
    }
  })
}

export function ultimosMeses(movs: Movimiento[], month: string, n = 6) {
  return Array.from({ length: n }, (_, i) => {
    const m = addMonths(month, i - n + 1)
    return { mes: m, label: shortMonthLabel(m), ...resumenMes(movs, m) }
  })
}
