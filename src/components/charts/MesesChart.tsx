import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { money, moneyRound } from '../../lib/format'
import { monthLabel } from '../../lib/dates'
import { CHROME, SERIES, type ModoColor } from '../../lib/palette'
import { ChartTooltip } from './ChartTooltip'
import type { ResumenMes } from '../../lib/stats'

type Fila = ResumenMes & { mes: string; label: string }

interface Props {
  data: Fila[]
  mesActivo: string
  modo: ModoColor
  onSelect: (mes: string) => void
}

export function MesesChart({ data, mesActivo, modo, onSelect }: Props) {
  const c = CHROME[modo]
  const s = SERIES[modo]

  return (
    <>
      <div className="mini-legend">
        <span><i className="sw" style={{ background: s.ingresos }} />Ingresos</span>
        <span><i className="sw" style={{ background: s.fijos }} />Gastos fijos</span>
        <span><i className="sw" style={{ background: s.variables }} />Gastos variables</span>
      </div>
      <div className="chart-box tall">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
            barGap={4}
            barCategoryGap="28%"
            onClick={(e) => {
              const i = Number(e?.activeTooltipIndex)
              if (!Number.isNaN(i) && data[i]) onSelect(data[i].mes)
            }}
            style={{ cursor: 'pointer' }}
          >
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: c.grid }}
              tick={({ x, y, payload, index }) => (
                <text
                  x={x}
                  y={Number(y) + 12}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={data[index]?.mes === mesActivo ? 700 : 400}
                  fill={data[index]?.mes === mesActivo ? c.text : c.axis}
                  style={{ textTransform: 'capitalize' }}
                >
                  {payload.value}
                </text>
              )}
            />
            <YAxis tick={{ fill: c.axis, fontSize: 12 }} tickLine={false} axisLine={false} width={58} tickFormatter={(v: number) => moneyRound(v)} />
            <Tooltip
              cursor={{ fill: c.grid, opacity: 0.6 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as Fila
                return (
                  <ChartTooltip
                    title={monthLabel(d.mes)}
                    rows={[
                      { color: s.ingresos, label: 'Ingresos', value: money(d.ingresos) },
                      { color: s.fijos, label: 'Gastos fijos', value: money(d.fijos) },
                      { color: s.variables, label: 'Gastos variables', value: money(d.variables) },
                    ]}
                    footer={
                      <>
                        Balance: <strong className={d.balance >= 0 ? 'pos' : 'neg'}>{money(d.balance)}</strong>
                      </>
                    }
                  />
                )
              }}
            />
            <Bar dataKey="ingresos" fill={s.ingresos} radius={[4, 4, 0, 0]} maxBarSize={34} />
            <Bar dataKey="fijos" stackId="g" fill={s.fijos} stroke={c.surface} strokeWidth={1} maxBarSize={34} />
            <Bar dataKey="variables" stackId="g" fill={s.variables} stroke={c.surface} strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={34} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
