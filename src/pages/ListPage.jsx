import { useMemo, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { belowAvg, daysUntil } from '../lib/format.js'
import { computeSignals } from '../lib/signals.js'
import FilterBar from '../components/FilterBar.jsx'
import StockCard from '../components/StockCard.jsx'
import Spinner from '../components/Spinner.jsx'
import Icon from '../components/Icon.jsx'

const POPULAR_MIN = 1e9 // capitalizzazione minima per "Popolari" (1 miliardo €): esclude micro-cap sconosciute

export default function ListPage({ onOpen }) {
  const { rows, loading, error, refresh, divProgress } = useStore()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('yield')
  const [onlyBelow, setOnlyBelow] = useState(false)
  const [onlyPopular, setOnlyPopular] = useState(false)
  const [minYield, setMinYield] = useState(0)

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    let list = rows.filter((r) => {
      if (term && !(`${r.name} ${r.symbol}`.toLowerCase().includes(term))) return false
      const yieldDec = r.summary?.yield ?? r.yield ?? null
      if (minYield && (yieldDec == null || yieldDec * 100 < minYield)) return false
      if (onlyPopular && !(r.marketCap >= POPULAR_MIN)) return false // solo titoli noti (cap ≥ 1 mld)
      if (onlyBelow) {
        const g = belowAvg(r.price, r.ma200)
        if (g == null || g >= 0) return false
      }
      return true
    })
    list = list.slice().sort((a, b) => cmp(a, b, sort))
    return list
  }, [rows, q, sort, onlyBelow, onlyPopular, minYield])

  const occasioni = useMemo(
    () => rows.filter((r) => !r.missing && computeSignals(r).some((s) => s.level === 'buy')).length,
    [rows]
  )

  return (
    <div className="px-4">
      <header className="pt-3 pb-1 flex items-center justify-between">
        <div className="whitespace-nowrap">
          <h1 className="text-xl font-extrabold tracking-tight">
            Drewvidend<span className="text-accent"> %</span>
          </h1>
          <div className="text-xs font-semibold text-muted mt-0.5">
            {rows.length} titoli · <span className="text-accent">{occasioni} occasioni oggi</span>
          </div>
        </div>
        <button
          onClick={refresh}
          className="w-[38px] h-[38px] rounded-xl border border-line text-muted flex items-center justify-center"
          aria-label="aggiorna"
        >
          <Icon name="refresh" size={18} />
        </button>
      </header>

      <FilterBar
        q={q}
        setQ={setQ}
        sort={sort}
        setSort={setSort}
        onlyBelow={onlyBelow}
        setOnlyBelow={setOnlyBelow}
        onlyPopular={onlyPopular}
        setOnlyPopular={setOnlyPopular}
        minYield={minYield}
        setMinYield={setMinYield}
      />

      {error && (
        <div className="text-danger text-sm bg-danger/10 border border-danger/30 rounded-xl p-3 my-2">
          Errore: {error}
        </div>
      )}

      {loading && !Object.keys(rows).length ? (
        <Spinner label="Carico i titoli…" />
      ) : (
        <>
          <div className="text-[11px] text-muted py-1 flex items-center justify-between">
            <span>{filtered.length} titoli</span>
            {divProgress < 1 && <span>carico ex-date… {Math.round(divProgress * 100)}%</span>}
          </div>
          <div className="grid grid-cols-1 gap-2.5 pb-safe">
            {filtered.map((r) => (
              <StockCard key={r.symbol} row={r} onOpen={onOpen} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function val(r) {
  return {
    yieldDec: r.summary?.yield ?? r.yield ?? null,
    days: (() => {
      const ex = r.summary?.exDate ?? r.exDate ?? null
      return ex ? daysUntil(ex) : null
    })(),
    gap: belowAvg(r.price, r.ma200),
    mcap: r.marketCap ?? 0
  }
}

function cmp(a, b, sort) {
  const A = val(a)
  const B = val(b)
  switch (sort) {
    case 'yield':
      return (B.yieldDec ?? -1) - (A.yieldDec ?? -1)
    case 'ex': {
      const da = A.days == null || A.days < 0 ? Infinity : A.days
      const db = B.days == null || B.days < 0 ? Infinity : B.days
      return da - db
    }
    case 'below':
      return (A.gap ?? Infinity) - (B.gap ?? Infinity)
    case 'name':
      return a.name.localeCompare(b.name)
    case 'mcap':
      return (B.mcap ?? 0) - (A.mcap ?? 0)
    default:
      return 0
  }
}
