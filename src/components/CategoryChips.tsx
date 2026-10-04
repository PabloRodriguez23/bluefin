import type { TipoCategoria } from '../types'
import { useFinanzas } from '../store/useFinanzas'

interface Props {
  tipo: TipoCategoria
  value: string
  onChange: (id: string) => void
}

export function CategoryChips({ tipo, value, onChange }: Props) {
  const categorias = useFinanzas((s) => s.categorias)
  return (
    <div className="chips" role="radiogroup" aria-label="Categoría">
      {categorias
        .filter((c) => c.tipo === tipo)
        .map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={c.id === value}
            className={`chip${c.id === value ? ' on' : ''}`}
            onClick={() => onChange(c.id)}
          >
            <span>{c.emoji}</span>
            {c.nombre}
          </button>
        ))}
    </div>
  )
}
