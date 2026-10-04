import type { ReactNode } from 'react'

export interface TooltipRow {
  color: string
  label: string
  value: string
  dashed?: boolean
}

export function ChartTooltip({ title, rows, footer }: { title: ReactNode; rows: TooltipRow[]; footer?: ReactNode }) {
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="chart-tip-row">
          <i style={{ background: r.dashed ? 'transparent' : r.color, borderColor: r.color }} className={r.dashed ? 'dashed' : ''} />
          <span>{r.label}</span>
          <strong>{r.value}</strong>
        </div>
      ))}
      {footer && <div className="chart-tip-foot">{footer}</div>}
    </div>
  )
}
