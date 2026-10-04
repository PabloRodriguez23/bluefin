import type { Tema } from '../types'
import { useFinanzas } from '../store/useFinanzas'
import { useDemo } from '../store/useDemo'
import { slotColor, type ModoColor } from '../lib/palette'
import { money } from '../lib/format'
import { Segmented } from '../components/Segmented'

/** Ajustes de la demo: se puede cambiar el tema, el resto solo se muestra. */
export function AjustesDemo({ modo }: { modo: ModoColor }) {
  const tema = useFinanzas((s) => s.tema)
  const setTema = useFinanzas((s) => s.setTema)
  const categorias = useFinanzas((s) => s.categorias)
  const colchon = useFinanzas((s) => s.colchon)
  const salir = useDemo((s) => s.salir)

  return (
    <>
      <div className="card">
        <h2>Modo demo</h2>
        <p className="muted small">
          Estás viendo Bluefin con datos ficticios. En la versión real, cada persona entra con su cuenta, sus datos se
          sincronizan entre dispositivos y los movimientos del banco se importan y se categorizan solos.
        </p>
        <div className="btn-row">
          <button className="btn" onClick={salir}>Salir de la demo</button>
        </div>
      </div>

      <div className="card">
        <h2>🏦 Banco conectado</h2>
        <p className="muted small">
          En la demo, un banco ficticio. En la versión real se conecta por Open Banking (PSD2) con acceso de solo lectura.
        </p>
      </div>

      <div className="card">
        <h2>🛟 Colchón</h2>
        <p className="muted small">
          Dinero mínimo que se quiere mantener en la cuenta: {colchon !== null ? <strong>{money(colchon)}</strong> : 'sin definir'}. El
          resumen calcula cuánto se puede gastar sin bajar de esa cifra.
        </p>
      </div>

      <div className="card">
        <h2>🎨 Apariencia</h2>
        <Segmented<Tema>
          value={tema}
          onChange={setTema}
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
          {categorias
            .filter((c) => c.tipo === 'gasto')
            .map((c) => (
              <li key={c.id} className="chip-fijo">
                <i className="sw" style={{ background: slotColor(c.slot, modo) }} />
                {c.emoji} {c.nombre}
              </li>
            ))}
        </ul>
      </div>
    </>
  )
}
