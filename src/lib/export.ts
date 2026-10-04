import type { Categoria, DatosFinanzas, Movimiento } from '../types'
import { today } from './dates'

function descargar(contenido: string, nombre: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportarJSON(d: DatosFinanzas) {
  descargar(JSON.stringify({ app: 'bluefin', version: 1, ...d }, null, 2), `bluefin-${today()}.json`, 'application/json')
}

const CLASE = { fijo: 'Gasto fijo', variable: 'Gasto variable', ingreso: 'Ingreso', traspaso: 'Traspaso' } as const

/** Excel ejecuta como fórmula un texto que empiece por = + - @ (o tabulador): se neutraliza con una comilla. */
const FORMULA = /^[=+\-@\t\r]/

const celda = (s: string) => {
  const seguro = FORMULA.test(s) ? `'${s}` : s
  return `"${seguro.replace(/"/g, '""')}"`
}

/** CSV con ";" y BOM para que Excel en español lo abra directamente. */
export function exportarCSV(movs: Movimiento[], cats: Categoria[]) {
  const filas = [...movs]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((m) => {
      const c = cats.find((x) => x.id === m.categoriaId)
      const entra = m.clase === 'ingreso' || (m.clase === 'traspaso' && m.sentido === 'entrada')
      const importe = (entra ? m.importe : -m.importe).toFixed(2).replace('.', ',')
      return [m.fecha, CLASE[m.clase], celda(c?.nombre ?? ''), celda(m.asunto), importe].join(';')
    })
  descargar('﻿' + ['Fecha;Tipo;Categoría;Asunto;Importe', ...filas].join('\r\n'), `bluefin-movimientos-${today()}.csv`, 'text/csv')
}

export async function leerJSON(file: File): Promise<DatosFinanzas> {
  const d = JSON.parse(await file.text())
  if (!Array.isArray(d?.movimientos)) throw new Error('El archivo no es una copia válida')
  return d
}
