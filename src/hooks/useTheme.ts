import { useEffect, useSyncExternalStore } from 'react'
import { useFinanzas } from '../store/useFinanzas'
import type { ModoColor } from '../lib/palette'

const mq = window.matchMedia('(prefers-color-scheme: dark)')
const subscribe = (cb: () => void) => {
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

/** Aplica el tema elegido al <html> y devuelve el modo efectivo. */
export function useTheme(): ModoColor {
  const tema = useFinanzas((s) => s.tema)
  const sistemaOscuro = useSyncExternalStore(subscribe, () => mq.matches)
  const modo: ModoColor = tema === 'auto' ? (sistemaOscuro ? 'dark' : 'light') : tema

  useEffect(() => {
    const root = document.documentElement
    if (tema === 'auto') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', tema)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', modo === 'dark' ? '#0a1220' : '#1c5cab')
  }, [tema, modo])

  return modo
}
