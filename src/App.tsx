import { useEffect, useState } from 'react'
import type { Fijo, Movimiento } from './types'
import { useFinanzas } from './store/useFinanzas'
import { useToast } from './store/useToast'
import { useTheme } from './hooks/useTheme'
import { useAuth } from './hooks/useAuth'
import { addMonths, currentMonth, monthLabel } from './lib/dates'
import { Resumen } from './views/Resumen'
import { Movimientos } from './views/Movimientos'
import { Fijos } from './views/Fijos'
import { Ajustes } from './views/Ajustes'
import { TxDialog } from './components/TxDialog'
import { FijoDialog } from './components/FijoDialog'
import { SyncBadge } from './components/SyncBadge'
import { AvisoBancos } from './components/AvisoBancos'
import { Login } from './views/Login'
import { toast } from './store/useToast'
import { sincronizarBancos } from './lib/banco'
import { supabase } from './lib/supabase'
import { demoPorEnlace, useDemo } from './store/useDemo'
import { AjustesDemo } from './views/AjustesDemo'

type Vista = 'resumen' | 'movimientos' | 'fijos' | 'ajustes'

const VISTAS: { id: Vista; ico: string; label: string }[] = [
  { id: 'resumen', ico: '📊', label: 'Resumen' },
  { id: 'movimientos', ico: '📋', label: 'Movimientos' },
  { id: 'fijos', ico: '🔁', label: 'Fijos' },
  { id: 'ajustes', ico: '⚙️', label: 'Ajustes' },
]

export default function App() {
  const modo = useTheme()
  const session = useAuth()
  const demo = useDemo((s) => s.activo)
  const entrarDemo = useDemo((s) => s.entrar)

  // Enlace directo a la demo (…/?demo). Nunca con una sesión abierta: los datos ficticios
  // se sincronizarían con la cuenta real.
  useEffect(() => {
    if (session === null && !demo && demoPorEnlace()) entrarDemo()
  }, [session, demo, entrarDemo])

  if (session === undefined) return <div className="splash" aria-busy="true" />
  if (demo && !session) return <Principal modo={modo} demo />
  if (session === null && import.meta.env.VITE_SUPABASE_URL) return demoPorEnlace() ? <div className="splash" /> : <Login />
  return <Principal modo={modo} email={session?.user.email} />
}

function Principal({ modo, email, demo = false }: { modo: ReturnType<typeof useTheme>; email?: string; demo?: boolean }) {
  const salirDemo = useDemo((s) => s.salir)
  const aplicarFijos = useFinanzas((s) => s.aplicarFijos)
  const mensaje = useToast((s) => s.mensaje)

  // ?banco=ok|error|cancelado al volver de la web del banco
  const [retornoBanco] = useState(() => new URLSearchParams(window.location.search).get('banco'))
  const [vista, setVista] = useState<Vista>(retornoBanco ? (retornoBanco === 'ok' ? 'movimientos' : 'ajustes') : 'resumen')
  const [month, setMonth] = useState(currentMonth)
  const [tx, setTx] = useState<{ open: boolean; mov: Movimiento | null }>({ open: false, mov: null })
  const [fijo, setFijo] = useState<{ open: boolean; fijo: Fijo | null }>({ open: false, fijo: null })

  // Al abrir la app (o volver a ella) se apuntan los fijos del mes que falten
  useEffect(() => {
    aplicarFijos()
    const onVisible = () => document.visibilityState === 'visible' && aplicarFijos()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [aplicarFijos])

  // Vuelta desde la web del banco tras autorizar
  useEffect(() => {
    const banco = retornoBanco
    if (!banco) return
    const nuevos = Number(new URLSearchParams(window.location.search).get('nuevos') ?? 0)
    toast(
      banco === 'ok'
        ? `🏦 Banco conectado${nuevos ? ` · ${nuevos} movimientos importados` : ''}`
        : banco === 'cancelado'
          ? 'Conexión con el banco cancelada'
          : '⚠️ Banco conectado, pero hubo un error al importar. Mira Ajustes.',
    )
    window.history.replaceState(null, '', window.location.pathname)
  }, [retornoBanco])

  // Al abrir la app, si hace rato que no se importa del banco, se importa ahora
  useEffect(() => {
    if (!email || !supabase) return
    void (async () => {
      const { data } = await supabase.from('bancos').select('ultima_sync').gt('valido_hasta', new Date().toISOString())
      const hace = Date.now() - 2 * 3600_000
      if (data?.some((c) => !c.ultima_sync || new Date(c.ultima_sync).getTime() < hace)) {
        const { resultados } = await sincronizarBancos().catch(() => ({ resultados: [] as { nuevos?: number }[] }))
        const n = resultados.reduce((a, r) => a + (r.nuevos ?? 0), 0)
        if (n) toast(`🏦 ${n} movimientos nuevos del banco`)
      }
    })()
  }, [email])

  const ir = (v: Vista) => {
    setVista(v)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const soloLectura = () => toast('Demo de solo lectura: aquí no se pueden añadir ni cambiar datos')
  const nuevo = () => (demo ? soloLectura() : setTx({ open: true, mov: null }))
  const editar = (mov: Movimiento) => setTx({ open: true, mov })
  const conMes = vista === 'resumen' || vista === 'movimientos'

  return (
    <div className="app">
      <nav className="nav" aria-label="Secciones">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" width={36} height={36} />
          <span>Bluefin</span>
        </div>
        <div className="nav-sync">
          <SyncBadge />
        </div>
        {VISTAS.map((v, i) => (
          <NavItem key={v.id} {...v} active={vista === v.id} onClick={() => ir(v.id)} after={i === 1 ? nuevo : undefined} />
        ))}
      </nav>

      <main className="main">
        <header className="topbar">
          {conMes ? (
            <div className="month-picker">
              <button className="icon-btn" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Mes anterior">‹</button>
              <h1>
                <button className="month-label" onClick={() => setMonth(currentMonth())} title="Volver al mes actual">
                  {monthLabel(month)}
                </button>
              </h1>
              <button className="icon-btn" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Mes siguiente">›</button>
            </div>
          ) : (
            <h1 className="view-title">{VISTAS.find((v) => v.id === vista)?.label}</h1>
          )}
          <div className="mobile-only">
            <SyncBadge />
          </div>
          <button className="btn btn-primary desktop-only" onClick={nuevo}>＋ Añadir</button>
        </header>

        {demo && (
          <div className="demo-banner" role="note">
            <span>
              <strong>Demo</strong> con datos ficticios y de solo lectura. Explora el resumen, los movimientos y las gráficas.
            </span>
            <button className="btn btn-ghost" onClick={salirDemo}>Salir de la demo</button>
          </div>
        )}
        {email && <AvisoBancos onVerAjustes={() => ir('ajustes')} />}

        <section className="view" key={vista}>
          {vista === 'resumen' && (
            <Resumen month={month} modo={modo} onMonth={setMonth} onEdit={editar} onVerTodos={() => ir('movimientos')} onAdd={nuevo} />
          )}
          {vista === 'movimientos' && <Movimientos month={month} modo={modo} onEdit={editar} />}
          {vista === 'fijos' && (
            <Fijos modo={modo} onEdit={(f) => (demo && !f ? soloLectura() : setFijo({ open: true, fijo: f }))} />
          )}
          {vista === 'ajustes' && (demo ? <AjustesDemo modo={modo} /> : <Ajustes modo={modo} email={email} />)}
        </section>
      </main>

      <TxDialog open={tx.open} mov={tx.mov} month={month} soloLectura={demo} onClose={() => setTx({ open: false, mov: null })} />
      <FijoDialog open={fijo.open} fijo={fijo.fijo} soloLectura={demo} onClose={() => setFijo({ open: false, fijo: null })} />

      <div className={`toast${mensaje ? ' show' : ''}`} role="status" aria-live="polite">
        {mensaje}
      </div>
    </div>
  )
}

interface NavItemProps {
  ico: string
  label: string
  active: boolean
  onClick: () => void
  /** En móvil, el botón central "+" va entre Movimientos y Fijos. */
  after?: () => void
}

function NavItem({ ico, label, active, onClick, after }: NavItemProps) {
  return (
    <>
      <button className={`nav-btn${active ? ' active' : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined}>
        <span className="ico">{ico}</span>
        <span>{label}</span>
      </button>
      {after && (
        <button className="nav-btn nav-add" onClick={after} aria-label="Añadir movimiento">
          <span className="ico">＋</span>
        </button>
      )}
    </>
  )
}
