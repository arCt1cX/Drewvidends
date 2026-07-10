// Calcoli per i "titoli comprati": P/L sulla posizione e stima dividendi.

import { TAX } from './format.js'

// Dividendo annuo per azione: somma degli stacchi degli ultimi 12 mesi (dato vero),
// altrimenti stima da yield × prezzo corrente.
export function annualDividendPerShare(row) {
  const history = row.summary?.history
  if (history?.length) {
    const cutoff = Date.now() / 1000 - 365 * 86400
    const sum = history.filter((h) => h.date > cutoff).reduce((a, h) => a + h.amount, 0)
    if (sum > 0) return sum
  }
  const y = row.summary?.yield ?? row.yield
  if (y != null && row.price != null) return y * row.price
  return null
}

// Ultimo stacco per azione: stima della prossima cedola.
export function lastDividendPerShare(row) {
  const history = row.summary?.history
  if (!history?.length) return null
  return history[history.length - 1].amount ?? null
}

// Statistiche di una posizione (holding = { price, invested }): prezzo di 1 azione
// all'acquisto + euro totali investiti. Le azioni sono derivate (invested / price).
// Senza "invested" restano solo le metriche per-azione (P/L %, yield on cost).
export function positionStats(row, holding) {
  const buy = holding?.price
  if (!buy || buy <= 0) return null
  const invested = holding?.invested > 0 ? holding.invested : null
  const qty = invested ? invested / buy : null

  const plPct = row.price != null ? ((row.price - buy) / buy) * 100 : null

  const dps = annualDividendPerShare(row)
  // yield on cost: rendimento sul TUO prezzo di carico, non sul prezzo attuale
  const yoc = dps != null ? (dps / buy) * 100 : null
  const lastDps = lastDividendPerShare(row)

  const value = qty && row.price != null ? row.price * qty : null
  const pl = value != null ? value - invested : null
  const divGross = qty && dps != null ? dps * qty : null
  const divNet = divGross != null ? divGross * (1 - TAX) : null
  const nextPayoutNet = qty && lastDps != null ? lastDps * qty * (1 - TAX) : null

  return { qty, plPct, yoc, invested, value, pl, divGross, divNet, nextPayoutNet }
}

// Dividendi NETTI maturati da una posizione per gli stacchi avvenuti dopo sinceEpoch.
// Usato per sommare al capitale i dividendi incassati da quando è stato impostato.
export function accruedNetSince(row, holding, sinceEpoch) {
  const history = row.summary?.history
  const buy = holding?.price
  const qty = buy > 0 && holding?.invested > 0 ? holding.invested / buy : null
  if (!history?.length || !qty || !sinceEpoch) return 0
  const now = Date.now() / 1000
  const gross = history.reduce((a, h) => (h.date > sinceEpoch && h.date <= now ? a + h.amount : a), 0)
  return gross * qty * (1 - TAX)
}

// "12,50" / "12.50" -> 12.5 (input numerici con virgola italiana). null se non valido.
export function parseDecimal(str) {
  if (typeof str !== 'string' || !str.trim()) return null
  const n = parseFloat(str.trim().replace(',', '.'))
  return isNaN(n) || n < 0 ? null : n
}
