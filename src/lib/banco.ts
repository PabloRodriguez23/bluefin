import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface BancoDisponible {
  nombre: string
  pais: string
  logo?: string
  beta: boolean
}

export interface ConexionBanco {
  id: string
  banco: string
  pais: string
  logo: string | null
  cuentas: { uid: string; iban?: string; nombre?: string }[]
  valido_hasta: string
  ultima_sync: string | null
  error: string | null
}

async function llamar<T>(ruta: string, body?: object): Promise<T> {
  if (!supabase) throw new Error('Supabase no está configurado')
  const { data, error } = await supabase.functions.invoke(`banco/${ruta}`, {
    method: body ? 'POST' : 'GET',
    body,
  })
  if (error) {
    // El cuerpo de la respuesta trae el mensaje real
    const detalle = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(detalle?.error ?? error.message)
  }
  return data as T
}

export const listarBancos = (pais = 'ES') => llamar<BancoDisponible[]>(`bancos?pais=${pais}`)

export async function conectarBanco(banco: string, pais = 'ES') {
  const volver = new URL(window.location.href)
  volver.search = ''
  volver.hash = ''
  const { url } = await llamar<{ url: string }>('conectar', { banco, pais, volver_a: volver.toString() })
  window.location.href = url
}

export const sincronizarBancos = () =>
  llamar<{ resultados: { id: string; nuevos?: number; error?: string }[] }>('sincronizar', {})

export const desconectarBanco = (id: string) => llamar('desconectar', { id })

export const guardarRegla = (comercio: string, categoria_id: string) => llamar('regla', { comercio, categoria_id })

/** Normalización igual que en el servidor, para aplicar una regla a los movimientos ya importados. */
export const patronDe = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\b(compra|tarj|tarjeta|pago|recibo|transferencia|transf|bizum|en|de|sl|sa|slu|es|www|com)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const diasRestantes = (c: ConexionBanco) => Math.floor((new Date(c.valido_hasta).getTime() - Date.now()) / 86_400_000)

/** Conexiones bancarias del usuario, actualizadas en tiempo real. */
export function useBancos(activo = true) {
  const [conexiones, setConexiones] = useState<ConexionBanco[] | null>(null)

  const cargar = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.from('bancos').select('*').order('created_at')
    setConexiones((data as ConexionBanco[]) ?? [])
  }, [])

  useEffect(() => {
    if (!supabase || !activo) return
    void cargar()
    const canal = supabase
      .channel('bancos-cambios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bancos' }, () => void cargar())
      .subscribe()
    return () => void supabase?.removeChannel(canal)
  }, [activo, cargar])

  return { conexiones, recargar: cargar }
}
