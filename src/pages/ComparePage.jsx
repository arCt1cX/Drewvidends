import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { fmtPct, fmtPctNum, fmtMoney, netYield, belowAvg, daysUntil, fmtDays } from '../lib/format.js'

export default function ComparePage({ onOpen }) {
  const { rows, watch, summaries, loadSummary } = useStore()
  // pool = titoli mostrati come chip; selected = quelli nella tabella
  const [extra, setExtra] = useState([]) // aggiunti via ricerca (oltre la watchlist)
  const [selected, setSelected] = useState(() => new Set(watch))
  const [q, setQ] = useState('')

  const pool = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const sym of [...watch, ...extra]) {
      if (seen.has(sym)) continue
      seen.add(sym)
      const r = rows.find((x) => x.symbol === sym)
      if (r) out.push(r)
    }
    return out
  }, [watch, extra, rows])

  const selectedRows = useMemo(
    () => pool.filter((r) => selected.has(r.symbol)).map((r) => ({ ...r, summary: summaries[r.symbol] || null })),
    [pool, selected, summaries]
  )

  useEffect(() => {
    selectedRows.forEach((r) => loadSummary(r.symbol))
  }, [selectedRows, loadSummary])

  const toggle = (sym) =>
    setSelected((s) => {
      const n = new Set(s)
      n.has(sym) ? n.delete(sym) : n.add(sym)
      return n
    })

  const searchResults = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    const inPool = new Set(pool.map((r) => r.symbol))
    return rows
      .filter((r) => `${r.name} ${r.symbol}`.toLowerCase().includes(t) && !inPool.has(r.symbol))
      .slice(0, 6)
  }, [q, rows, pool])

  const addFromSearch = (sym) => {
    setExtra((e) => (e.includes(sym) ? e : [...e, sym]))
    setSelected((s) => new Set(s).add(sym))
    setQ('')
  }

  // miglior valore per ogni metrica (colonna), per evidenziarlo
  const bestByLabel = {}
  for (const m of METRICS) {
    if (!m.best) continue
    const nums = selectedRows.map(m.get).filter((v) => v != null && !isNaN(v))
    if (nums.length > 1) bestByLabel[m.label] = m.best === 'max' ? Math.max(...nums) : Math.min(...nums)
  }

  return (
    <div className="px-4">
      <header className="pt-3 pb-2">
        <h1 className="text-xl font-bold">Confronto</h1>
        <p className="text-[11px] text-muted">Tocca un titolo per aggiungerlo/toglierlo dalla tabella.</p>
      </header>

      {/* ricerca per aggiungere titoli al pool */}
      <div className="relative mb-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Aggiungi un titolo…"
          className="w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-sm outline-none focus:border-accent/50"
        />
        {searchResults.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-surface2 border border-line rounded-xl overflow-hidden">
            {searchResults.map((r) => (
              <button
                key={r.symbol}
                onClick={() => addFromSearch(r.symbol)}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-surface"
              >
                {r.name} <span className="text-muted text-xs">{r.symbol.replace('.MI', '')}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* chip selezionabili */}
      {pool.length === 0 ? (
        <p className="text-sm text-muted pt-4">
          Aggiungi titoli alla watchlist o cercali qui sopra per confrontarli.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-3">
          {pool.map((r) => {
            const on = selected.has(r.symbol)
            return (
              <button
                key={r.symbol}
                onClick={() => toggle(r.symbol)}
                className={`text-[12.5px] font-semibold px-3.5 h-8 rounded-xl border transition-colors ${
                  on ? 'bg-accent-dim text-accent border-transparent' : 'bg-surface text-muted border-line'
                }`}
              >
                {r.symbol.replace('.MI', '')}
              </button>
            )
          })}
        </div>
      )}

      {/* tabella unica verticale: metriche in riga, titoli in colonna; evidenzia il valore migliore */}
      {selectedRows.length === 0 ? (
        <p className="text-sm text-muted pt-4 text-center">Seleziona almeno un titolo.</p>
      ) : (
        <div className="pb-safe">
          <table className="w-full table-fixed text-[11px] border-separate border-spacing-0">
            <thead>
              <tr className="text-muted">
                <th className="text-left px-1 py-2 w-12">Tit.</th>
                {METRICS.map((m) => (
                  <th key={m.label} className="px-0.5 py-2 font-semibold leading-tight">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selectedRows.map((r) => (
                <tr key={r.symbol}>
                  <td className="px-1 py-2 border-t border-line align-top">
                    <button onClick={() => onOpen(r.symbol)} className="font-bold text-accent block leading-tight">
                      {r.symbol.replace('.MI', '')}
                    </button>
                    <button onClick={() => toggle(r.symbol)} className="text-[9px] text-danger">
                      togli
                    </button>
                  </td>
                  {METRICS.map((m) => {
                    const v = m.get(r)
                    const isBest = bestByLabel[m.label] != null && v === bestByLabel[m.label]
                    return (
                      <td key={m.label} className="px-0.5 py-2 text-center border-t border-line">
                        <span
                          className={`inline-block px-1.5 py-1 rounded-md font-semibold leading-tight ${
                            isBest ? 'bg-accent-dim text-accent' : 'text-ink'
                          }`}
                        >
                          {m.fmt(v, r)}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-muted mt-2">
            Verde = miglior valore della colonna (Div. % / Yield 5a: più alto · vs media / Payout / Ex: più basso).
            Prezzo non valutato.
          </p>
        </div>
      )}
    </div>
  )
}

const yieldOf = (r) => r.yield ?? null

// get = valore numerico (per confronto), fmt = come mostrarlo, best = direzione del "migliore"
const METRICS = [
  { label: 'Div. %', get: (r) => yieldOf(r), fmt: (v) => fmtPct(v, 2), best: 'max' },
  { label: 'Prezzo', get: (r) => r.price, fmt: (v, r) => fmtMoney(v, r.currency), best: null },
  {
    label: 'vs media',
    get: (r) => belowAvg(r.price, r.ma200),
    fmt: (v) => (v == null ? '—' : fmtPctNum(v * 100, 1)),
    best: 'min'
  },
  {
    label: 'Ex (gg)',
    get: (r) => (r.exDate ? daysUntil(r.exDate) : null),
    fmt: (v) => (v == null ? '—' : fmtDays(v)),
    best: 'min'
  },
  {
    label: 'Payout',
    get: (r) => r.payoutRatio,
    fmt: (v) => (v == null ? '—' : fmtPctNum(v * 100, 0)),
    best: 'min'
  },
  {
    label: 'Yield 5a',
    get: (r) => r.fiveYearAvgYield,
    fmt: (v) => (v == null ? '—' : fmtPctNum(v, 1)),
    best: 'max'
  }
]
