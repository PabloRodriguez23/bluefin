import { useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { PorCategoria } from '../../lib/stats'
import { money, moneyRound, pct } from '../../lib/format'
import { CHROME, slotColor, type ModoColor } from '../../lib/palette'
import { ChartTooltip } from './ChartTooltip'

interface Props {
  data: PorCategoria[]
  modo: ModoColor
}

export function CategoryDonut({ data, modo }: Props) {
  const [activo, setActivo] = useState<string | null>(null)
  const total = data.reduce((a, d) => a + d.total, 0)

  if (!data.length) return <p className="empty">Aún no hay gastos este mes.</p>

  return (
    <div className="donut-wrap">
      <div className="donut-box">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="nombre"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={data.length > 1 ? 1.5 : 0}
              cornerRadius={4}
              stroke={CHROME[modo].surface}
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive
              onMouseEnter={(d) => setActivo((d as unknown as PorCategoria).id)}
              onMouseLeave={() => setActivo(null)}
            >
              {data.map((d) => (
                <Cell
                  key={d.id}
                  fill={slotColor(d.slot, modo)}
                  opacity={activo && activo !== d.id ? 0.35 : 1}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as PorCategoria
                return (
                  <ChartTooltip
                    title={`${d.emoji} ${d.nombre}`}
                    rows={[{ color: slotColor(d.slot, modo), label: pct(d.total / total), value: money(d.total) }]}
                  />
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <span>Total</span>
          <strong>{moneyRound(total)}</strong>
        </div>
      </div>

      <ul className="legend">
        {data.map((d) => (
          <li
            key={d.id}
            className={activo && activo !== d.id ? 'dim' : ''}
            onMouseEnter={() => setActivo(d.id)}
            onMouseLeave={() => setActivo(null)}
          >
            <i className="sw" style={{ background: slotColor(d.slot, modo) }} />
            <span className="name">
              {d.emoji} {d.nombre}
            </span>
            <span className="val">{money(d.total)}</span>
            <span className="pct">{pct(d.total / total)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
