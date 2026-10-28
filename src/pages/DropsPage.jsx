import { useMemo, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { fmtPct, fmtPctNum, fmtMoney } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import Sparkline from '../components/Sparkline.jsx'

const POPULAR_MIN = 1e9 // stessa soglia "Popolari" della Lista (cap ≥ 1 mld €)
const SESSIONS = 5 // una settimana di borsa

// Fasce di calo (in %, valori positivi). max null = senza limite superiore.
const BANDS = [
  { id: 'all', label: 'Tutti i cali', min: 0, max: null },
  { id: '0-5', label: '0–5%', min: 0, max: 5 },
  { id: '5-8', label: '5–8%', min: 5, max: 8 },
  { id: '8-15', label: '8–15%', min: 8, max: 15 },
  { id: '15-25', label: '15–25%', min: 15, max: 25 },
  { id: '25+', label: 'oltre 25%', min: 25, max: null }
]

// Prezzo minimo per azione: i titoli da pochi centesimi sono quasi sempre rumore.
const MIN_PRICES = [0, 1, 2, 5, 10, 20]

const inBand = (drop, b) => drop > b.min && (b.max == null || drop <= b.max)

// Variazione % a 1 settimana dalle chiusure giornaliere della sparkline (~1 mese):
// ultima chiusura vs quella di 5 sedute prima. Negativo = calo.
export function weekChange(closes) {
  if (!closes || closes.length < SESSIONS + 1) return null
  const last = closes[closes.length - 1]
  const base = closes[closes.length - 1 - SESSIONS]
  if (!base || last == null) return null
  return ((last - base) / base) * 100
}

export default function DropsPage({ onOpen }) {
  const { rows, isWatched } = useStore()
  const [band, setBand] = useState('all')
  const [onlyPopular, setOnlyPopular] = useState(false)
  const [minPrice, setMinPrice] = useState(0)

  // tutti i titoli in calo nell'ultima settimana, dal calo più forte
  const drops = useMemo(
    () =>
      rows
        .map((r) => {
          const ch = weekChange(r.spark)
          return ch != null && ch < 0 ? { ...r, drop: -ch } : null
        })
        .filter(Boolean)
        .filter((r) => (onlyPopular ? r.marketCap >= POPULAR_MIN : true))
        .filter((r) => (minPrice ? r.price >= minPrice : true))
        .sort((a, b) => b.drop - a.drop),
    [rows, onlyPopular, minPrice]
  )

  const counts = useMemo(() => {
    const c = {}
    for (const b of BANDS) c[b.id] = drops.filter((r) => inBand(r.drop, b)).length
    return c
  }, [drops])

  const current = BANDS.find((b) => b.id === band)
  const list = drops.filter((r) => inBand(r.drop, current))
  const loaded = rows.some((r) => r.spark)

  return (
    <div className="px-4">
      <header className="pt-3 pb-2">
        <h1 className="text-xl font-bold">Ribassi della settimana</h1>
        <p className="text-[11px] text-muted">Titoli italiani in calo nelle ultime 5 sedute.</p>
      </header>

      <div className="sticky top-[env(safe-area-inset-top)] z-20 bg-bg/95 backdrop-blur pt-1 pb-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
          <button
            onClick={() => setOnlyPopular((v) => !v)}
            className={`h-8 px-3.5 rounded-xl text-[12.5px] font-semibold shrink-0 border ${
              onlyPopular ? 'bg-accent-dim text-accent border-transparent' : 'bg-surface text-muted border-line'
            }`}
          >
            Popolari
          </button>
          <select
            value={minPrice}
            onChange={(e) => setMinPrice(Number(e.target.value))}
            className={`h-8 px-3.5 rounded-xl text-[12.5px] font-semibold shrink-0 border ${
              minPrice ? 'bg-accent-dim text-accent border-transparent' : 'bg-surface text-muted border-line'
            }`}
          >
            {MIN_PRICES.map((v) => (
              <option key={v} value={v}>
                {v ? `Prezzo > ${v} €` : 'Prezzo: tutti'}
              </option>
            ))}
          </select>
          {BANDS.map((b) => {
            const active = band === b.id
            return (
              <button
                key={b.id}
                onClick={() => setBand(b.id)}
                className={`h-8 px-3.5 rounded-xl text-[12.5px] font-semibold shrink-0 border flex items-center gap-1.5 ${
                  active ? 'bg-danger/15 text-danger border-transparent' : 'bg-surface text-muted border-line'
                }`}
              >
                {b.label}
                <span className={`text-[10.5px] ${active ? 'text-danger/80' : 'text-muted/70'}`}>{counts[b.id]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {!loaded ? (
        <p className="pt-6 text-center text-sm text-muted">Carico i prezzi della settimana…</p>
      ) : list.length === 0 ? (
        <p className="pt-6 text-center text-sm text-muted">Nessun titolo in questa fascia di calo.</p>
      ) : (
        <>
          <div className="text-[11px] text-muted py-1">{list.length} titoli</div>
          <div className="grid grid-cols-1 gap-2 pb-safe">
            {list.map((r) => {
              const yieldDec = r.summary?.yield ?? r.yield ?? null
              return (
                <div
                  key={r.symbol}
                  onClick={() => onOpen(r.symbol)}
                  className="bg-surface rounded-xl border border-line p-3 flex items-center justify-between gap-2 active:bg-surface2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      {isWatched(r.symbol) && <Icon name="starFill" size={13} className="text-accent shrink-0" />}
                      <span className="truncate">{r.name}</span>
                    </div>
                    <div className="text-[11px] text-muted">
                      {r.symbol.replace('.MI', '')} · {fmtMoney(r.price, r.currency)}
                      {yieldDec != null && <> · div {fmtPct(yieldDec, 1)}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-danger">
                      <Sparkline data={r.spark.slice(-(SESSIONS + 1))} w={52} h={20} />
                    </div>
                    <div className="text-right min-w-[58px]">
                      <div className="flex items-center justify-end gap-0.5 text-danger font-bold text-sm">
                        <Icon name="triDn" size={12} />
                        {fmtPctNum(r.drop, 1)}
                      </div>
                      <div className="text-[10px] text-muted">1 settimana</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
