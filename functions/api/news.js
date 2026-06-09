import { fetchNewsRss, json } from '../lib/yahoo.js'

// GET /api/news?symbol=ENI.MI
// News VERE del titolo (feed RSS per-simbolo). Il filtro "solo importante" lo fa il client.
export async function onRequestGet(context) {
  const url = new URL(context.request.url)
  const symbol = (url.searchParams.get('symbol') || '').trim()
  if (!symbol) return json({ error: 'no symbol' }, 0)

  const cache = caches.default
  const cacheKey = new Request(url.toString())
  const hit = await cache.match(cacheKey)
  if (hit) return hit

  const news = await fetchNewsRss(symbol)
  const res = json({ symbol, news }, 1800) // 30 min
  context.waitUntil(cache.put(cacheKey, res.clone()))
  return res
}
