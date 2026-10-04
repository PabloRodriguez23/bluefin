import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { money, moneyRound } from '../../lib/format'
import { CHROME, SERIES, type ModoColor } from '../../lib/palette'
import { ChartTooltip } from './ChartTooltip'

interface Punto {
  dia: number
  actual: number | null
  anterior: number | null
}

interface Props {
  data: Punto[]
  modo: ModoColor
}

export function AcumuladoChart({ data, modo }: Props) {
  const c = CHROME[modo]
  const s = SERIES[modo]
  const azul = modo === 'light' ? '#2a78d6' : '#3987e5'

  return (
    <>
      <div className="mini-legend">
        <span><i className="sw" style={{ background: azul }} />Este mes</span>
        <span><i className="sw sw-dashed" style={{ borderColor: s.previo }} />Mes anterior</span>
      </div>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={azul} stopOpacity={0.35} />
                <stop offset="100%" stopColor={azul} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis dataKey="dia" tick={{ fill: c.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: c.grid }} interval={4} />
            <YAxis
              tick={{ fill: c.axis, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={58}
              tickFormatter={(v: number) => moneyRound(v)}
            />
            <Tooltip
              cursor={{ stroke: c.axis, strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as Punto
                const rows = []
                if (p.actual !== null) rows.push({ color: azul, label: 'Este mes', value: money(p.actual) })
                if (p.anterior !== null) rows.push({ color: s.previo, label: 'Mes anterior', value: money(p.anterior), dashed: true })
                return (
                  <ChartTooltip
                    title={`Día ${p.dia}`}
                    rows={rows}
                  />
                )
              }}
            />
            <Line type="monotone" dataKey="anterior" stroke={s.previo} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={false} />
            <Area
              type="monotone"
              dataKey="actual"
              stroke={azul}
              strokeWidth={2.5}
              fill="url(#gradActual)"
              dot={false}
              activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }}
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
