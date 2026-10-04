import { useMemo, useState, type FormEvent } from 'react'
import type { Clase, Movimiento } from '../types'
import { useFinanzas } from '../store/useFinanzas'
import { toast } from '../store/useToast'
import { amountToInput, parseAmount } from '../lib/format'
import { currentMonth, monthOf, today } from '../lib/dates'
import { OTROS_GASTO, OTROS_INGRESO, REGLA_TRASPASO, TRASPASO } from '../lib/categories'
import { Sheet } from './Sheet'
import { guardarRegla, patronDe } from '../lib/banco'
import { Segmented } from './Segmented'
import { CategoryChips } from './CategoryChips'

interface Props {
  open: boolean
  mov: Movimiento | null
  month: string
  onClose: () => void
  /** Demo: se puede ver el detalle, pero no guardar ni borrar. */
  soloLectura?: boolean
}

export function TxDialog({ open, mov, month, onClose, soloLectura = false }: Props) {
  return (
    <Sheet open={open} title={soloLectura ? 'Detalle del movimiento' : mov ? 'Editar movimiento' : 'Nuevo movimiento'} onClose={onClose}>
      <TxForm mov={mov} month={month} onDone={onClose} soloLectura={soloLectura} />
    </Sheet>
  )
}

const CLASES: { value: Clase; label: string }[] = [
  { value: 'variable', label: '🛒 Variable' },
  { value: 'fijo', label: '🔁 Fijo' },
  { value: 'ingreso', label: '💰 Ingreso' },
  { value: 'traspaso', label: '🔄 Traspaso' },
]

type Sentido = 'entrada' | 'salida'

function TxForm({ mov, month, onDone, soloLectura }: { mov: Movimiento | null; month: string; onDone: () => void; soloLectura: boolean }) {
  const { addMovimiento, updateMovimiento, deleteMovimiento, addFijo } = useFinanzas()
  const movimientos = useFinanzas((s) => s.movimientos)

  const [clase, setClase] = useState<Clase>(mov?.clase ?? 'variable')
  const [importe, setImporte] = useState(mov ? amountToInput(mov.importe) : '')
  const [categoriaId, setCategoriaId] = useState(mov?.categoriaId ?? 'comida')
  const [asunto, setAsunto] = useState(mov?.asunto ?? '')
  const [fecha, setFecha] = useState(mov?.fecha ?? (month === currentMonth() ? today() : `${month}-01`))
  const [repetir, setRepetir] = useState(true)
  const [sentido, setSentido] = useState<Sentido>(mov?.sentido ?? (mov?.clase === 'ingreso' ? 'entrada' : 'salida'))
  const [error, setError] = useState('')

  const tipoCat = clase === 'ingreso' ? 'ingreso' : 'gasto'

  const cambiarClase = (c: Clase) => {
    setClase(c)
    if (c === 'traspaso') return
    if (clase === 'traspaso' && categoriaId === TRASPASO) {
      setCategoriaId(c === 'ingreso' ? 'nomina' : 'comida')
      return
    }
    const nuevoTipo = c === 'ingreso' ? 'ingreso' : 'gasto'
    if (nuevoTipo !== tipoCat) {
      setCategoriaId(nuevoTipo === 'ingreso' ? 'nomina' : 'comida')
      setRepetir(nuevoTipo === 'gasto')
    } else if (c === 'fijo') {
      setRepetir(true)
    }
  }

  // Asuntos usados antes, para autocompletar
  const sugerencias = useMemo(
    () => [...new Set(movimientos.slice(-200).map((m) => m.asunto).filter(Boolean))].reverse().slice(0, 30),
    [movimientos],
  )

  const guardar = (e: FormEvent) => {
    e.preventDefault()
    const n = parseAmount(importe)
    if (!(n > 0)) {
      setError('Escribe un importe válido, por ejemplo 12,50')
      return
    }
    const fallback = tipoCat === 'ingreso' ? OTROS_INGRESO : OTROS_GASTO
    const esTraspaso = clase === 'traspaso'
    const datos = {
      clase,
      importe: n,
      // Un traspaso conserva su categoría si ya la tenía (p. ej. "ahorro")
      categoriaId: esTraspaso ? (mov?.clase === 'traspaso' ? mov.categoriaId : TRASPASO) : categoriaId || fallback,
      asunto: asunto.trim(),
      fecha,
      sentido: esTraspaso ? sentido : undefined,
    }

    if (mov) {
      updateMovimiento({ ...mov, ...datos })
      const delBanco = mov.origen === 'banco' && mov.comercio
      if (delBanco && esTraspaso && mov.clase !== 'traspaso') {
        aprenderTraspaso(mov.comercio!, mov.id)
      } else if (delBanco && !esTraspaso && (datos.categoriaId !== mov.categoriaId || mov.clase === 'traspaso')) {
        aprender(mov.comercio!, datos.categoriaId, mov.id)
      } else {
        toast('Movimiento actualizado')
      }
    } else if ((clase === 'fijo' || clase === 'ingreso') && repetir) {
      const cat = useFinanzas.getState().categorias.find((c) => c.id === datos.categoriaId)
      addFijo({
        tipo: tipoCat,
        nombre: datos.asunto || cat?.nombre || 'Fijo',
        importe: n,
        categoriaId: datos.categoriaId,
        dia: Number(fecha.slice(8)),
        desde: monthOf(fecha),
        activo: true,
      })
      toast('Guardado · se repetirá cada mes 🔁')
    } else {
      addMovimiento(datos)
      toast('Movimiento añadido ✓')
    }
    onDone()
  }

  /** Al corregir la categoría de un movimiento del banco, la app aprende para ese comercio. */
  const aprender = (comercio: string, categoriaId: string, exceptoId: string) => {
    const patron = patronDe(comercio)
    const { movimientos: todos, updateMovimiento: actualizar } = useFinanzas.getState()
    const iguales = todos.filter((m) => m.id !== exceptoId && m.origen === 'banco' && m.comercio && patronDe(m.comercio) === patron)
    for (const m of iguales) {
      // Si eran traspasos, vuelven a ser gasto o ingreso según el sentido del dinero
      const c = m.clase === 'traspaso' ? (m.sentido === 'entrada' ? 'ingreso' : 'variable') : m.clase
      actualizar({ ...m, clase: c, categoriaId, sentido: undefined })
    }
    const cat = useFinanzas.getState().categorias.find((c) => c.id === categoriaId)
    void guardarRegla(comercio, categoriaId).catch(() => {})
    toast(`🧠 Aprendido: los próximos de este comercio irán a ${cat?.emoji ?? ''} ${cat?.nombre ?? ''}${iguales.length ? ` (+${iguales.length} corregidos)` : ''}`)
  }

  /** Marcar un comercio del banco como traspaso: este y los siguientes dejan de contar. */
  const aprenderTraspaso = (comercio: string, exceptoId: string) => {
    const patron = patronDe(comercio)
    const { movimientos: todos, updateMovimiento: actualizar } = useFinanzas.getState()
    const iguales = todos.filter(
      (m) => m.id !== exceptoId && m.origen === 'banco' && m.clase !== 'traspaso' && m.comercio && patronDe(m.comercio) === patron,
    )
    for (const m of iguales) {
      actualizar({ ...m, clase: 'traspaso', categoriaId: TRASPASO, sentido: m.clase === 'ingreso' ? 'entrada' : 'salida' })
    }
    void guardarRegla(comercio, REGLA_TRASPASO).catch(() => {})
    toast(`🔄 Aprendido: «${comercio}» ya no contará como gasto ni ingreso${iguales.length ? ` (+${iguales.length})` : ''}`)
  }

  const eliminar = () => {
    if (!mov || !confirm('¿Eliminar este movimiento?')) return
    deleteMovimiento(mov.id)
    toast('Movimiento eliminado')
    onDone()
  }

  return (
    <form onSubmit={guardar}>
      <fieldset className="campos" disabled={soloLectura}>
      {mov?.origen === 'banco' && (
        <p className="origen-banco">
          🏦 Importado del banco{mov.comercio ? <>: <strong>{mov.comercio}</strong></> : null}
        </p>
      )}
      <Segmented value={clase} options={CLASES} onChange={cambiarClase} full />

      <label className="amount">
        <input
          autoFocus={!mov}
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

      {clase === 'traspaso' ? (
        <div className="field">
          <span>¿El dinero entra o sale de esta cuenta?</span>
          <Segmented<Sentido>
            value={sentido}
            onChange={setSentido}
            full
            options={[
              { value: 'salida', label: '↗ Sale' },
              { value: 'entrada', label: '↘ Entra' },
            ]}
          />
          <p className="muted small">Paso de dinero entre tus cuentas o a tu ahorro: no cuenta como gasto ni como ingreso.</p>
        </div>
      ) : (
        <div className="field">
          <span>Categoría</span>
          <CategoryChips tipo={tipoCat} value={categoriaId} onChange={setCategoriaId} />
        </div>
      )}

      <label className="field">
        <span>
          Asunto <em className="muted">(para qué fue)</em>
        </span>
        <input
          type="text"
          maxLength={80}
          placeholder="Ej. Cena con amigos, regalo de cumpleaños…"
          list="asuntos"
          value={asunto}
          onChange={(e) => setAsunto(e.target.value)}
        />
        <datalist id="asuntos">
          {sugerencias.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>

      <div className="row-2">
        <label className="field">
          <span>Fecha</span>
          <input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        {!mov && (clase === 'fijo' || clase === 'ingreso') && (
          <label className="field check">
            <input type="checkbox" checked={repetir} onChange={(e) => setRepetir(e.target.checked)} />
            <span>Repetir cada mes</span>
          </label>
        )}
      </div>

      </fieldset>

      {soloLectura ? (
        <p className="solo-lectura">Demo de solo lectura: no se pueden guardar cambios.</p>
      ) : (
        <div className="sheet-actions">
          {mov && (
            <button type="button" className="btn btn-danger" onClick={eliminar}>
              Eliminar
            </button>
          )}
          <button type="submit" className="btn btn-primary btn-big">
            Guardar
          </button>
        </div>
      )}
    </form>
  )
}
