import { useMemo, useState } from 'react'
import type { Clase, Movimiento } from '../types'
import { useFinanzas } from '../store/useFinanzas'
import { dayLabel, monthOf } from '../lib/dates'
import { money } from '../lib/format'
import { signo } from '../lib/stats'
import type { ModoColor } from '../lib/palette'
import { Segmented } from '../components/Segmented'
import { TxItem } from '../components/TxItem'

type Filtro = 'todos' | Clase

interface Props {
  month: string
  modo: ModoColor
  onEdit: (m: Movimiento) => void
}

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function Movimientos({ month, modo, onEdit }: Props) {
  const movimientos = useFinanzas((s) => s.movimientos)
  const categorias = useFinanzas((s) => s.categorias)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [q, setQ] = useState('')

  const lista = useMemo(() => {
    const term = normalizar(q.trim())
    return movimientos
      .filter((m) => monthOf(m.fecha) === month)
      .filter((m) => filtro === 'todos' || m.clase === filtro)
      .filter((m) => {
        if (!term) return true
        const cat = categorias.find((c) => c.id === m.categoriaId)?.nombre ?? ''
        return normalizar(`${m.asunto} ${cat}`).includes(term)
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [movimientos, categorias, month, filtro, q])

  const porDia = useMemo(() => {
    const grupos = new Map<string, Movimiento[]>()
    for (const m of lista) grupos.set(m.fecha, [...(grupos.get(m.fecha) ?? []), m])
    return [...grupos]
  }, [lista])

  const neto = lista.reduce((a, m) => a + signo(m) * m.importe, 0)

  return (
    <>
      <div className="card filters">
        <input type="search" placeholder="🔍 Buscar por asunto o categoría…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Segmented<Filtro>
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'fijo', label: 'Fijos' },
            { value: 'variable', label: 'Variables' },
            { value: 'ingreso', label: 'Ingresos' },
            { value: 'traspaso', label: 'Traspasos' },
          ]}
        />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{lista.length} movimientos</h2>
          <span className={`net ${neto >= 0 ? 'pos' : 'neg'}`}>{money(neto)}</span>
        </div>
        {porDia.length ? (
          porDia.map(([fecha, movs]) => (
            <div key={fecha}>
              <div className="day-head">
                <span>{dayLabel(fecha)}</span>
                <span>{money(movs.reduce((a, m) => a + signo(m) * m.importe, 0))}</span>
              </div>
              <ul className="tx-list">
                {movs.map((m) => (
                  <TxItem key={m.id} mov={m} modo={modo} onClick={onEdit} />
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="empty">{q || filtro !== 'todos' ? 'Nada coincide con el filtro.' : 'No hay movimientos este mes.'}</p>
        )}
      </div>
    </>
  )
}
