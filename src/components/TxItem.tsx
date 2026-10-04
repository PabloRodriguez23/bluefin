import type { Movimiento } from '../types'
import { useCategoria } from '../store/useFinanzas'
import { money } from '../lib/format'
import { slotColor, type ModoColor } from '../lib/palette'

import { AHORRO } from '../lib/categories'
import { today } from '../lib/dates'

const ETIQUETA = { fijo: 'Fijo', variable: 'Variable', ingreso: 'Ingreso', traspaso: 'Traspaso' } as const

interface Props {
  mov: Movimiento
  modo: ModoColor
  onClick: (m: Movimiento) => void
  showDate?: boolean
}

export function TxItem({ mov, modo, onClick, showDate }: Props) {
  const cat = useCategoria(mov.categoriaId)
  const esTraspaso = mov.clase === 'traspaso'
  const esIngreso = mov.clase === 'ingreso'
  const entra = esIngreso || (esTraspaso && mov.sentido === 'entrada')
  const emoji = esTraspaso ? (mov.categoriaId === AHORRO ? '🐷' : '🔄') : (cat?.emoji ?? '📦')
  const nombreCat = esTraspaso ? (mov.categoriaId === AHORRO ? 'Ahorro' : 'Entre mis cuentas') : cat?.nombre
  const color = cat?.tipo === 'gasto' ? slotColor(cat.slot, modo) : 'transparent'

  return (
    <li>
      <button type="button" className="tx" onClick={() => onClick(mov)}>
        <span className="tx-ico" style={{ ['--c' as string]: color }}>
          {emoji}
        </span>
        <span className="tx-main">
          <span className="tx-title">{mov.asunto || nombreCat || 'Sin asunto'}</span>
          <span className="tx-meta">
            <span className={`badge badge-${mov.clase}`}>{ETIQUETA[mov.clase]}</span>
            {nombreCat}
            {mov.fijoId && <span title="Generado automáticamente">· 🔁</span>}
            {mov.origen === 'banco' && <span title={mov.comercio ? `Del banco: ${mov.comercio}` : 'Importado del banco'}>· 🏦</span>}
            {mov.fecha > today() && <span className="badge badge-previsto" title="Aún no ha ocurrido: no cuenta en los totales">Previsto</span>}
            {showDate && <span>· {mov.fecha.slice(8)}/{mov.fecha.slice(5, 7)}</span>}
          </span>
        </span>
        <span className={`tx-amt${esTraspaso ? ' neutral' : esIngreso ? ' in' : ''}`} title={esTraspaso ? 'No cuenta como gasto ni ingreso' : undefined}>
          {entra ? '+' : '−'}
          {money(mov.importe)}
        </span>
      </button>
    </li>
  )
}
