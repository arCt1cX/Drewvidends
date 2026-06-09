import Icon from './Icon.jsx'

const ICON = { buy: 'target', info: 'clock', warn: 'alert' }
const STYLE = {
  buy: 'bg-accent-dim text-accent',
  info: 'bg-surface2 text-muted',
  warn: 'bg-surface2 text-danger'
}

export default function SignalBadges({ signals, compact = false }) {
  if (!signals || !signals.length) return null
  const list = compact ? signals.slice(0, 2) : signals
  return (
    <div className="flex flex-col gap-1.5">
      {list.map((s, i) => (
        <div key={i} className={`flex items-start gap-2 text-xs rounded-xl px-2.5 py-2 ${STYLE[s.level]}`}>
          <Icon name={ICON[s.level]} size={14} className="mt-0.5 shrink-0" />
          <span className="leading-snug">{s.text}</span>
        </div>
      ))}
    </div>
  )
}
