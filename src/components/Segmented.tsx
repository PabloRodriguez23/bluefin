interface Props<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  full?: boolean
}

export function Segmented<T extends string>({ value, options, onChange, full }: Props<T>) {
  return (
    <div className={`seg${full ? ' seg-full' : ''}`} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
