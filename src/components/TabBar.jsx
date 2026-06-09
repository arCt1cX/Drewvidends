import Icon from './Icon.jsx'

const TABS = [
  { id: 'list', label: 'Lista', icon: 'list' },
  { id: 'watch', label: 'Watchlist', icon: 'star' },
  { id: 'compare', label: 'Confronto', icon: 'compare' },
  { id: 'calendar', label: 'Calendario', icon: 'calendar' }
]

export default function TabBar({ tab, setTab }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-line tabbar-safe">
      <div className="max-w-screen-sm mx-auto grid grid-cols-4">
        {TABS.map((t) => {
          const active = tab === t.id
          const name = active && t.icon === 'star' ? 'starFill' : t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors ${
                active ? 'text-accent font-bold' : 'text-muted font-medium'
              }`}
            >
              <Icon name={name} size={22} strokeWidth={1.7} />
              {t.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
