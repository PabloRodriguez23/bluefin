import { useSync, type EstadoSync } from '../lib/sync'

const TEXTO: Record<EstadoSync, string> = {
  local: 'Solo en este dispositivo',
  sincronizando: 'Sincronizando…',
  ok: 'Sincronizado',
  offline: 'Sin conexión',
  error: 'Error al sincronizar',
  demo: 'Demo · datos ficticios',
}

export function SyncBadge() {
  const { estado, pendientes } = useSync()
  const detalle = pendientes && estado !== 'sincronizando' ? ` · ${pendientes} pendientes` : ''
  return (
    <span className={`sync sync-${estado}`} title={TEXTO[estado] + detalle} role="status">
      <i />
      <span className="sync-text">
        {TEXTO[estado]}
        {detalle}
      </span>
    </span>
  )
}
