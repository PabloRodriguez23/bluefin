import { useMemo } from 'react'
import type { Movimiento } from '../types'
import { useFinanzas } from '../store/useFinanzas'
import { acumuladoDiario, gastoPorCategoria, resumenMes, ultimosMeses } from '../lib/stats'
import { money, pct } from '../lib/format'
import { daysInMonth, monthOf, today } from '../lib/dates'
import type { ModoColor } from '../lib/palette'
import { CategoryDonut } from '../components/charts/CategoryDonut'
import { AcumuladoChart } from '../components/charts/AcumuladoChart'
import { MesesChart } from '../components/charts/MesesChart'
import { TxItem } from '../components/TxItem'
import { saldoReal, useBancos } from '../lib/banco'
import { currentMonth } from '../lib/dates'

const hora = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

interface Props {
  month: string
  modo: ModoColor
  onMonth: (m: string) => void
  onEdit: (m: Movimiento) => void
  onVerTodos: () => void
  onAdd: () => void
}

export function Resumen({ month, modo, onMonth, onEdit, onVerTodos, onAdd }: Props) {
  const movimientos = useFinanzas((s) => s.movimientos)
  const categorias = useFinanzas((s) => s.categorias)
  const colchon = useFinanzas((s) => s.colchon)
  const cargarDemo = useFinanzas((s) => s.cargarDemo)

  const r = useMemo(() => resumenMes(movimientos, month), [movimientos, month])
  const { conexiones } = useBancos()
  const saldo = saldoReal(conexiones)
  const esMesActual = month === currentMonth()
  const cats = useMemo(() => gastoPorCategoria(movimientos, categorias, month), [movimientos, categorias, month])
  const acumulado = useMemo(() => acumuladoDiario(movimientos, month, today()), [movimientos, month])
  const meses = useMemo(() => ultimosMeses(movimientos, month), [movimientos, month])
  const recientes = useMemo(
    () =>
      movimientos
        .filter((m) => monthOf(m.fecha) === month)
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .slice(0, 6),
    [movimientos, month],
  )

  if (!movimientos.length) {
    return (
      <div className="card welcome">
        <div className="welcome-emoji">💙</div>
        <h2>¡Bienvenido a Bluefin!</h2>
        <p className="muted">
          Apunta tus gastos en segundos y mira de un vistazo a dónde va tu dinero. Empieza añadiendo tu primer
          movimiento o carga unos datos de ejemplo para explorar.
        </p>
        <div className="btn-row center">
          <button className="btn btn-primary" onClick={onAdd}>＋ Añadir mi primer gasto</button>
          <button className="btn" onClick={cargarDemo}>✨ Ver con datos de ejemplo</button>
        </div>
      </div>
    )
  }

  // Solo se avisa si se gasta más de lo que entra; no se habla de ahorro
  const exceso = r.ingresos > 0 && r.balance < 0 ? -r.balance / r.ingresos : null
  // Lo que se puede gastar sin bajar del colchón: saldo real + lo previsto que queda − colchón
  const disponible =
    saldo && colchon !== null && esMesActual ? Math.round((saldo.total + r.previstoIngresos - r.previstoGastos - colchon) * 100) / 100 : null
  const diasQuedan = daysInMonth(month) - Number(today().slice(8)) + 1

  return (
    <>
      <div className="hero card">
        <div>
          {saldo && esMesActual ? (
            <>
              <div className="hero-label">Dinero en tus cuentas</div>
              <div className="hero-value">{money(saldo.total)}</div>
              <div className="hero-sub hero-cuentas">
                {saldo.cuentas.map((c) => `${c.banco} ${money(c.saldo)}`).join(' · ')}
                {saldo.actualizado && ` · actualizado ${hora.format(new Date(saldo.actualizado))}`}
              </div>
              <div className="hero-sub">
                Resultado del mes: <strong>{money(r.balance)}</strong> <span className="hero-nota">(ingresos − gastos hasta hoy)</span>
              </div>
            </>
          ) : (
            <>
              <div className="hero-label">Resultado del mes</div>
              <div className="hero-value">{money(r.balance)}</div>
              <div className="hero-sub hero-nota">Ingresos menos gastos{esMesActual ? ' hasta hoy' : ''}</div>
            </>
          )}
          {exceso !== null && <div className="hero-sub">Has gastado un {pct(exceso)} más de lo que ingresaste</div>}
          {(r.previstoIngresos > 0 || r.previstoGastos > 0) && (
            <div className="hero-sub hero-previsto">
              📅 Previsto hasta fin de mes:
              {r.previstoIngresos > 0 && <> +{money(r.previstoIngresos)}</>}
              {r.previstoGastos > 0 && <> −{money(r.previstoGastos)}</>}
            </div>
          )}
        </div>
        <div className="hero-split">
          <div>
            <span><i className="dot dot-in" />Ingresos</span>
            <strong>{money(r.ingresos)}</strong>
          </div>
          <div>
            <span><i className="dot dot-out" />Gastos</span>
            <strong>{money(r.gastos)}</strong>
          </div>
        </div>
      </div>

      <div className="tiles">
        <div className="card tile">
          <div className="tile-label">🔁 Gastos fijos</div>
          <div className="tile-value">{money(r.fijos)}</div>
          <div className="tile-sub">{r.gastos ? `${pct(r.fijos / r.gastos)} del gasto` : '—'}</div>
        </div>
        <div className="card tile">
          <div className="tile-label">🛒 Gastos variables</div>
          <div className="tile-value">{money(r.variables)}</div>
          <div className="tile-sub">{r.gastos ? `${pct(r.variables / r.gastos)} del gasto` : '—'}</div>
        </div>
        <div className={`card tile tile-budget${disponible !== null && disponible < 0 ? ' tile-alerta' : ''}`}>
          <div className="tile-label">🛟 Disponible para gastar</div>
          {disponible !== null ? (
            <>
              <div className="tile-value">
                {disponible >= 0 ? money(disponible) : `−${money(-disponible)}`}
                {disponible > 0 && diasQuedan > 1 && <span className="tile-of"> · {money(disponible / diasQuedan)}/día</span>}
              </div>
              <div className="tile-sub">
                {disponible >= 0
                  ? `Sin bajar de tu colchón de ${money(colchon!)}`
                  : `⚠️ Estás ${money(-disponible)} por debajo de tu colchón`}
              </div>
              <div className="tile-desglose">
                Saldo {money(saldo!.total)}
                {r.previstoIngresos > 0 && <> + previsto {money(r.previstoIngresos)}</>}
                {r.previstoGastos > 0 && <> − previsto {money(r.previstoGastos)}</>} − colchón {money(colchon!)}
              </div>
            </>
          ) : (
            <>
              <div className="tile-value">—</div>
              <div className="tile-sub">
                {!esMesActual
                  ? 'Solo se calcula para el mes actual'
                  : !saldo
                    ? 'Conecta tu banco para calcularlo'
                    : 'Define tu colchón en Ajustes'}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="card chart-card">
          <h2>¿En qué se va el dinero?</h2>
          <CategoryDonut data={cats} modo={modo} />
        </div>
        <div className="card chart-card">
          <h2>Gasto variable acumulado</h2>
          <AcumuladoChart data={acumulado} modo={modo} />
        </div>
      </div>

      <div className="card chart-card">
        <div className="card-head">
          <h2>Últimos 6 meses</h2>
          <span className="muted small">Toca una barra para ver ese mes</span>
        </div>
        <MesesChart data={meses} mesActivo={month} modo={modo} onSelect={onMonth} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Últimos movimientos</h2>
          <button className="link-btn" onClick={onVerTodos}>Ver todos →</button>
        </div>
        {recientes.length ? (
          <ul className="tx-list">
            {recientes.map((m) => (
              <TxItem key={m.id} mov={m} modo={modo} onClick={onEdit} showDate />
            ))}
          </ul>
        ) : (
          <p className="empty">No hay movimientos este mes.</p>
        )}
      </div>
    </>
  )
}
