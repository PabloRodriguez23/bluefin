/**
 * Sincronización con Supabase.
 *
 * El store local (Zustand + localStorage) sigue siendo la fuente para la UI, así la app
 * responde al instante y funciona sin conexión. Este módulo:
 *  1. Detecta cada cambio local comparando el estado anterior con el nuevo y lo mete
 *     en una cola persistente (outbox) que se sube en lote cuando hay conexión.
 *  2. Escucha los cambios de otros dispositivos por Realtime y los aplica en local.
 */
import { create } from 'zustand'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Categoria, DatosFinanzas, Fijo, Movimiento } from '../types'
import { useFinanzas } from '../store/useFinanzas'
import { DEFAULT_CATEGORIAS } from './categories'
import { supabase } from './supabase'

type Tabla = 'movimientos' | 'fijos' | 'categorias' | 'ajustes'
type Row = Record<string, unknown>
/** row === null significa borrar. */
interface Op {
  tabla: Tabla
  id: string
  row: Row | null
}

export type EstadoSync = 'local' | 'sincronizando' | 'ok' | 'offline' | 'error'

export const useSync = create<{ estado: EstadoSync; pendientes: number }>(() => ({
  estado: supabase ? 'sincronizando' : 'local',
  pendientes: 0,
}))

// ===== Conversión entre el modelo de la app y las filas de la BD =====

const movToRow = (m: Movimiento): Row => ({
  id: m.id,
  clase: m.clase,
  importe: m.importe,
  categoria_id: m.categoriaId,
  asunto: m.asunto,
  fecha: m.fecha,
  fijo_id: m.fijoId ?? null,
  origen: m.origen ?? 'manual',
  comercio: m.comercio ?? null,
  sentido: m.clase === 'traspaso' ? (m.sentido ?? 'salida') : null,
  updated_at: new Date().toISOString(),
})
const rowToMov = (r: Row): Movimiento => ({
  id: String(r.id),
  clase: r.clase as Movimiento['clase'],
  importe: Number(r.importe),
  categoriaId: String(r.categoria_id),
  asunto: String(r.asunto ?? ''),
  fecha: String(r.fecha),
  ...(r.fijo_id ? { fijoId: String(r.fijo_id) } : {}),
  ...(r.origen === 'banco' ? { origen: 'banco' as const } : {}),
  ...(r.comercio ? { comercio: String(r.comercio) } : {}),
  ...(r.sentido ? { sentido: r.sentido as Movimiento['sentido'] } : {}),
})

const fijoToRow = (f: Fijo): Row => ({
  id: f.id,
  tipo: f.tipo,
  nombre: f.nombre,
  importe: f.importe,
  categoria_id: f.categoriaId,
  dia: f.dia,
  desde: f.desde,
  activo: f.activo,
  generados: f.generados,
})
const rowToFijo = (r: Row): Fijo => ({
  id: String(r.id),
  tipo: r.tipo as Fijo['tipo'],
  nombre: String(r.nombre),
  importe: Number(r.importe),
  categoriaId: String(r.categoria_id),
  dia: Number(r.dia),
  desde: String(r.desde),
  activo: Boolean(r.activo),
  generados: (r.generados as string[]) ?? [],
})

const catToRow = (c: Categoria, orden: number): Row => ({
  id: c.id,
  nombre: c.nombre,
  emoji: c.emoji,
  tipo: c.tipo,
  slot: c.slot ?? null,
  orden,
})
const rowToCat = (r: Row): Categoria => ({
  id: String(r.id),
  nombre: String(r.nombre),
  emoji: String(r.emoji),
  tipo: r.tipo as Categoria['tipo'],
  ...(r.slot !== null && r.slot !== undefined ? { slot: Number(r.slot) } : {}),
})

// ===== Cola de cambios pendientes (persistente) =====

const OUTBOX_KEY = 'mis-finanzas-outbox'
let outbox = new Map<string, Op>()
const keyOf = (tabla: Tabla, id: string) => `${tabla}:${id}`

function guardarOutbox() {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify([...outbox.values()]))
  } catch {
    /* sin almacenamiento: la cola vive solo en memoria */
  }
  useSync.setState({ pendientes: outbox.size })
}
function cargarOutbox() {
  try {
    const ops = (JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]') as Op[])
      // Cambios pendientes de versiones antiguas que guardaban un presupuesto: ya no existen
      .filter((o) => !(o.tabla === 'ajustes' && o.row && 'presupuesto' in o.row))
    outbox = new Map(ops.map((o) => [keyOf(o.tabla, o.id), o]))
  } catch {
    outbox = new Map()
  }
  useSync.setState({ pendientes: outbox.size })
}
function encolar(op: Op) {
  outbox.set(keyOf(op.tabla, op.id), op)
}

/** Encola las diferencias entre dos listas cuyos elementos se actualizan de forma inmutable. */
function diffLista<T extends { id: string }>(tabla: Tabla, prev: T[], next: T[], toRow: (x: T, i: number) => Row, porIndice = false) {
  if (prev === next) return
  const antes = new Map(prev.map((x, i) => [x.id, { x, i }]))
  next.forEach((x, i) => {
    const a = antes.get(x.id)
    if (!a || a.x !== x || (porIndice && a.i !== i)) encolar({ tabla, id: x.id, row: toRow(x, i) })
    antes.delete(x.id)
  })
  for (const id of antes.keys()) encolar({ tabla, id, row: null })
}

function encolarDiferencias(prev: DatosFinanzas, next: DatosFinanzas) {
  diffLista('movimientos', prev.movimientos, next.movimientos, movToRow)
  diffLista('fijos', prev.fijos, next.fijos, fijoToRow)
  diffLista('categorias', prev.categorias, next.categorias, catToRow, true)
  if (prev.colchon !== next.colchon) encolar({ tabla: 'ajustes', id: 'ajustes', row: { colchon: next.colchon } })
}

const VACIO: DatosFinanzas = { movimientos: [], fijos: [], categorias: [], colchon: null }

// ===== Subida =====

let uid: string | null = null
let subiendo = false
let reintento: ReturnType<typeof setTimeout> | undefined
let programado: ReturnType<typeof setTimeout> | undefined

function programarSubida(ms = 400) {
  clearTimeout(programado)
  programado = setTimeout(() => void subir(), ms)
}

async function subir(): Promise<boolean> {
  if (!supabase || !uid) return false
  if (subiendo) return false
  if (!outbox.size) {
    useSync.setState({ estado: navigator.onLine ? 'ok' : 'offline' })
    return true
  }
  if (!navigator.onLine) {
    useSync.setState({ estado: 'offline' })
    return false
  }
  subiendo = true
  useSync.setState({ estado: 'sincronizando' })
  const lote = [...outbox.values()]
  let ok = true
  try {
    for (const tabla of ['categorias', 'fijos', 'movimientos', 'ajustes'] as Tabla[]) {
      const ops = lote.filter((o) => o.tabla === tabla)
      const upserts = ops.filter((o) => o.row)
      const borrados = ops.filter((o) => !o.row)
      if (upserts.length) {
        const rows = upserts.map((o) => ({ ...o.row, user_id: uid }))
        const { error } = await supabase
          .from(tabla)
          .upsert(rows, { onConflict: tabla === 'ajustes' ? 'user_id' : 'user_id,id' })
        if (error) throw error
      }
      if (borrados.length) {
        const { error } = await supabase
          .from(tabla)
          .delete()
          .eq('user_id', uid)
          .in('id', borrados.map((o) => o.id))
        if (error) throw error
      }
      // Solo quitamos de la cola lo que no ha vuelto a cambiar mientras subíamos
      for (const o of ops) if (outbox.get(keyOf(o.tabla, o.id)) === o) outbox.delete(keyOf(o.tabla, o.id))
      guardarOutbox()
    }
  } catch (e) {
    ok = false
    console.error('[sync] error al subir', e)
    useSync.setState({ estado: navigator.onLine ? 'error' : 'offline' })
    clearTimeout(reintento)
    reintento = setTimeout(() => void subir(), 15_000)
  } finally {
    subiendo = false
  }
  if (ok) {
    if (outbox.size) return subir()
    useSync.setState({ estado: 'ok' })
  }
  return ok
}

// ===== Bajada =====

let aplicandoRemoto = false
function aplicarRemoto(fn: () => void) {
  aplicandoRemoto = true
  try {
    fn()
  } finally {
    aplicandoRemoto = false
  }
}

async function descargar(): Promise<DatosFinanzas & { vacio: boolean }> {
  const sb = supabase!
  const [m, f, c, a] = await Promise.all([
    sb.from('movimientos').select('*'),
    sb.from('fijos').select('*'),
    sb.from('categorias').select('*').order('orden'),
    sb.from('ajustes').select('*').maybeSingle(),
  ])
  const error = m.error ?? f.error ?? c.error ?? a.error
  if (error) throw error
  return {
    movimientos: (m.data ?? []).map(rowToMov),
    fijos: (f.data ?? []).map(rowToFijo),
    categorias: (c.data ?? []).map(rowToCat),
    colchon: a.data?.colchon != null ? Number(a.data.colchon) : null,
    vacio: !m.data?.length && !f.data?.length && !c.data?.length,
  }
}

/** Trae todo de la nube y lo pone en local (si no quedan cambios locales por subir). */
async function refrescar() {
  if (!listo) return cargaInicial()
  if (!(await subir()) || outbox.size) return
  try {
    const d = await descargar()
    aplicarRemoto(() =>
      useFinanzas.setState({
        movimientos: d.movimientos,
        fijos: d.fijos,
        categorias: d.categorias.length ? d.categorias : DEFAULT_CATEGORIAS,
        colchon: d.colchon,
      }),
    )
  } catch (e) {
    console.error('[sync] error al descargar', e)
  }
}

function upsertLocal<T extends { id: string }>(lista: T[], item: T): T[] {
  const i = lista.findIndex((x) => x.id === item.id)
  return i === -1 ? [...lista, item] : lista.map((x, j) => (j === i ? item : x))
}

function onCambioRemoto(tabla: Tabla, p: RealtimePostgresChangesPayload<Row>) {
  const nuevo = p.new as Row
  const viejo = p.old as Row
  // Los DELETE no se filtran por usuario en Realtime: comprobamos a mano
  const filaUid = p.eventType === 'DELETE' ? viejo.user_id : nuevo.user_id
  if (filaUid !== uid) return
  const id = tabla === 'ajustes' ? 'ajustes' : String((p.eventType === 'DELETE' ? viejo : nuevo).id)
  // Si tenemos un cambio local pendiente para esa fila, el nuestro es más reciente
  if (outbox.has(keyOf(tabla, id))) return

  aplicarRemoto(() =>
    useFinanzas.setState((s) => {
      const borrar = p.eventType === 'DELETE'
      switch (tabla) {
        case 'movimientos':
          return { movimientos: borrar ? s.movimientos.filter((x) => x.id !== id) : upsertLocal(s.movimientos, rowToMov(nuevo)) }
        case 'fijos':
          return { fijos: borrar ? s.fijos.filter((x) => x.id !== id) : upsertLocal(s.fijos, rowToFijo(nuevo)) }
        case 'categorias': {
          if (borrar) return { categorias: s.categorias.filter((x) => x.id !== id) }
          const lista = upsertLocal(s.categorias, rowToCat(nuevo))
          const orden = (c: Categoria) => (c.id === id ? Number(nuevo.orden) : s.categorias.indexOf(c))
          return { categorias: [...lista].sort((a, b) => orden(a) - orden(b)) }
        }
        case 'ajustes':
          return { colchon: borrar || nuevo.colchon == null ? null : Number(nuevo.colchon) }
      }
    }),
  )
}

// ===== Ciclo de vida =====

let limpiar: (() => void) | null = null
/** true cuando la carga inicial terminó bien; hasta entonces no se reemplaza nada en local. */
let listo = false
let cargando: Promise<void> | null = null

function cargaInicial(): Promise<void> {
  cargando ??= (async () => {
    const userId = uid
    try {
      await subir()
      const remoto = await descargar()
      if (uid !== userId) return
      if (remoto.vacio) {
        // Primera vez con esta cuenta: subimos lo que hubiera en este dispositivo
        encolarDiferencias(VACIO, useFinanzas.getState())
        guardarOutbox()
      } else if (!outbox.size) {
        aplicarRemoto(() =>
          useFinanzas.setState({
            movimientos: remoto.movimientos,
            fijos: remoto.fijos,
            categorias: remoto.categorias.length ? remoto.categorias : DEFAULT_CATEGORIAS,
            colchon: remoto.colchon,
          }),
        )
      }
      useFinanzas.getState().aplicarFijos()
      listo = true
      await subir()
    } catch (e) {
      console.error('[sync] error en la carga inicial', e)
      useSync.setState({ estado: navigator.onLine ? 'error' : 'offline' })
    } finally {
      cargando = null
    }
  })()
  return cargando
}

export async function iniciarSync(userId: string) {
  if (!supabase || uid === userId) return
  detenerSync()
  uid = userId
  cargarOutbox()
  useSync.setState({ estado: 'sincronizando' })

  // 1. Escuchar cambios locales
  const unsubStore = useFinanzas.subscribe((s, prev) => {
    if (aplicandoRemoto || !uid) return
    encolarDiferencias(prev, s)
    guardarOutbox()
    programarSubida()
  })

  // 2. Escuchar cambios de otros dispositivos
  let canal: RealtimeChannel = supabase.channel(`finanzas-${userId}`)
  for (const tabla of ['movimientos', 'fijos', 'categorias', 'ajustes'] as Tabla[]) {
    canal = canal.on<Row>(
      'postgres_changes',
      { event: '*', schema: 'public', table: tabla, filter: `user_id=eq.${userId}` },
      (p) => onCambioRemoto(tabla, p),
    )
  }
  canal.subscribe((status) => {
    // Al reconectar puede que nos hayamos perdido eventos
    if (status === 'SUBSCRIBED') void refrescar()
  })

  const onOnline = () => void refrescar()
  const onVisible = () => document.visibilityState === 'visible' && void refrescar()
  const onOffline = () => useSync.setState({ estado: 'offline' })
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onVisible)

  limpiar = () => {
    unsubStore()
    void supabase?.removeChannel(canal)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    document.removeEventListener('visibilitychange', onVisible)
    clearTimeout(reintento)
    clearTimeout(programado)
  }

  // 3. Carga inicial
  await cargaInicial()
}

export function detenerSync() {
  limpiar?.()
  limpiar = null
  uid = null
  listo = false
}

/** Al cerrar sesión: paramos la sincronización y vaciamos los datos de este dispositivo. */
export async function cerrarSesion() {
  await subir()
  detenerSync()
  outbox.clear()
  guardarOutbox()
  useFinanzas.getState().borrarTodo()
  await supabase?.auth.signOut()
}
