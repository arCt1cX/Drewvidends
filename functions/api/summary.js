import { fetchSummary, fetchChart, sanitizeExDate, trailingRate, json } from '../lib/yahoo.js'

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

  // Entrambe le fonti giù: 502 senza cache, il client ripiega su divinfo/quote e
  // ritenterà. Se manca solo quoteSummary (crumb spesso negato agli IP Cloudflare)
  // si prosegue: la chart v8 basta per prezzo, storico dividendi e yield trailing.
  if (!s && !chart) {
    return new Response(JSON.stringify({ error: 'yahoo unavailable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    })
  }

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

  // ripieghi dalla chart quando quoteSummary manca (o è incompleto)
  const meta = chart?.meta || {}
  const price = pr.regularMarketPrice?.raw ?? meta.regularMarketPrice ?? null
  const rate12 = trailingRate(history) // dividendi staccati negli ultimi 12 mesi

  const result = {
    symbol,
    name: pr.longName || pr.shortName || meta.longName || meta.shortName || symbol,
    price,
    currency: pr.currency || sd.currency || meta.currency || 'EUR',
    yield: sd.dividendYield?.raw ?? (price && rate12 ? rate12 / price : null), // forward, decimale (o trailing di ripiego)
    dividendRate: sd.dividendRate?.raw ?? (rate12 || null),
    exDate: sanitizeExDate(sd.exDividendDate?.raw ?? null, history), // ex-date annunciata, ripulita dalle stime fasulle
    payoutRatio: sd.payoutRatio?.raw ?? null,
    fiveYearAvgYield: sd.fiveYearAvgDividendYield?.raw ?? null, // numero in % (es 6.16)
    high52: sd.fiftyTwoWeekHigh?.raw ?? meta.fiftyTwoWeekHigh ?? null,
    low52: sd.fiftyTwoWeekLow?.raw ?? meta.fiftyTwoWeekLow ?? null,
    paymentDate: ce?.dividendDate?.raw ?? null,
    history
  }

  // senza quoteSummary il risultato è di ripiego: cache breve così si ritenta presto
  const res = json(result, s ? 3600 : 300)
  if (s) context.waitUntil(cache.put(cacheKey, res.clone()))
  return res
}
