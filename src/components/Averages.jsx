import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { fmtMoney, fmtPctNum } from '../lib/format.js'

// medie prezzo su ~giorni di borsa: 1S≈5, 1M≈22, 3M≈66, 6M≈132, 1A≈252
const PERIODS = [
  { label: '1 settimana', days: 5 },
  { label: '1 mese', days: 22 },
  { label: '3 mesi', days: 66 },
  { label: '6 mesi', days: 132 },
  { label: '1 anno', days: 252 }
]

export default function Averages({ symbol, price, currency = 'EUR' }) {
  const [points, setPoints] = useState(null)

  useEffect(() => {
    let alive = true
    api
      .chart(symbol, '1y')
      .then((d) => alive && setPoints(d?.points || []))
      .catch(() => alive && setPoints([]))
    return () => {
      alive = false
    }
  }, [symbol])

  const averages = useMemo(() => {
    if (!points || points.length < 2) return null
    const closes = points.map((p) => p.c)
    return PERIODS.map((p) => {
      const slice = closes.slice(-p.days)
      const avg = slice.reduce((a, b) => a + b, 0) / slice.length
      const gap = price != null ? (price - avg) / avg : null // % prezzo attuale vs media
      return { ...p, avg, gap }
    })
  }, [points, price])

  if (!points) return <div className="text-xs text-muted">carico medie…</div>
  if (!averages) return <div className="text-xs text-muted">medie n/d</div>

  return (
    <div className="grid grid-cols-2 gap-2">
      {averages.map((a) => (
        <div key={a.label} className="bg-surface border border-line rounded-xl px-3 py-2">
          <div className="text-[10px] text-muted">Media {a.label}</div>
          <div className="text-sm font-semibold">{fmtMoney(a.avg, currency)}</div>
          {a.gap != null && (
            <div className={`text-[10px] ${a.gap < 0 ? 'text-accent' : 'text-muted'}`}>
              ora {a.gap >= 0 ? '+' : ''}
              {fmtPctNum(a.gap * 100, 1)} {a.gap < 0 ? '(sotto)' : '(sopra)'}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
