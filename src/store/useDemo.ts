import { create } from 'zustand'
import { createJSONStorage } from 'zustand/middleware'
import { useFinanzas } from './useFinanzas'
import { useSync } from '../lib/sync'
import { crearDemo } from '../lib/demo'

interface DemoState {
  activo: boolean
  entrar: () => void
  salir: () => void
}

/** Almacenamiento en memoria: en la demo nada se escribe en el navegador. */
const memoria = new Map<string, string>()
const almacenEnMemoria = {
  getItem: (k: string) => memoria.get(k) ?? null,
  setItem: (k: string, v: string) => void memoria.set(k, v),
  removeItem: (k: string) => void memoria.delete(k),
}

/**
 * Modo demo: datos ficticios y solo lectura, sin cuenta y sin tocar Supabase.
 * Los datos reales guardados en este navegador no se modifican.
 */
export const useDemo = create<DemoState>((set) => ({
  activo: false,
  entrar: () => {
    // Primero se desconecta el guardado en localStorage y después se cargan los datos ficticios
    useFinanzas.persist.setOptions({ storage: createJSONStorage(() => almacenEnMemoria) })
    useFinanzas.setState({ ...crearDemo(), tema: useFinanzas.getState().tema })
    useSync.setState({ estado: 'demo', pendientes: 0 })
    set({ activo: true })
  },
  salir: () => {
    // Recargar devuelve la app a su estado real, leído de nuevo del navegador
    const url = new URL(window.location.href)
    url.searchParams.delete('demo')
    window.location.replace(url.toString())
  },
}))

/** ¿Se ha pedido la demo por enlace? (p. ej. https://…/bluefin/?demo) */
export const demoPorEnlace = () => new URLSearchParams(window.location.search).has('demo')
