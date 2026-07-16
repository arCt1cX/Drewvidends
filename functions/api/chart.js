import { fetchHistory, json } from '../lib/yahoo.js'

// GET /api/chart?symbol=ENI.MI&range=6mo
// Storico prezzi per il grafico nel dettaglio. range: 1mo|3mo|6mo|1y|5y
export async function onRequestGet(context) {
  const url = new URL(context.request.url)
  const symbol = (url.searchParams.get('symbol') || '').trim()
  const range = url.searchParams.get('range') || '6mo'
  if (!symbol) return json({ error: 'no symbol' }, 0)

  // intervallo adatto al periodo (intraday per giorno/settimana)
  const INTERVAL = {
    '1d': '5m',
    '5d': '30m',
    '1mo': '1d',
    '3mo': '1d',
    '6mo': '1d',
    '1y': '1d',
    '5y': '1wk'
  }
  const interval = INTERVAL[range] || '1d'

  const cache = caches.default
  const cacheKey = new Request(url.toString())
  const hit = await cache.match(cacheKey)
  if (hit) return hit

  const data = await fetchHistory(symbol, range, interval)
  if (!data) return json({ points: [] }, 0) // Yahoo giù: non cacheare il grafico vuoto

  const res = json(data, 1800) // 30 min
  context.waitUntil(cache.put(cacheKey, res.clone()))
  return res
}
