import type { Fijo } from '../types'
import { useFinanzas } from '../store/useFinanzas'
import { money } from '../lib/format'
import { monthLabel } from '../lib/dates'
import { slotColor, type ModoColor } from '../lib/palette'

interface Props {
  modo: ModoColor
  onEdit: (f: Fijo | null) => void
}

export function Fijos({ modo, onEdit }: Props) {
  const fijos = useFinanzas((s) => s.fijos)
  const categorias = useFinanzas((s) => s.categorias)

  const activos = fijos.filter((f) => f.activo)
  const gastos = activos.filter((f) => f.tipo === 'gasto').reduce((a, f) => a + f.importe, 0)
  const ingresos = activos.filter((f) => f.tipo === 'ingreso').reduce((a, f) => a + f.importe, 0)
  const orden = [...fijos].sort((a, b) => Number(b.activo) - Number(a.activo) || a.tipo.localeCompare(b.tipo) || a.dia - b.dia)

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Gastos e ingresos fijos</h2>
          <p className="muted small">Se apuntan solos cada mes: alquiler, luz, gimnasio, nómina…</p>
        </div>
        <button className="btn btn-primary" onClick={() => onEdit(null)}>＋ Nuevo fijo</button>
      </div>

      <div className="fijos-total">
        <div>Gastos fijos al mes<strong>{money(gastos)}</strong></div>
        <div>Ingresos fijos al mes<strong>{money(ingresos)}</strong></div>
        <div>Te quedan para el resto<strong className={ingresos - gastos >= 0 ? 'pos' : 'neg'}>{money(ingresos - gastos)}</strong></div>
      </div>

      {orden.length ? (
        <ul className="tx-list">
          {orden.map((f) => {
            const cat = categorias.find((c) => c.id === f.categoriaId)
            const color = cat?.tipo === 'gasto' ? slotColor(cat.slot, modo) : 'transparent'
            return (
              <li key={f.id} className={f.activo ? '' : 'inactive'}>
                <button type="button" className="tx" onClick={() => onEdit(f)}>
                  <span className="tx-ico" style={{ ['--c' as string]: color }}>{cat?.emoji ?? '📦'}</span>
                  <span className="tx-main">
                    <span className="tx-title">{f.nombre}</span>
                    <span className="tx-meta">
                      <span className={`badge ${f.activo ? '' : 'off'}`}>{f.activo ? `Día ${f.dia}` : 'Pausado'}</span>
                      {cat?.nombre} · desde {monthLabel(f.desde)}
                    </span>
                  </span>
                  <span className={`tx-amt${f.tipo === 'ingreso' ? ' in' : ''}`}>
                    {f.tipo === 'ingreso' ? '+' : '−'}
                    {money(f.importe)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="empty">Todavía no tienes fijos. Añade tu alquiler, suscripciones o nómina y se apuntarán solos cada mes.</p>
      )}
    </div>
  )
}
