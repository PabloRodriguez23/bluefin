import { useState } from 'react'
import { conectarBanco, diasRestantes, estadoConexion, useBancos, type ConexionBanco } from '../lib/banco'
import { toast } from '../store/useToast'

const fecha = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' })

/** Aviso en toda la app cuando una conexión bancaria está a punto de caducar o ya ha caducado. */
export function AvisoBancos({ onVerAjustes }: { onVerAjustes: () => void }) {
  const { conexiones } = useBancos()
  const [ocultos, setOcultos] = useState<string[]>([])
  const [renovando, setRenovando] = useState<string | null>(null)

  const avisos = (conexiones ?? []).filter((c) => estadoConexion(c) !== 'ok' && !ocultos.includes(c.id))
  if (!avisos.length) return null

  const renovar = async (c: ConexionBanco) => {
    setRenovando(c.id)
    try {
      await conectarBanco(c.banco, c.pais)
    } catch (e) {
      setRenovando(null)
      toast(`❌ ${(e as Error).message}`)
    }
  }

  return (
    <div className="avisos-banco">
      {avisos.map((c) => {
        const caducada = estadoConexion(c) === 'caducada'
        const dias = diasRestantes(c)
        return (
          <div key={c.id} className={`aviso-banco ${caducada ? 'caducada' : 'pronto'}`} role="alert">
            <div className="aviso-texto">
              <strong>{caducada ? `Se ha perdido el acceso a ${c.banco}` : `El acceso a ${c.banco} caduca ${dias === 0 ? 'hoy' : `en ${dias} ${dias === 1 ? 'día' : 'días'}`}`}</strong>
              <span>
                {caducada
                  ? 'Tus movimientos ya no se importan. Vuelve a conectarlo para seguir al día.'
                  : `Hasta el ${fecha.format(new Date(c.valido_hasta))}. Renuévalo para no perder movimientos; tarda un minuto.`}
              </span>
            </div>
            <div className="aviso-acciones">
              <button className="btn btn-primary" onClick={() => renovar(c)} disabled={renovando === c.id}>
                {renovando === c.id ? 'Abriendo…' : caducada ? 'Reconectar' : 'Renovar'}
              </button>
              {!caducada && (
                <button className="btn btn-ghost" onClick={() => setOcultos((o) => [...o, c.id])}>
                  Luego
                </button>
              )}
              {caducada && (
                <button className="btn btn-ghost" onClick={onVerAjustes}>
                  Ver
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
