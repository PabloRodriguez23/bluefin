import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Categoria, DatosFinanzas, Fijo, Movimiento, Tema } from '../types'
import { DEFAULT_CATEGORIAS, OTROS_GASTO, OTROS_INGRESO, PROTEGIDAS } from '../lib/categories'
import { currentMonth, dateInMonth, monthRange } from '../lib/dates'
import { uid } from '../lib/format'
import { SLOTS } from '../lib/palette'
import { crearDemo } from '../lib/demo'

interface State extends DatosFinanzas {
  tema: Tema
  addMovimiento: (m: Omit<Movimiento, 'id'>) => void
  updateMovimiento: (m: Movimiento) => void
  deleteMovimiento: (id: string) => void
  addFijo: (f: Omit<Fijo, 'id' | 'generados'>) => void
  updateFijo: (f: Fijo) => void
  deleteFijo: (id: string) => void
  /** Crea los movimientos de los fijos que falten hasta el mes actual. */
  aplicarFijos: () => void
  addCategoria: (nombre: string, emoji: string) => void
  deleteCategoria: (id: string) => void
  setPresupuesto: (n: number | null) => void
  setTema: (t: Tema) => void
  importar: (d: DatosFinanzas) => void
  cargarDemo: () => void
  borrarTodo: () => void
}

const VACIO: DatosFinanzas = {
  movimientos: [],
  fijos: [],
  categorias: DEFAULT_CATEGORIAS,
  presupuesto: null,
}

/** Genera los movimientos pendientes de cada fijo activo, hasta `hasta` incluido. */
export function generarFijos(
  fijos: Fijo[],
  movimientos: Movimiento[],
  hasta = currentMonth(),
): { fijos: Fijo[]; movimientos: Movimiento[] } {
  const nuevos: Movimiento[] = []
  const actualizados = fijos.map((f) => {
    if (!f.activo || f.desde > hasta) return f
    const pendientes = monthRange(f.desde, hasta).filter((m) => !f.generados.includes(m))
    if (!pendientes.length) return f
    for (const mes of pendientes) {
      nuevos.push({
        // Id determinista: si dos dispositivos generan el mismo mes, es la misma fila
        id: `${f.id}_${mes}`,
        clase: f.tipo === 'ingreso' ? 'ingreso' : 'fijo',
        importe: f.importe,
        categoriaId: f.categoriaId,
        asunto: f.nombre,
        fecha: dateInMonth(mes, f.dia),
        fijoId: f.id,
      })
    }
    return { ...f, generados: [...f.generados, ...pendientes] }
  })
  return nuevos.length
    ? { fijos: actualizados, movimientos: [...movimientos, ...nuevos] }
    : { fijos, movimientos }
}

export const useFinanzas = create<State>()(
  persist(
    (set, get) => ({
      ...VACIO,
      tema: 'auto',

      addMovimiento: (m) => set((s) => ({ movimientos: [...s.movimientos, { ...m, id: uid() }] })),
      updateMovimiento: (m) =>
        set((s) => ({ movimientos: s.movimientos.map((x) => (x.id === m.id ? m : x)) })),
      deleteMovimiento: (id) => set((s) => ({ movimientos: s.movimientos.filter((x) => x.id !== id) })),

      addFijo: (f) => {
        const fijo: Fijo = { ...f, id: uid(), generados: [] }
        set((s) => generarFijos([...s.fijos, fijo], s.movimientos))
      },
      updateFijo: (f) => set((s) => generarFijos(s.fijos.map((x) => (x.id === f.id ? f : x)), s.movimientos)),
      // Los movimientos ya creados se conservan: son historia real.
      deleteFijo: (id) => set((s) => ({ fijos: s.fijos.filter((x) => x.id !== id) })),
      aplicarFijos: () => set((s) => generarFijos(s.fijos, s.movimientos)),

      addCategoria: (nombre, emoji) => {
        const { categorias } = get()
        const usados = new Set(categorias.map((c) => c.slot).filter((x) => x !== undefined))
        const libre = Array.from({ length: SLOTS }, (_, i) => i).find((i) => !usados.has(i))
        const nueva: Categoria = { id: uid(), nombre, emoji: emoji || '🏷️', tipo: 'gasto', slot: libre }
        // "Otros" se queda siempre al final de los gastos
        const idx = categorias.findIndex((c) => c.id === OTROS_GASTO)
        set({ categorias: [...categorias.slice(0, idx), nueva, ...categorias.slice(idx)] })
      },
      deleteCategoria: (id) => {
        if (PROTEGIDAS.has(id)) return
        set((s) => {
          const cat = s.categorias.find((c) => c.id === id)
          const destino = cat?.tipo === 'ingreso' ? OTROS_INGRESO : OTROS_GASTO
          const mover = <T extends { categoriaId: string }>(x: T) =>
            x.categoriaId === id ? { ...x, categoriaId: destino } : x
          return {
            categorias: s.categorias.filter((c) => c.id !== id),
            movimientos: s.movimientos.map(mover),
            fijos: s.fijos.map(mover),
          }
        })
      },

      setPresupuesto: (presupuesto) => set({ presupuesto }),
      setTema: (tema) => set({ tema }),
      importar: (d) =>
        set({
          categorias: d.categorias?.length ? d.categorias : DEFAULT_CATEGORIAS,
          presupuesto: d.presupuesto ?? null,
          ...generarFijos(d.fijos ?? [], d.movimientos ?? []),
        }),
      cargarDemo: () => set(crearDemo()),
      borrarTodo: () => set({ ...VACIO }),
    }),
    { name: 'mis-finanzas', version: 1 },
  ),
)

export const useCategoria = (id: string) =>
  useFinanzas((s) => s.categorias.find((c) => c.id === id))
