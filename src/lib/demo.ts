import type { DatosFinanzas, Fijo, Movimiento } from '../types'
import type { ConexionBanco } from './banco'
import { DEFAULT_CATEGORIAS } from './categories'
import { addMonths, currentMonth, dateInMonth, monthRange, today } from './dates'
import { uid } from './format'

/** Generador pseudoaleatorio con semilla, para que la demo sea estable. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const VARIABLES: [categoriaId: string, asuntos: string[], min: number, max: number, veces: number][] = [
  ['comida', ['Supermercado', 'Mercadona', 'Fruta y verdura', 'Panadería'], 12, 75, 7],
  ['ocio', ['Cena con amigos', 'Cine', 'Concierto', 'Cañas', 'Escapada finde'], 8, 70, 4],
  ['transporte', ['Gasolina', 'Metro', 'Taxi', 'Parking'], 4, 55, 4],
  ['compras', ['Ropa', 'Regalo cumpleaños', 'Amazon', 'Libro'], 10, 90, 2],
  ['salud', ['Farmacia', 'Dentista'], 6, 60, 1],
]

export function crearDemo(): DatosFinanzas {
  const r = rng(42)
  const hasta = currentMonth()
  const desde = addMonths(hasta, -5)
  const hoy = today()

  const fijos: Fijo[] = [
    { tipo: 'ingreso', nombre: 'Nómina', importe: 1850, categoriaId: 'nomina', dia: 1 },
    { tipo: 'gasto', nombre: 'Alquiler', importe: 650, categoriaId: 'vivienda', dia: 1 },
    { tipo: 'gasto', nombre: 'Luz y agua', importe: 68, categoriaId: 'facturas', dia: 5 },
    { tipo: 'gasto', nombre: 'Internet y móvil', importe: 42, categoriaId: 'facturas', dia: 10 },
    { tipo: 'gasto', nombre: 'Gimnasio', importe: 34.9, categoriaId: 'salud', dia: 3 },
    { tipo: 'gasto', nombre: 'Netflix + Spotify', importe: 23.98, categoriaId: 'suscripciones', dia: 15 },
  ].map((f) => ({
    ...(f as Omit<Fijo, 'id' | 'desde' | 'activo' | 'generados'>),
    id: uid(),
    desde,
    activo: true,
    generados: monthRange(desde, hasta),
  }))

  const movimientos: Movimiento[] = []
  for (const mes of monthRange(desde, hasta)) {
    for (const f of fijos) {
      movimientos.push({
        id: uid(),
        clase: f.tipo === 'ingreso' ? 'ingreso' : 'fijo',
        importe: f.importe,
        categoriaId: f.categoriaId,
        asunto: f.nombre,
        fecha: dateInMonth(mes, f.dia),
        fijoId: f.id,
      })
    }
    for (const [categoriaId, asuntos, min, max, veces] of VARIABLES) {
      const n = Math.max(1, Math.round(veces * (0.6 + r() * 0.8)))
      for (let i = 0; i < n; i++) {
        const fecha = dateInMonth(mes, 1 + Math.floor(r() * 28))
        if (fecha > hoy) continue
        movimientos.push({
          id: uid(),
          clase: 'variable',
          importe: Math.round((min + r() * (max - min)) * 100) / 100,
          categoriaId,
          asunto: asuntos[Math.floor(r() * asuntos.length)],
          fecha,
          // Como si viniera del banco conectado
          origen: 'banco',
        })
      }
    }
    // Paso de dinero a otra cuenta propia: no cuenta como gasto
    const fechaTraspaso = dateInMonth(mes, 2)
    if (fechaTraspaso <= hoy) {
      movimientos.push({
        id: uid(),
        clase: 'traspaso',
        sentido: 'salida',
        importe: 200,
        categoriaId: 'traspaso',
        asunto: 'Transferencia a mi otra cuenta',
        fecha: fechaTraspaso,
        origen: 'banco',
      })
    }
    if (r() > 0.6) {
      movimientos.push({
        id: uid(),
        clase: 'ingreso',
        importe: Math.round(80 + r() * 220),
        categoriaId: 'extra',
        asunto: 'Trabajo freelance',
        fecha: dateInMonth(mes, 12),
      })
    }
  }

  return { movimientos, fijos, categorias: DEFAULT_CATEGORIAS, colchon: 250 }
}

/** Banco ficticio de la demo, con saldo y una autorización vigente. */
export function bancosDemo(): ConexionBanco[] {
  const ahora = new Date()
  return [
    {
      id: 'demo',
      banco: 'Banco Demo',
      pais: 'ES',
      logo: null,
      cuentas: [{ uid: 'demo', nombre: 'Cuenta corriente', saldo: 1245.6, moneda: 'EUR', saldo_fecha: ahora.toISOString() }],
      valido_hasta: new Date(ahora.getTime() + 142 * 86_400_000).toISOString(),
      ultima_sync: new Date(ahora.getTime() - 40 * 60_000).toISOString(),
      error: null,
      created_at: new Date(ahora.getTime() - 38 * 86_400_000).toISOString(),
    },
  ]
}
