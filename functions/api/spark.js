import { fetchSpark, json } from '../lib/yahoo.js'

// GET /api/spark?symbols=A.MI,B.MI,...  -> { symbol: [close, close, ...] }
// Mini-serie prezzi (~1 mese) per le sparkline delle card. Batch: economico.
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

  const out = await fetchSpark(symbols)
  const res = json(out, 1800) // 30 min
  context.waitUntil(cache.put(cacheKey, res.clone()))
  return res
}
