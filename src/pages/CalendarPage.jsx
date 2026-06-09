import { useMemo, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { fmtPct, fmtDate, fmtDays, daysUntil } from '../lib/format.js'
import Icon from '../components/Icon.jsx'

export default function CalendarPage({ onOpen }) {
  const { rows, isWatched, divProgress } = useStore()
  const [onlyWatch, setOnlyWatch] = useState(false)

  const groups = useMemo(() => {
    const items = rows
      .map((r) => {
        const ex = r.summary?.exDate ?? r.exDate ?? null
        return ex ? { ...r, ex, days: daysUntil(ex) } : null
      })
      .filter((r) => r && r.days >= 0 && r.days <= 200) // solo da oggi in poi, ~6 mesi
      .filter((r) => (onlyWatch ? isWatched(r.symbol) : true))
      .sort((a, b) => a.days - b.days)

    const map = new Map()
    for (const r of items) {
      const d = new Date(r.ex * 1000)
      const key = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    }
    return [...map.entries()]
  }, [rows, onlyWatch, isWatched])

  return (
    <div className="px-4">
      <header className="pt-3 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Calendario stacchi</h1>
          <p className="text-[11px] text-muted">Prossime ex-date (compra prima per il dividendo).</p>
        </div>
        <button
          onClick={() => setOnlyWatch((v) => !v)}
          className={`flex items-center gap-1.5 text-xs font-semibold rounded-xl px-3 py-1.5 border ${
            onlyWatch ? 'bg-accent-dim text-accent border-transparent' : 'bg-surface text-muted border-line'
          }`}
        >
          <Icon name={onlyWatch ? 'starFill' : 'star'} size={14} /> Watchlist
        </button>
      </header>

      {groups.length === 0 ? (
        <p className="text-sm text-muted pt-6 text-center">
          {divProgress < 1
            ? `Carico le ex-date… ${Math.round(divProgress * 100)}%`
            : 'Nessuna ex-date imminente trovata.'}
        </p>
      ) : (
        <div className="space-y-4 pb-safe">
          {groups.map(([month, items]) => (
            <div key={month}>
              <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5 capitalize">
                {month}
              </div>
              <div className="grid gap-2">
                {items.map((r) => {
                  const yieldDec = r.summary?.yield ?? r.yield ?? null
                  return (
                    <div
                      key={r.symbol}
                      onClick={() => onOpen(r.symbol)}
                      className="bg-surface rounded-xl border border-line p-3 flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm font-semibold truncate">
                          {isWatched(r.symbol) && <Icon name="starFill" size={13} className="text-accent shrink-0" />}
                          <span className="truncate">{r.name}</span>
                        </div>
                        <div className="text-[11px] text-muted">ex {fmtDate(r.ex)} · {fmtDays(r.days)}</div>
                      </div>
                      <div className="text-accent font-bold text-sm shrink-0 ml-2">
                        {fmtPct(yieldDec, 1)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
