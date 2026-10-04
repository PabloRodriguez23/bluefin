import { useState, type FormEvent } from 'react'
import type { Fijo, TipoCategoria } from '../types'
import { useFinanzas } from '../store/useFinanzas'
import { toast } from '../store/useToast'
import { amountToInput, parseAmount } from '../lib/format'
import { currentMonth } from '../lib/dates'
import { Sheet } from './Sheet'
import { Segmented } from './Segmented'
import { CategoryChips } from './CategoryChips'

interface Props {
  open: boolean
  fijo: Fijo | null
  onClose: () => void
}

export function FijoDialog({ open, fijo, onClose }: Props) {
  return (
    <Sheet open={open} title={fijo ? 'Editar fijo' : 'Nuevo fijo'} onClose={onClose}>
      <FijoForm fijo={fijo} onDone={onClose} />
    </Sheet>
  )
}

function FijoForm({ fijo, onDone }: { fijo: Fijo | null; onDone: () => void }) {
  const { addFijo, updateFijo, deleteFijo } = useFinanzas()
  const [tipo, setTipo] = useState<TipoCategoria>(fijo?.tipo ?? 'gasto')
  const [importe, setImporte] = useState(fijo ? amountToInput(fijo.importe) : '')
  const [nombre, setNombre] = useState(fijo?.nombre ?? '')
  const [categoriaId, setCategoriaId] = useState(fijo?.categoriaId ?? 'vivienda')
  const [dia, setDia] = useState(fijo?.dia ?? 1)
  const [desde, setDesde] = useState(fijo?.desde ?? currentMonth())
  const [activo, setActivo] = useState(fijo?.activo ?? true)
  const [error, setError] = useState('')

  const cambiarTipo = (t: TipoCategoria) => {
    setTipo(t)
    setCategoriaId(t === 'ingreso' ? 'nomina' : 'vivienda')
  }

  const guardar = (e: FormEvent) => {
    e.preventDefault()
    const n = parseAmount(importe)
    if (!(n > 0)) return setError('Escribe un importe válido, por ejemplo 650')
    const datos = { tipo, importe: n, nombre: nombre.trim(), categoriaId, dia: Math.min(Math.max(dia, 1), 31), desde, activo }
    if (fijo) {
      updateFijo({ ...fijo, ...datos })
      toast('Fijo actualizado (los meses pasados no cambian)')
    } else {
      addFijo(datos)
      toast('Fijo creado 🔁')
    }
    onDone()
  }

  const eliminar = () => {
    if (!fijo || !confirm(`¿Eliminar "${fijo.nombre}"? Los movimientos ya registrados se conservan.`)) return
    deleteFijo(fijo.id)
    toast('Fijo eliminado')
    onDone()
  }

  return (
    <form onSubmit={guardar}>
      <Segmented
        value={tipo}
        onChange={cambiarTipo}
        full
        options={[
          { value: 'gasto', label: '🔁 Gasto fijo' },
          { value: 'ingreso', label: '💰 Ingreso fijo' },
        ]}
      />
      <label className="amount">
        <input
          autoFocus={!fijo}
          inputMode="decimal"
          placeholder="0,00"
          autoComplete="off"
          aria-label="Importe"
          value={importe}
          onChange={(e) => {
            setImporte(e.target.value)
            setError('')
          }}
        />
        <span>€</span>
      </label>
      {error && <p className="form-error">{error}</p>}

      <label className="field">
        <span>Nombre / asunto</span>
        <input
          type="text"
          required
          maxLength={60}
          placeholder="Ej. Alquiler, Netflix, Nómina…"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </label>
      <div className="field">
        <span>Categoría</span>
        <CategoryChips tipo={tipo} value={categoriaId} onChange={setCategoriaId} />
      </div>
      <div className="row-2">
        <label className="field">
          <span>Día del mes</span>
          <input type="number" min={1} max={31} required value={dia} onChange={(e) => setDia(Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Desde</span>
          <input type="month" required value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
      </div>
      <label className="field check">
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
        <span>Activo (se añade solo cada mes)</span>
      </label>

      <div className="sheet-actions">
        {fijo && (
          <button type="button" className="btn btn-danger" onClick={eliminar}>
            Eliminar
          </button>
        )}
        <button type="submit" className="btn btn-primary btn-big">
          Guardar
        </button>
      </div>
    </form>
  )
}
