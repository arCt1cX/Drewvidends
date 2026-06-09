import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { api } from '../lib/api.js'
import { computeSignals, score, isImportantNews } from '../lib/signals.js'
import { fmtPct, fmtMoney, daysUntil, fmtDays } from '../lib/format.js'
import SignalBadges from '../components/SignalBadges.jsx'
import Spinner from '../components/Spinner.jsx'
import Icon from '../components/Icon.jsx'

export default function WatchlistPage({ onOpen }) {
  const { rows, watch, loadSummary, summaries } = useStore()
  const [news, setNews] = useState({}) // symbol -> [{title,link}]
  const [loadingSum, setLoadingSum] = useState(false)

  // carica summary (per i segnali) di tutti i titoli in watchlist
  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoadingSum(true)
      await Promise.all(watch.map((s) => loadSummary(s)))
      if (alive) setLoadingSum(false)
    })()
    return () => {
      alive = false
    }
  }, [watch, loadSummary])

  // carica news importanti
  useEffect(() => {
    let alive = true
    watch.forEach(async (sym) => {
      if (news[sym]) return
      try {
        const res = await api.news(sym)
        const important = (res.news || []).filter((n) => isImportantNews(n.title)).slice(0, 4)
        if (alive) setNews((p) => ({ ...p, [sym]: important }))
      } catch {
        /* ignora */
      }
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch])

  const items = useMemo(() => {
    return watch
      .map((sym) => rows.find((r) => r.symbol === sym))
      .filter(Boolean)
      .map((r) => ({ ...r, summary: summaries[r.symbol] || null }))
      .map((r) => ({ row: r, signals: computeSignals(r), sc: score(r) }))
      .sort((a, b) => b.sc - a.sc)
  }, [watch, rows, summaries])

  if (!watch.length) {
    return (
      <div className="px-4 pt-16 text-center text-muted">
        <Icon name="star" size={40} className="mx-auto mb-3 text-line" />
        <p className="text-sm">
          Nessun titolo in watchlist.
          <br />
          Apri un titolo dalla Lista e tocca la stella per seguirlo.
        </p>
      </div>
    )
  }

  return (
    <div className="px-4">
      <header className="pt-3 pb-2 flex items-center justify-between">
        <h1 className="text-xl font-bold">Watchlist</h1>
        {loadingSum && <span className="text-[11px] text-muted">analizzo…</span>}
      </header>

      <div className="grid grid-cols-1 gap-3 pb-safe">
        {items.map(({ row, signals, sc }) => {
          const yieldDec = row.summary?.yield ?? row.yield ?? null
          const exDate = row.summary?.exDate ?? row.exDate ?? null
          const days = exDate ? daysUntil(exDate) : null
          const imp = news[row.symbol] || []
          return (
            <div key={row.symbol} className="bg-surface rounded-2xl border border-line p-3.5">
              <div
                onClick={() => onOpen(row.symbol)}
                className="flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{row.name}</div>
                  <div className="text-[11px] text-muted">{row.symbol.replace('.MI', '')}</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl font-bold text-accent">{fmtPct(yieldDec, 2)}</span>
                    <span className="text-xs text-muted">{fmtMoney(row.price, row.currency)}</span>
                    {days != null && days >= 0 && (
                      <span className="text-[11px] text-muted">· ex {fmtDays(days)}</span>
                    )}
                  </div>
                </div>
                <ScoreRing value={sc} />
              </div>

              {signals.length > 0 && (
                <div className="mt-3">
                  <SignalBadges signals={signals} />
                </div>
              )}

              {imp.length > 0 && (
                <div className="mt-3 border-t border-line pt-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">
                    <Icon name="bell" size={13} /> News rilevanti
                  </div>
                  <div className="space-y-1">
                    {imp.map((n, i) => (
                      <a
                        key={i}
                        href={n.link}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs text-muted hover:text-accent leading-snug"
                      >
                        · {n.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ScoreRing({ value }) {
  const color = value >= 60 ? '#37b88a' : value >= 35 ? '#e0b250' : '#878d9a'
  return (
    <div className="shrink-0 text-center">
      <div
        className="w-12 h-12 rounded-full grid place-items-center text-sm font-bold"
        style={{ background: `conic-gradient(${color} ${value * 3.6}deg, #22262e 0deg)` }}
      >
        <div className="w-9 h-9 rounded-full bg-surface grid place-items-center" style={{ color }}>
          {value}
        </div>
      </div>
      <div className="text-[9px] uppercase tracking-wide text-muted mt-0.5">occasione</div>
    </div>
  )
}
