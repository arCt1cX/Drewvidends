// Motore segnali/consigli: logica deterministica sui dati (niente AI).
// Ogni titolo -> lista di segnali (buy / info / warn) + punteggio "occasione ora" 0-100.

import { belowAvg, daysUntil, fmtPctNum, fmtDays, fmtPct } from './format.js'

// I campi dividendo sono già normalizzati sullo store (summary > divinfo > quote).
function merge(row) {
  const s = row.summary || {}
  return {
    price: row.price,
    ma50: row.ma50,
    ma200: row.ma200,
    low52: s.low52 ?? row.low52,
    high52: s.high52 ?? row.high52,
    yieldDec: row.yield ?? null, // decimale
    exDate: row.exDate ?? null,
    payout: row.payoutRatio ?? null,
    fiveY: row.fiveYearAvgYield ?? null // numero in %
  }
}

export function computeSignals(row) {
  const v = merge(row)
  const sig = []
  const gap200 = belowAvg(v.price, v.ma200)
  const gap50 = belowAvg(v.price, v.ma50)
  const days = v.exDate ? daysUntil(v.exDate) : null

  // 🟢 ACQUISTO
  if (gap200 != null && gap200 <= -0.05 && days != null && days >= 20 && days <= 160) {
    sig.push({
      level: 'buy',
      icon: '🎯',
      text: `Finestra ideale: ${fmtPctNum(gap200 * 100, 0)} sotto media 200gg, ex ${fmtDays(days)}`
    })
  } else if (gap200 != null && gap200 <= -0.07) {
    sig.push({ level: 'buy', icon: '🟢', text: `Sotto media 200gg (${fmtPctNum(gap200 * 100, 0)})` })
  } else if (gap50 != null && gap50 <= -0.05) {
    sig.push({ level: 'buy', icon: '🟢', text: `Sotto media 50gg (${fmtPctNum(gap50 * 100, 0)})` })
  }

  if (v.low52 && v.price != null) {
    const nearLow = (v.price - v.low52) / v.low52
    if (nearLow <= 0.05) sig.push({ level: 'buy', icon: '📉', text: 'Vicino al minimo 52 settimane' })
  }

  if (v.fiveY && v.yieldDec != null) {
    const curPct = v.yieldDec * 100
    if (curPct >= v.fiveY * 1.15)
      sig.push({
        level: 'buy',
        icon: '💎',
        text: `Yield ${fmtPctNum(curPct, 1)} sopra media storica ${fmtPctNum(v.fiveY, 1)} (a sconto)`
      })
  }

  // 🔔 NOTIFICHE ex-date
  if (days != null) {
    if (days >= 0 && days <= 7)
      sig.push({
        level: 'info',
        icon: '⏰',
        text: `Ultimi ${days}gg per comprare e avere diritto al dividendo`
      })
    else if (days < 0 && days >= -3)
      sig.push({
        level: 'info',
        icon: '⏭️',
        text: 'Stacco appena avvenuto: prezzo sceso ~dividendo (normale)'
      })
  }

  // 🔴 ALLERTE
  if (v.yieldDec != null && v.yieldDec >= 0.09)
    sig.push({
      level: 'warn',
      icon: '⚠️',
      text: `Yield ${fmtPct(v.yieldDec, 1)} molto alto: verifica sia sostenibile (possibile trappola)`
    })
  if (v.payout != null && v.payout > 1.0)
    sig.push({
      level: 'warn',
      icon: '⚠️',
      text: `Payout ${fmtPctNum(v.payout * 100, 0)} (>100%): dividendo poco sostenibile`
    })

  if (gap200 != null && gap200 >= 0.05 && !sig.some((x) => x.level === 'buy'))
    sig.push({ level: 'info', icon: '⬆️', text: 'Sopra la media: non è un momento di sconto' })

  return sig
}

export function score(row) {
  const v = merge(row)
  const days = v.exDate ? daysUntil(v.exDate) : null
  const gap200 = belowAvg(v.price, v.ma200)
  let sc = 0
  if (gap200 != null) sc += Math.max(0, Math.min(35, -gap200 * 100 * 2)) // sotto media
  if (days != null && days >= 20 && days <= 160) sc += 30 // finestra acquisto
  else if (days != null && days >= 0 && days <= 200) sc += 12
  if (v.yieldDec) sc += Math.min(20, v.yieldDec * 100 * 3) // yield
  if (v.fiveY && v.yieldDec && v.yieldDec * 100 >= v.fiveY) sc += 8 // sopra media storica
  if (v.payout != null && v.payout > 1.0) sc -= 18 // trap
  if (v.yieldDec >= 0.1) sc -= 12 // sospetto
  return Math.max(0, Math.min(100, Math.round(sc)))
}

// Filtro news "solo importante": parole chiave rilevanti per chi investe in dividendi.
const NEWS_KEYWORDS = [
  /dividend/i, /cedola/i, /payout/i, /earnings/i, /utili/i, /trimestral/i, /quarter/i,
  /guidance/i, /profit warning/i, /acquis/i, /merger/i, /fusion/i, /takeover/i, /\bopa\b/i,
  /buyback/i, /rating/i, /downgrade/i, /upgrade/i, /moody|s&p|fitch/i,
  /\bceo\b|\bcfo\b|amministratore delegato/i, /outlook/i, /forecast/i,
  /\bcut\b|taglio|riduc/i, /suspend|sospen/i, /bilancio/i, /semestral/i
]

export function isImportantNews(title = '') {
  return NEWS_KEYWORDS.some((re) => re.test(title))
}
