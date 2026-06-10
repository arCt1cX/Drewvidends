import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { api } from '../lib/api.js'
import { computeSignals, score, isImportantNews } from '../lib/signals.js'
import { fmtPct, fmtPctNum, fmtMoney, fmtNum, daysUntil, fmtDays, fmtDate } from '../lib/format.js'
import { positionStats, accruedNetSince } from '../lib/portfolio.js'
import SignalBadges from '../components/SignalBadges.jsx'
import Icon from '../components/Icon.jsx'

export default function WatchlistPage({ onOpen }) {
  const { rows, watch, loadSummary, summaries, portfolio } = useStore()
  const [view, setView] = useState('watch') // 'watch' | 'owned'
  const [news, setNews] = useState({}) // symbol -> [{title,link}]
  const [loadingSum, setLoadingSum] = useState(false)

  // carica summary (segnali + storico dividendi) di watchlist E titoli comprati
  const allSyms = useMemo(
    () => [...new Set([...watch, ...Object.keys(portfolio)])],
    [watch, portfolio]
  )
  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoadingSum(true)
      await Promise.all(allSyms.map((s) => loadSummary(s)))
      if (alive) setLoadingSum(false)
    })()
    return () => {
      alive = false
    }
  }, [allSyms, loadSummary])

  // carica news importanti (solo per la watchlist)
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

  // titoli comprati: ordinati per ex-date più vicina (così vedo subito chi sta per staccare)
  const owned = useMemo(() => {
    return Object.keys(portfolio)
      .map((sym) => {
        const r = rows.find((x) => x.symbol === sym)
        if (!r) return null
        const row = { ...r, summary: summaries[sym] || null }
        const exDate = row.summary?.exDate ?? row.exDate ?? null
        const days = exDate ? daysUntil(exDate) : null
        const holding = portfolio[sym]
        return { row, holding, stats: positionStats(row, holding), exDate, days }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const da = a.days != null && a.days >= 0 ? a.days : Infinity
        const db = b.days != null && b.days >= 0 ? b.days : Infinity
        return da - db
      })
  }, [portfolio, rows, summaries])

  // totali portafoglio (solo posizioni con quantità)
  const totals = useMemo(() => {
    const t = { invested: 0, value: 0, divNet: 0, divGross: 0 }
    for (const { stats } of owned) {
      if (!stats?.invested || stats.value == null) continue
      t.invested += stats.invested
      t.value += stats.value
      if (stats.divNet != null) t.divNet += stats.divNet
      if (stats.divGross != null) t.divGross += stats.divGross
    }
    return t
  }, [owned])

  // dividendi netti guadagnati: stacchi avvenuti da quando ogni titolo ha la spunta "comprato"
  const earned = useMemo(
    () =>
      owned.reduce(
        (a, { row, holding }) =>
          holding?.since ? a + accruedNetSince(row, holding, holding.since) : a,
        0
      ),
    [owned]
  )

  return (
    <div className="px-4">
      <header className="pt-3 pb-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{view === 'watch' ? 'Watchlist' : 'I miei titoli'}</h1>
          {loadingSum && <span className="text-[11px] text-muted">analizzo…</span>}
        </div>
        {/* toggle watchlist / comprati */}
        <div className="mt-2.5 grid grid-cols-2 gap-1 bg-surface border border-line rounded-xl p-1 text-center text-xs font-bold">
          <button
            onClick={() => setView('watch')}
            className={`py-1.5 rounded-lg transition-colors ${
              view === 'watch' ? 'bg-surface2 text-ink' : 'text-muted'
            }`}
          >
            Watchlist
          </button>
          <button
            onClick={() => setView('owned')}
            className={`py-1.5 rounded-lg transition-colors ${
              view === 'owned' ? 'bg-surface2 text-ink' : 'text-muted'
            }`}
          >
            Comprati
          </button>
        </div>
      </header>

      {view === 'watch' ? (
        <WatchView items={items} news={news} onOpen={onOpen} empty={!watch.length} />
      ) : (
        <OwnedView owned={owned} totals={totals} earned={earned} onOpen={onOpen} />
      )}
    </div>
  )
}

function WatchView({ items, news, onOpen, empty }) {
  if (empty) {
    return (
      <div className="pt-14 text-center text-muted">
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
    <div className="grid grid-cols-1 gap-3 pb-safe">
      {items.map(({ row, signals, sc }) => {
        const yieldDec = row.summary?.yield ?? row.yield ?? null
        const exDate = row.summary?.exDate ?? row.exDate ?? null
        const days = exDate ? daysUntil(exDate) : null
        const imp = news[row.symbol] || []
        return (
          <div key={row.symbol} className="bg-surface rounded-2xl border border-line p-3.5">
            <div onClick={() => onOpen(row.symbol)} className="flex items-start justify-between gap-3">
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
  )
}

function OwnedView({ owned, totals, earned, onOpen }) {
  if (!owned.length) {
    return (
      <div className="pt-14 text-center text-muted">
        <Icon name="note" size={40} className="mx-auto mb-3 text-line" />
        <p className="text-sm">
          Nessun titolo comprato.
          <br />
          Apri un titolo in watchlist e tocca la spunta
          <br />
          accanto alla stella per segnarlo come comprato.
        </p>
      </div>
    )
  }

  const pl = totals.value - totals.invested
  const plPct = totals.invested > 0 ? (pl / totals.invested) * 100 : null

  return (
    <div className="grid grid-cols-1 gap-3 pb-safe">
      {/* riepilogo portafoglio */}
      {totals.invested > 0 && (
        <div className="bg-surface rounded-2xl border border-line p-3.5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted">valore attuale</div>
              <div className="text-2xl font-extrabold mt-0.5">{fmtMoney(totals.value, 'EUR', 2)}</div>
            </div>
            <div className={`text-right font-bold ${pl >= 0 ? 'text-pos' : 'text-danger'}`}>
              <div className="flex items-center justify-end gap-1 text-sm">
                <Icon name={pl >= 0 ? 'triUp' : 'triDn'} size={12} />
                {fmtMoney(Math.abs(pl), 'EUR', 2)}
              </div>
              {plPct != null && <div className="text-[11px]">{fmtPctNum(plPct, 2)}</div>}
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-line flex items-start justify-between text-[11px] text-muted">
            <span>
              investito <span className="text-ink font-semibold">{fmtMoney(totals.invested, 'EUR', 2)}</span>
              <span className="block text-[10px]">
                dividendi guadagnati{' '}
                <span className="text-accent font-semibold">{fmtMoney(earned, 'EUR', 2)}</span> netti
              </span>
            </span>
            <span className="text-right">
              dividendi/anno{' '}
              <span className="text-accent font-semibold">{fmtMoney(totals.divNet, 'EUR', 2)}</span> netti
              <span className="block text-[10px]">{fmtMoney(totals.divGross, 'EUR', 2)} lordi</span>
            </span>
          </div>
        </div>
      )}

      {owned.map(({ row, stats, days }) => (
        <OwnedCard key={row.symbol} row={row} stats={stats} days={days} onOpen={onOpen} />
      ))}
    </div>
  )
}

function OwnedCard({ row, stats, days, onOpen }) {
  const exToday = days === 0
  const exSoon = days != null && days > 0 && days <= 7
  const up = stats?.plPct != null && stats.plPct >= 0

  return (
    <div
      onClick={() => onOpen(row.symbol)}
      className={`bg-surface rounded-2xl border p-3.5 ${exToday ? 'border-accent' : 'border-line'}`}
    >
      {/* evidenza ex-date: oggi stacca il dividendo */}
      {exToday && (
        <div className="mb-2.5 bg-accent-dim text-accent rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-bold">
          <Icon name="bell" size={14} />
          <span>
            Ex-date oggi: stacca il dividendo
            {row.paymentDate ? ` · paga il ${fmtDate(row.paymentDate)}` : ''}
          </span>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{row.name}</div>
          <div className="text-[11px] text-muted">
            {row.symbol.replace('.MI', '')}
            {stats?.qty ? ` · ≈${fmtNum(stats.qty, 2)} az · ${fmtMoney(stats.invested, 'EUR', 2)} investiti` : ''}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold">{fmtMoney(row.price, row.currency)}</div>
          {stats?.plPct != null && (
            <div
              className={`flex items-center justify-end gap-1 mt-0.5 text-xs font-bold ${
                up ? 'text-pos' : 'text-danger'
              }`}
            >
              <Icon name={up ? 'triUp' : 'triDn'} size={11} />
              {fmtPctNum(Math.abs(stats.plPct), 2)}
            </div>
          )}
        </div>
      </div>

      {stats && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <MiniStat
            label="guadagno"
            value={stats.pl != null ? fmtMoney(stats.pl, row.currency, 2) : '—'}
            tone={stats.pl == null ? undefined : stats.pl >= 0 ? 'pos' : 'neg'}
          />
          <MiniStat
            label="div. netti/anno"
            value={stats.divNet != null ? fmtMoney(stats.divNet, row.currency, 2) : '—'}
            tone="accent"
          />
          <MiniStat
            label="yield sul carico"
            value={stats.yoc != null ? fmtPctNum(stats.yoc, 1) : '—'}
          />
        </div>
      )}

      {(exSoon || (days != null && days > 7) || row.paymentDate || stats?.nextPayoutNet != null) && (
        <div className="mt-3 pt-2.5 border-t border-line flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold">
          {days != null && days > 0 && (
            <span className={`flex items-center gap-1.5 ${exSoon ? 'text-warn' : 'text-muted'}`}>
              <Icon name="clock" size={13} strokeWidth={1.7} />
              ex {fmtDays(days)}
            </span>
          )}
          {row.paymentDate && (
            <span className="text-muted">paga il {fmtDate(row.paymentDate)}</span>
          )}
          {stats?.nextPayoutNet != null && (
            <span className="text-accent">
              prossimo div. ~{fmtMoney(stats.nextPayoutNet, row.currency, 2)} netti
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value, tone }) {
  const color =
    tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-danger' : tone === 'accent' ? 'text-accent' : 'text-ink'
  return (
    <div className="bg-surface2 rounded-xl px-2 py-2">
      <div className={`text-[13px] font-bold ${color}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-muted mt-0.5">{label}</div>
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
