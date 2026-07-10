// Formattazione in italiano (virgola decimale, euro, date brevi).

export const TAX = 0.26 // ritenuta dividendi Italia

// v = decimale (0.045 -> "4,50%")
export function fmtPct(v, dec = 2) {
  if (v == null || isNaN(v)) return '—'
  return (v * 100).toFixed(dec).replace('.', ',') + '%'
}

// v = numero gia in percentuale (4.5 -> "4,50%")
export function fmtPctNum(v, dec = 2) {
  if (v == null || isNaN(v)) return '—'
  return v.toFixed(dec).replace('.', ',') + '%'
}

// dec opzionale: forza i decimali (es. 2 per importi di guadagno/dividendo).
// Default: 3 decimali sotto i 10€ (prezzi azione tipo 3,774), altrimenti 2.
export function fmtMoney(v, cur = 'EUR', dec) {
  if (v == null || isNaN(v)) return '—'
  const d = dec ?? (v < 10 ? 3 : 2)
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: cur || 'EUR',
    minimumFractionDigits: Math.min(2, d),
    maximumFractionDigits: d
  }).format(v)
}

export function fmtNum(v, dec = 2) {
  if (v == null || isNaN(v)) return '—'
  return v.toLocaleString('it-IT', { maximumFractionDigits: dec })
}

export function fmtCompact(v) {
  if (v == null || isNaN(v)) return '—'
  if (v >= 1e9) return (v / 1e9).toFixed(1).replace('.', ',') + ' mld'
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace('.', ',') + ' mln'
  return fmtNum(v, 0)
}

export function netYield(grossDecimal) {
  if (grossDecimal == null || isNaN(grossDecimal)) return null
  return grossDecimal * (1 - TAX)
}

// gap percentuale prezzo vs media (negativo = sotto la media)
export function belowAvg(price, ma) {
  if (price == null || !ma) return null
  return (price - ma) / ma
}

// differenza in giorni-solari (ignora l'ora): ieri = -1, oggi = 0, domani = 1
export function daysUntil(epochSec) {
  if (!epochSec) return null
  const target = new Date(epochSec * 1000)
  target.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

export function fmtDate(epochSec) {
  if (!epochSec) return '—'
  return new Date(epochSec * 1000).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

// etichetta breve per asse X: ora se intraday, altrimenti data
export function fmtAxis(epochSec, intraday) {
  if (!epochSec) return ''
  const d = new Date(epochSec * 1000)
  if (intraday)
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

// data+ora completa per il tooltip del grafico
export function fmtDateTime(epochSec, intraday) {
  if (!epochSec) return ''
  const d = new Date(epochSec * 1000)
  if (intraday)
    return d.toLocaleString('it-IT', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDays(d) {
  if (d == null) return '—'
  if (d < 0) return 'passata'
  if (d === 0) return 'oggi'
  if (d === 1) return 'domani'
  if (d < 45) return `tra ${d}gg`
  const m = Math.round(d / 30)
  return `tra ~${m} mesi`
}
