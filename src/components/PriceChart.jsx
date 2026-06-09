import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { fmtMoney, fmtAxis, fmtDateTime } from '../lib/format.js'
import Icon from './Icon.jsx'

const RANGES = [
  { id: '1d', label: '1G' },
  { id: '5d', label: '1S' },
  { id: '1mo', label: '1M' },
  { id: '3mo', label: '3M' },
  { id: '6mo', label: '6M' },
  { id: '1y', label: '1A' },
  { id: '5y', label: '5A' }
]

// viewBox
const W = 320
const H = 160
const mL = 38 // spazio prezzi (sinistra)
const mR = 8
const mT = 8
const mB = 22 // spazio date (basso)
const plotW = W - mL - mR
const plotH = H - mT - mB

export default function PriceChart({ symbol, currency = 'EUR' }) {
  const [range, setRange] = useState('6mo')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hover, setHover] = useState(null) // indice punto sotto il cursore/dito
  const svgRef = useRef(null)

  const intraday = range === '1d' || range === '5d'

  useEffect(() => {
    let alive = true
    setLoading(true)
    setHover(null)
    api
      .chart(symbol, range)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData({ points: [] }))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [symbol, range])

  const points = data?.points || []

  const geom = useMemo(() => {
    if (points.length < 2) return null
    const ys = points.map((p) => p.c)
    const min = Math.min(...ys)
    const max = Math.max(...ys)
    const span = max - min || 1
    const n = points.length
    const xAt = (i) => mL + (i * plotW) / (n - 1)
    const yAt = (c) => mT + (1 - (c - min) / span) * plotH
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${xAt(i)},${yAt(p.c)}`).join(' ')
    const area = `${line} L${xAt(n - 1)},${mT + plotH} L${xAt(0)},${mT + plotH} Z`
    const up = points[n - 1].c >= points[0].c
    // tick X: inizio, due intermedi, fine
    const xTicks = [0, Math.floor((n - 1) / 3), Math.floor((2 * (n - 1)) / 3), n - 1]
    return { min, max, span, n, xAt, yAt, line, area, up, first: points[0].c, last: points[n - 1].c, xTicks }
  }, [points])

  const color = geom?.up ? '#37b88a' : '#e0625a'

  const onMove = (e) => {
    if (!geom || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const vbX = ((clientX - rect.left) / rect.width) * W
    let i = Math.round(((vbX - mL) / plotW) * (geom.n - 1))
    i = Math.max(0, Math.min(geom.n - 1, i))
    setHover(i)
  }

  const hp = hover != null && geom ? points[hover] : null
  const hx = hp ? geom.xAt(hover) : 0
  const hy = hp ? geom.yAt(hp.c) : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-sm font-bold">
          <span>{geom ? fmtMoney(geom.last, currency) : '—'}</span>
          {geom && (
            <span className="inline-flex items-center gap-0.5 text-xs font-bold" style={{ color }}>
              <Icon name={geom.up ? 'triUp' : 'triDn'} size={12} />
              {(((geom.last - geom.first) / geom.first) * 100).toFixed(1).replace('.', ',')}%
            </span>
          )}
        </div>
      </div>

      <div className="relative bg-surface border border-line rounded-xl p-1">
        {/* tooltip */}
        {hp && (
          <div className="absolute top-1 left-1/2 -translate-x-1/2 z-10 bg-surface2 border border-line rounded-lg px-2 py-1 text-[11px] pointer-events-none whitespace-nowrap">
            <span className="font-semibold" style={{ color }}>
              {fmtMoney(hp.c, currency)}
            </span>
            <span className="text-muted ml-2">{fmtDateTime(hp.t, intraday)}</span>
          </div>
        )}

        {loading ? (
          <div className="h-[160px] grid place-items-center text-xs text-muted">carico grafico…</div>
        ) : !geom ? (
          <div className="h-[160px] grid place-items-center text-xs text-muted">dati grafico n/d</div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full touch-none select-none"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={`g-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* griglia + etichette prezzo (asse Y) */}
            {[0, 0.5, 1].map((f) => {
              const price = geom.min + geom.span * (1 - f)
              const y = mT + f * plotH
              return (
                <g key={f}>
                  <line x1={mL} y1={y} x2={W - mR} y2={y} stroke="#272b33" strokeWidth="0.5" />
                  <text x={mL - 4} y={y + 3} textAnchor="end" fontSize="8" fill="#878d9a">
                    {price.toFixed(price < 10 ? 2 : 1).replace('.', ',')}
                  </text>
                </g>
              )
            })}

            {/* etichette data (asse X) */}
            {geom.xTicks.map((i, k) => {
              const x = geom.xAt(i)
              return (
                <text
                  key={k}
                  x={x}
                  y={H - 6}
                  textAnchor={k === 0 ? 'start' : k === geom.xTicks.length - 1 ? 'end' : 'middle'}
                  fontSize="8"
                  fill="#878d9a"
                >
                  {fmtAxis(points[i].t, intraday)}
                </text>
              )
            })}

            {/* area + linea */}
            <path d={geom.area} fill={`url(#g-${symbol})`} />
            <path d={geom.line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />

            {/* crosshair */}
            {hp && (
              <g>
                <line x1={hx} y1={mT} x2={hx} y2={mT + plotH} stroke="#878d9a" strokeWidth="0.6" strokeDasharray="2 2" />
                <circle cx={hx} cy={hy} r="3" fill={color} stroke="#14161b" strokeWidth="1.5" />
              </g>
            )}
          </svg>
        )}
      </div>

      {/* selettore periodo — segmented control */}
      <div className="flex gap-0.5 mt-2 bg-surface border border-line rounded-xl p-[3px]">
        {RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={`flex-1 text-[12px] py-1.5 rounded-lg transition-colors ${
              range === r.id ? 'bg-surface2 text-ink font-bold' : 'text-muted'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  )
}
