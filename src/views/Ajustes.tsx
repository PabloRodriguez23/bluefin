import { useState, type ChangeEvent, type FormEvent } from 'react'
import type { Tema } from '../types'
import { useFinanzas } from '../store/useFinanzas'
import { toast } from '../store/useToast'
import { exportarCSV, exportarJSON, leerJSON } from '../lib/export'
import { parseAmount } from '../lib/format'
import { PROTEGIDAS } from '../lib/categories'
import { slotColor, type ModoColor } from '../lib/palette'
import { Segmented } from '../components/Segmented'
import { cerrarSesion } from '../lib/sync'
import { Bancos } from '../components/Bancos'

export function Ajustes({ modo, email }: { modo: ModoColor; email?: string }) {
  const s = useFinanzas()
  const [presu, setPresu] = useState(s.presupuesto ? String(s.presupuesto) : '')
  const [emoji, setEmoji] = useState('')
  const [nombre, setNombre] = useState('')

  const guardarPresu = () => {
    const n = parseAmount(presu)
    s.setPresupuesto(n > 0 ? n : null)
    toast(n > 0 ? 'Presupuesto guardado' : 'Presupuesto quitado')
  }

  const nuevaCat = (e: FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) return
    s.addCategoria(nombre.trim(), emoji.trim())
    setNombre('')
    setEmoji('')
    toast('Categoría añadida')
  }

  const importar = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const datos = await leerJSON(file)
      if (!confirm('Esto reemplazará los datos actuales por los de la copia. ¿Continuar?')) return
      s.importar(datos)
      toast('Copia importada ✓')
    } catch {
      toast('❌ No se pudo leer el archivo')
    }
  }

  const datos = { movimientos: s.movimientos, fijos: s.fijos, categorias: s.categorias, presupuesto: s.presupuesto }

  return (
    <>
      <div className="card">
        <h2>👤 Cuenta</h2>
        {email ? (
          <div className="cuenta">
            <div>
              <strong>{email}</strong>
              <p className="muted small">Tus datos se sincronizan en todos los dispositivos donde entres con esta cuenta.</p>
            </div>
            <button
              className="btn"
              onClick={() => confirm('¿Cerrar sesión en este dispositivo? Tus datos seguirán en la nube.') && void cerrarSesion()}
            >
              Cerrar sesión
            </button>
          </div>
        ) : (
          <p className="muted small">
            Modo local: los datos solo se guardan en este navegador. Configura Supabase (ver README) para sincronizarlos entre dispositivos.
          </p>
        )}
      </div>

      {email && <Bancos />}

      <div className="card">
        <h2>🎯 Presupuesto mensual</h2>
        <p className="muted small">Límite para tus gastos variables. Te avisaremos en el resumen cuando te acerques.</p>
        <div className="inline-form">
          <input
            type="text"
            inputMode="decimal"
            placeholder="Ej. 400"
            value={presu}
            onChange={(e) => setPresu(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && guardarPresu()}
            aria-label="Presupuesto en euros"
          />
          <button className="btn btn-primary" onClick={guardarPresu}>Guardar</button>
        </div>
      </div>

      <div className="card">
        <h2>🎨 Apariencia</h2>
        <Segmented<Tema>
          value={s.tema}
          onChange={s.setTema}
          options={[
            { value: 'auto', label: 'Automático' },
            { value: 'light', label: '☀️ Claro' },
            { value: 'dark', label: '🌙 Oscuro' },
          ]}
        />
      </div>

      <div className="card">
        <h2>🏷️ Categorías de gasto</h2>
        <ul className="chips-list">
          {s.categorias
            .filter((c) => c.tipo === 'gasto')
            .map((c) => (
              <li key={c.id}>
                <i className="sw" style={{ background: slotColor(c.slot, modo) }} />
                {c.emoji} {c.nombre}
                {!PROTEGIDAS.has(c.id) && (
                  <button
                    aria-label={`Eliminar ${c.nombre}`}
                    onClick={() => confirm(`¿Eliminar "${c.nombre}"? Sus gastos pasarán a "Otros".`) && s.deleteCategoria(c.id)}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
        </ul>
        <form className="inline-form" onSubmit={nuevaCat}>
          <input className="emoji-input" maxLength={4} placeholder="🙂" value={emoji} onChange={(e) => setEmoji(e.target.value)} aria-label="Emoji" />
          <input maxLength={20} placeholder="Nueva categoría" value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre" />
          <button className="btn btn-primary" type="submit">Añadir</button>
        </form>
      </div>

      <div className="card">
        <h2>💾 Copia de seguridad</h2>
        <p className="muted small">
          Descarga una copia de tus datos cuando quieras, o ábrelos en Excel.
        </p>
        <div className="btn-row">
          <button className="btn" onClick={() => exportarJSON(datos)}>⬇️ Exportar copia</button>
          <button className="btn" onClick={() => exportarCSV(s.movimientos, s.categorias)}>📄 Exportar a Excel (CSV)</button>
          <label className="btn">
            ⬆️ Importar copia
            <input type="file" accept="application/json,.json" hidden onChange={importar} />
          </label>
        </div>
        <div className="btn-row">
          <button
            className="btn btn-ghost"
            onClick={() => (!s.movimientos.length || confirm('Se reemplazarán tus datos por datos de ejemplo. ¿Seguro?')) && s.cargarDemo()}
          >
            ✨ Cargar datos de ejemplo
          </button>
          <button
            className="btn btn-danger"
            onClick={() => confirm('¿Borrar TODOS los datos? No se puede deshacer.') && (s.borrarTodo(), toast('Datos borrados'))}
          >
            🗑️ Borrar todo
          </button>
        </div>
      </div>
    </>
  )
}
