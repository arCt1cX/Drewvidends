import { useEffect, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { api } from '../lib/api.js'
import { computeSignals, isImportantNews } from '../lib/signals.js'
import { fmtPct, fmtPctNum, fmtMoney, fmtNum, netYield, belowAvg, daysUntil, fmtDate, fmtDays, TAX } from '../lib/format.js'
import { positionStats, parseDecimal } from '../lib/portfolio.js'
import SignalBadges from './SignalBadges.jsx'
import Spinner from './Spinner.jsx'
import PriceChart from './PriceChart.jsx'
import Averages from './Averages.jsx'
import HealthCheck from './HealthCheck.jsx'
import Icon from './Icon.jsx'

export default function StockDetail({ symbol, onClose }) {
  const { rows, summaries, loadSummary, isWatched, toggleWatch, notes, setNote, index, portfolio, setHolding, removeHolding } =
    useStore()
  const base = rows.find((r) => r.symbol === symbol) || { symbol, name: symbol }
  const [news, setNews] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      await loadSummary(symbol)
      try {
        const res = await api.news(symbol)
        if (alive) setNews(res.news || [])
      } catch {
        if (alive) setNews([])
      }
      if (alive) setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [symbol, loadSummary])

  const row = { ...base, summary: summaries[symbol] || null }
  const s = row.summary
  const yieldDec = s?.yield ?? row.yield ?? null
  const exDate = s?.exDate ?? row.exDate ?? null
  const days = exDate ? daysUntil(exDate) : null
  const gap200 = belowAvg(row.price, row.ma200)
  const signals = computeSignals(row)
  const watched = isWatched(symbol)
  const change = row.changePct
  const up = change >= 0

  const importantNews = (news || []).filter((n) => isImportantNews(n.title))
  const otherNews = (news || []).filter((n) => !isImportantNews(n.title))

  const owned = !!portfolio[symbol]

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-bg w-full max-w-screen-sm max-h-[92vh] rounded-t-3xl sm:rounded-3xl border-t sm:border border-line overflow-y-auto">
        {/* header */}
        <div className="sticky top-0 bg-bg/95 backdrop-blur px-4 py-3 flex items-center justify-between border-b border-line z-10">
          <div className="min-w-0">
            <div className="font-bold tracking-tight truncate">{row.name}</div>
            <div className="text-[11.5px] font-semibold text-muted tracking-wide">{symbol.replace('.MI', '')}</div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* spunta "comprato": solo per titoli in watchlist, mostra la sezione acquisto */}
            {watched && (
              <button
                onClick={() => (owned ? removeHolding(symbol) : setHolding(symbol, {}))}
                className={owned ? 'text-accent' : 'text-muted'}
                aria-label="comprato"
              >
                <Icon name={owned ? 'checkFill' : 'check'} size={20} />
              </button>
            )}
            <button onClick={() => toggleWatch(symbol)} className={watched ? 'text-accent' : 'text-muted'}>
              <Icon name={watched ? 'starFill' : 'star'} size={20} />
            </button>
            <button onClick={onClose} className="text-muted">
              <Icon name="x" size={20} />
            </button>
          </div>
        </div>

        <div className="px-4 py-4 space-y-5 pb-10">
          {/* hero yield */}
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">rendimento annuo lordo</div>
              <div className="text-5xl font-extrabold text-accent tracking-tightish leading-[0.9] mt-2">
                {fmtPct(yieldDec, 2)}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted mt-2">
                netto <span className="text-ink">{fmtPct(netYield(yieldDec), 2)}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-extrabold">{fmtMoney(row.price, row.currency)}</div>
              {change != null && (
                <div className={`flex items-center justify-end gap-1 mt-0.5 text-sm font-bold ${up ? 'text-pos' : 'text-danger'}`}>
                  <Icon name={up ? 'triUp' : 'triDn'} size={13} />
                  {fmtPctNum(Math.abs(change), 2)}
                </div>
              )}
            </div>
          </div>

          {/* grafico prezzo */}
          <PriceChart symbol={symbol} currency={row.currency} />

          {signals.length > 0 && <SignalBadges signals={signals} />}

          {/* salute del titolo: rumore di mercato vs problema strutturale */}
          <HealthCheck row={row} index={index} importantNews={importantNews} />

          {/* medie prezzo per periodo */}
          <div>
            <SectionTitle>Prezzo medio per periodo</SectionTitle>
            <Averages symbol={symbol} price={row.price} currency={row.currency} />
          </div>

          {/* dettaglio dividendo */}
          <div>
            <SectionTitle>Dividendo</SectionTitle>
            {loading && !s ? (
              <Spinner label="carico dettaglio…" />
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <Stat
                  label="Prossima ex-date (compra prima)"
                  value={exDate ? fmtDate(exDate) : '—'}
                  hint={days != null ? fmtDays(days) : null}
                  tone={days != null && days <= 7 && days >= 0 ? 'warn' : undefined}
                />
                <Stat label="Pagamento (arrivo soldi)" value={row.paymentDate ? fmtDate(row.paymentDate) : '—'} />
                <Stat
                  label="Payout (% utili distribuiti)"
                  value={row.payoutRatio != null ? fmtPctNum(row.payoutRatio * 100, 0) : '—'}
                  tone={row.payoutRatio > 1 ? 'bad' : undefined}
                  hint={row.payoutRatio > 1 ? 'oltre 100%: poco sostenibile' : null}
                />
                <Stat
                  label="Yield medio 5 anni (storico)"
                  value={row.fiveYearAvgYield != null ? fmtPctNum(row.fiveYearAvgYield, 1) : '—'}
                />
                <Stat
                  label="vs media 200gg (− = sotto)"
                  value={gap200 != null ? fmtPctNum(gap200 * 100, 1) : '—'}
                  tone={gap200 < 0 ? 'good' : undefined}
                  hint="prezzo vs media ultimi 200 giorni"
                />
                <Stat
                  label="Min/Max 52 sett (ultimo anno)"
                  value={
                    row.low52 && row.high52
                      ? `${fmtMoney(row.low52, row.currency)} / ${fmtMoney(row.high52, row.currency)}`
                      : '—'
                  }
                />
              </div>
            )}
          </div>

          {/* storico dividendi */}
          {s?.history?.length > 0 && (
            <div>
              <SectionTitle>Storico dividendi (importo · % sul prezzo)</SectionTitle>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {s.history.slice(-8).reverse().map((h, i) => (
                  <div key={i} className="shrink-0 bg-surface border border-line rounded-xl px-3 py-2 text-center">
                    <div className="text-sm font-bold">{fmtMoney(h.amount, row.currency)}</div>
                    <div className="text-[11px] font-semibold text-accent">
                      {h.yieldPct != null ? fmtPctNum(h.yieldPct, 2) : '—'}
                    </div>
                    <div className="text-[10px] text-muted">{fmtDate(h.date)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* news */}
          <div>
            <SectionTitle>News</SectionTitle>
            {loading && news == null ? (
              <Spinner label="carico news…" />
            ) : (news || []).length === 0 ? (
              <p className="text-xs text-muted">Nessuna news disponibile.</p>
            ) : (
              <div className="space-y-2">
                {importantNews.map((n, i) => (
                  <NewsItem key={'i' + i} news={n} important />
                ))}
                {otherNews.slice(0, 4).map((n, i) => (
                  <NewsItem key={'o' + i} news={n} />
                ))}
              </div>
            )}
          </div>

          {/* il mio acquisto: compare solo con la spunta "comprato" nell'header */}
          {owned && (
            <div>
              <SectionTitle>Il mio acquisto</SectionTitle>
              <HoldingEditor
                key={symbol}
                row={row}
                holding={portfolio[symbol]}
                onSave={(data) => setHolding(symbol, data)}
              />
            </div>
          )}

          {/* note */}
          <div>
            <SectionTitle>Le mie note</SectionTitle>
            <textarea
              value={notes[symbol] || ''}
              onChange={(e) => setNote(symbol, e.target.value)}
              placeholder="Appunti su questo titolo…"
              rows={3}
              className="w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-sm text-ink outline-none focus:border-accent resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return <div className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2.5">{children}</div>
}

function Stat({ label, value, hint, tone, big }) {
  const color = tone === 'good' ? 'text-accent' : tone === 'bad' ? 'text-danger' : tone === 'warn' ? 'text-warn' : 'text-ink'
  return (
    <div className="bg-surface border border-line rounded-xl px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted leading-tight">{label}</div>
      <div className={`${big ? 'text-lg' : 'text-base'} font-bold mt-1 ${color}`}>{value}</div>
      {hint && <div className={`text-[10px] mt-0.5 ${tone ? color : 'text-muted'}`}>{hint}</div>}
    </div>
  )
}

// Editor acquisto: costo di 1 azione al momento dell'acquisto + euro totali investiti.
// Salva mentre scrivi e mostra subito azioni stimate, P/L e dividendi della posizione.
function HoldingEditor({ row, holding, onSave }) {
  const fmtInput = (v) => (v != null ? String(v).replace('.', ',') : '')
  const [price, setPrice] = useState(() => fmtInput(holding?.price))
  const [invested, setInvested] = useState(() => fmtInput(holding?.invested))
  const stats = positionStats(row, holding)

  const inputCls =
    'mt-1 w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-sm text-ink outline-none focus:border-accent'

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-muted">Costo di 1 azione all’acquisto</span>
          <input
            value={price}
            onChange={(e) => {
              setPrice(e.target.value)
              onSave({ price: parseDecimal(e.target.value) })
            }}
            inputMode="decimal"
            placeholder="es. 2,30"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-muted">Totale investito (€)</span>
          <input
            value={invested}
            onChange={(e) => {
              setInvested(e.target.value)
              onSave({ invested: parseDecimal(e.target.value) })
            }}
            inputMode="decimal"
            placeholder="es. 1000"
            className={inputCls}
          />
        </label>
      </div>

      {stats ? (
        <>
          {stats.qty != null && (
            <p className="text-[11px] text-muted">
              ≈ <span className="text-ink font-semibold">{fmtNum(stats.qty, 2)}</span> azioni a{' '}
              {fmtMoney(holding.price, row.currency)}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <Stat
              label="Guadagno / Perdita"
              value={stats.pl != null ? fmtMoney(stats.pl, row.currency, 2) : fmtPctNum(stats.plPct, 2)}
              hint={stats.pl != null ? fmtPctNum(stats.plPct, 2) : 'inserisci il totale investito per il valore in €'}
              tone={stats.plPct == null ? undefined : stats.plPct >= 0 ? 'good' : 'bad'}
            />
            <Stat
              label="Dividendi annui netti (stima)"
              value={stats.divNet != null ? fmtMoney(stats.divNet, row.currency, 2) : '—'}
              hint={stats.divGross != null ? `lordi ${fmtMoney(stats.divGross, row.currency, 2)}` : 'serve il totale investito'}
            />
            <Stat
              label="Yield sul mio prezzo"
              value={stats.yoc != null ? fmtPctNum(stats.yoc, 2) : '—'}
              hint={stats.yoc != null ? `netto ${fmtPctNum(stats.yoc * (1 - TAX), 2)}` : null}
            />
            <Stat
              label="Prossimo dividendo netto (stima)"
              value={stats.nextPayoutNet != null ? fmtMoney(stats.nextPayoutNet, row.currency, 2) : '—'}
              hint="in base all'ultimo pagamento"
            />
          </div>
        </>
      ) : (
        <p className="text-xs text-muted leading-snug">
          Scrivi quanto costava un’azione quando hai comprato e quanti euro ci hai messo: lo ritrovi in
          Watchlist → Comprati con guadagno e dividendi stimati.
        </p>
      )}
    </div>
  )
}

function NewsItem({ news, important }) {
  return (
    <a
      href={news.link}
      target="_blank"
      rel="noreferrer"
      className={`block rounded-xl px-3 py-2.5 border ${
        important ? 'bg-accent-dim border-transparent' : 'bg-surface border-line'
      }`}
    >
      <div className="flex items-start gap-2">
        {important && <span className="mt-1.5 w-[5px] h-[5px] rounded-full bg-accent shrink-0" />}
        <div className="text-xs leading-snug text-ink">{news.title}</div>
      </div>
      <div className="text-[10px] text-muted mt-1">
        {news.publisher}
        {news.time ? ' · ' + fmtDate(news.time) : ''}
      </div>
    </a>
  )
}
