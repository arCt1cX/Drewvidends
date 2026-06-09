import { fetchSummary, fetchChart, json } from '../lib/yahoo.js'

// GET /api/summary?symbol=ENI.MI
// Dettaglio dividendi: yield forward, ex-date ANNUNCIATA, payout, media yield 5 anni, storico dividendi.
export async function onRequestGet(context) {
  const url = new URL(context.request.url)
  const symbol = (url.searchParams.get('symbol') || '').trim()
  if (!symbol) return json({ error: 'no symbol' }, 0)

  const cache = caches.default
  const cacheKey = new Request(url.toString())
  const hit = await cache.match(cacheKey)
  if (hit) return hit

  const [s, chart] = await Promise.all([
    fetchSummary(symbol),
    fetchChart(symbol, '5y', '1mo')
  ])

  const sd = s?.summaryDetail || {}
  const ce = s?.calendarEvents || {}
  const pr = s?.price || {}

  // chiusure mensili per stimare il rendimento % di ogni dividendo storico (importo / prezzo del periodo)
  const ts = chart?.timestamp || []
  const closes = chart?.indicators?.quote?.[0]?.close || []
  const closeAt = (t) => {
    if (!ts.length) return null
    let best = null
    let bestDiff = Infinity
    for (let i = 0; i < ts.length; i++) {
      if (closes[i] == null) continue
      const diff = Math.abs(ts[i] - t)
      if (diff < bestDiff) {
        bestDiff = diff
        best = closes[i]
      }
    }
    return best
  }

  const divEvents = chart?.events?.dividends ? Object.values(chart.events.dividends) : []
  const history = divEvents
    .map((d) => {
      const px = closeAt(d.date)
      return {
        date: d.date,
        amount: d.amount,
        yieldPct: px ? (d.amount / px) * 100 : null // % che quel singolo dividendo valeva sul prezzo
      }
    })
    .sort((a, b) => a.date - b.date)

  const result = {
    symbol,
    name: pr.longName || pr.shortName || symbol,
    price: pr.regularMarketPrice?.raw ?? null,
    currency: pr.currency || sd.currency || 'EUR',
    yield: sd.dividendYield?.raw ?? null, // forward, decimale
    dividendRate: sd.dividendRate?.raw ?? null,
    exDate: sd.exDividendDate?.raw ?? null, // ex-date annunciata (epoch sec)
    payoutRatio: sd.payoutRatio?.raw ?? null,
    fiveYearAvgYield: sd.fiveYearAvgDividendYield?.raw ?? null, // numero in % (es 6.16)
    high52: sd.fiftyTwoWeekHigh?.raw ?? null,
    low52: sd.fiftyTwoWeekLow?.raw ?? null,
    paymentDate: ce?.dividendDate?.raw ?? null,
    history
  }

  const res = json(result, 3600) // dati dividendo cambiano di rado: 1h
  context.waitUntil(cache.put(cacheKey, res.clone()))
  return res
}
