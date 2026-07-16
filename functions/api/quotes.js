import { fetchQuotes, quoteFromChart, json } from '../lib/yahoo.js'

// GET /api/quotes?symbols=ENI.MI,ISP.MI,...
// Batch quote per la lista: prezzo, medie 50/200gg, 52 sett, yield trailing, market cap.
export async function onRequestGet(context) {
  const url = new URL(context.request.url)
  const symbols = (url.searchParams.get('symbols') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!symbols.length) return json({ error: 'no symbols' }, 0)

  const cache = caches.default
  const cacheKey = new Request(url.toString())
  const hit = await cache.match(cacheKey)
  if (hit) return hit

  const raw = await fetchQuotes(symbols)

  // v7/quote (richiede crumb) bloccato da Yahoo per gli IP Cloudflare: ricostruisce
  // le quote dalla chart v8 (senza crumb, affidabile). Cache breve: dati di ripiego.
  if (!Object.keys(raw).length) {
    const fb = await Promise.all(symbols.map((sym) => quoteFromChart(sym)))
    const result = symbols.map((sym, i) => fb[i] || { symbol: sym, missing: true })
    if (result.every((r) => r.missing)) return json(result, 0) // Yahoo del tutto giù: niente cache
    const res = json(result, 300)
    context.waitUntil(cache.put(cacheKey, res.clone()))
    return res
  }

  const result = symbols.map((sym) => mapQuote(sym, raw[sym]))
  const res = json(result, 600) // fresco 10 min
  context.waitUntil(cache.put(cacheKey, res.clone()))
  return res
}

function mapQuote(sym, q) {
  if (!q) return { symbol: sym, missing: true }
  return {
    symbol: sym,
    name: q.longName || q.shortName || sym,
    price: q.regularMarketPrice ?? null,
    currency: q.currency || 'EUR',
    changePct: q.regularMarketChangePercent ?? null,
    ma50: q.fiftyDayAverage ?? null,
    ma200: q.twoHundredDayAverage ?? null,
    high52: q.fiftyTwoWeekHigh ?? null,
    low52: q.fiftyTwoWeekLow ?? null,
    marketCap: q.marketCap ?? null,
    yield: q.trailingAnnualDividendYield ?? null, // decimale (0.045 = 4.5%)
    dividendRate: q.trailingAnnualDividendRate ?? null,
    exDate: q.dividendDate ?? null // epoch (sec) - indicativo, raffinato da /api/summary
  }
}
