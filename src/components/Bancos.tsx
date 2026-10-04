import { useEffect, useMemo, useState } from 'react'
import {
  conectarBanco,
  desconectarBanco,
  diasRestantes,
  listarBancos,
  sincronizarBancos,
  useBancos,
  type BancoDisponible,
  type ConexionBanco,
} from '../lib/banco'
import { toast } from '../store/useToast'
import { Sheet } from './Sheet'

const fechaHora = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const ocultarIban = (iban?: string) => (iban ? `···· ${iban.slice(-4)}` : '')

export function Bancos() {
  const { conexiones } = useBancos()
  const [eligiendo, setEligiendo] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)

  const sincronizar = async () => {
    setSincronizando(true)
    try {
      const { resultados } = await sincronizarBancos()
      const nuevos = resultados.reduce((a, r) => a + (r.nuevos ?? 0), 0)
      const errores = resultados.filter((r) => r.error)
      toast(errores.length ? `⚠️ ${errores[0].error}` : nuevos ? `🏦 ${nuevos} movimientos nuevos` : 'Todo al día ✓')
    } catch (e) {
      toast(`❌ ${(e as Error).message}`)
    } finally {
      setSincronizando(false)
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>🏦 Bancos conectados</h2>
          <p className="muted small">Tus gastos e ingresos se importan y categorizan solos varias veces al día.</p>
        </div>
        {!!conexiones?.length && (
          <button className="btn" onClick={sincronizar} disabled={sincronizando}>
            {sincronizando ? 'Sincronizando…' : '🔄 Sincronizar ahora'}
          </button>
        )}
      </div>

      {conexiones === null ? (
        <p className="muted small">Cargando…</p>
      ) : (
        <ul className="bancos-list">
          {conexiones.map((c) => (
            <ConexionItem key={c.id} c={c} />
          ))}
        </ul>
      )}

      <button className="btn btn-primary" onClick={() => setEligiendo(true)}>＋ Conectar banco</button>
      <p className="muted small nota-segura">
        🔒 Acceso de <strong>solo lectura</strong> mediante Open Banking (PSD2). Te identificas en la web oficial de tu banco: la
        app nunca ve tus claves y no puede mover dinero.
      </p>

      <Sheet open={eligiendo} title="Elige tu banco" onClose={() => setEligiendo(false)}>
        <ElegirBanco />
      </Sheet>
    </div>
  )
}

function ConexionItem({ c }: { c: ConexionBanco }) {
  const dias = diasRestantes(c)
  const caducado = dias < 0
  const desconectar = async () => {
    if (!confirm(`¿Desconectar ${c.banco}? Los movimientos ya importados se conservan.`)) return
    try {
      await desconectarBanco(c.id)
      toast('Banco desconectado')
    } catch (e) {
      toast(`❌ ${(e as Error).message}`)
    }
  }

  return (
    <li className="banco">
      {c.logo ? <img src={c.logo} alt="" className="banco-logo" /> : <span className="banco-logo">🏦</span>}
      <div className="banco-main">
        <strong>{c.banco}</strong>
        <span className="muted small">
          {c.cuentas.map((x) => x.nombre || ocultarIban(x.iban)).filter(Boolean).join(' · ') || `${c.cuentas.length} cuentas`}
        </span>
        <span className="muted small">
          {c.ultima_sync ? `Última sincronización: ${fechaHora.format(new Date(c.ultima_sync))}` : 'Pendiente de sincronizar'}
        </span>
        {caducado ? (
          <span className="banco-aviso">⚠️ La autorización ha caducado: desconéctalo y vuelve a conectarlo.</span>
        ) : dias <= 15 ? (
          <span className="banco-aviso">⏳ La autorización caduca en {dias} días: tendrás que volver a conectarlo.</span>
        ) : null}
        {c.error && !caducado && <span className="banco-aviso">⚠️ {c.error}</span>}
      </div>
      <button className="btn btn-ghost btn-danger" onClick={desconectar}>Desconectar</button>
    </li>
  )
}

function ElegirBanco() {
  const [bancos, setBancos] = useState<BancoDisponible[] | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [conectando, setConectando] = useState<string | null>(null)
  const [pais, setPais] = useState('ES')

  useEffect(() => {
    let vigente = true
    listarBancos(pais).then(
      (b) => vigente && setBancos(b),
      (e: Error) => vigente && setError(e.message),
    )
    return () => {
      vigente = false
    }
  }, [pais])

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (bancos ?? []).filter((b) => b.nombre.toLowerCase().includes(t))
  }, [bancos, q])

  const elegir = async (b: BancoDisponible) => {
    setConectando(b.nombre)
    try {
      await conectarBanco(b.nombre, b.pais)
    } catch (e) {
      setConectando(null)
      toast(`❌ ${(e as Error).message}`)
    }
  }

  if (error) return <p className="form-error">No se pudo cargar la lista de bancos: {error}</p>

  return (
    <>
      <div className="inline-form">
        <input type="search" autoFocus placeholder="🔍 Busca tu banco…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select
          className="pais-select"
          value={pais}
          onChange={(e) => {
            setBancos(null)
            setPais(e.target.value)
          }}
          aria-label="País del banco"
        >
          <option value="ES">🇪🇸 España</option>
          <option value="LT">🇱🇹 Lituania</option>
          <option value="IE">🇮🇪 Irlanda</option>
          <option value="DE">🇩🇪 Alemania</option>
          <option value="PT">🇵🇹 Portugal</option>
        </select>
      </div>
      {!bancos && <p className="muted">Cargando bancos…</p>}
      <ul className="bancos-elegir">
        {filtrados.map((b) => (
          <li key={b.nombre}>
            <button className="tx" onClick={() => elegir(b)} disabled={!!conectando}>
              {b.logo ? <img src={b.logo} alt="" className="banco-logo" /> : <span className="banco-logo">🏦</span>}
              <span className="tx-main">
                <span className="tx-title">{b.nombre}</span>
                {b.beta && <span className="muted small">Beta</span>}
              </span>
              <span className="muted">{conectando === b.nombre ? 'Abriendo…' : '›'}</span>
            </button>
          </li>
        ))}
        {bancos && !filtrados.length && (
          <p className="empty">No hay resultados con ese nombre.</p>
        )}
      </ul>
    </>
  )
}
