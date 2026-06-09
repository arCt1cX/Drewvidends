// Sparkline.jsx — mini-grafico prezzo (polyline normalizzata). Solo presentazione.

export function sparkPath(data, w, h, pad = 2) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const rng = max - min || 1
  const step = (w - pad * 2) / (data.length - 1)
  return data
    .map((v, i) => {
      const x = pad + i * step
      const y = pad + (h - pad * 2) * (1 - (v - min) / rng)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export default function Sparkline({ data, w = 72, h = 22, sw = 1.7, className = '' }) {
  if (!data || data.length < 2) return <svg width={w} height={h} className={className} />
  const d = sparkPath(data, w, h)
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
