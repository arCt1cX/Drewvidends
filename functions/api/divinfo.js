import { fetchDivInfo, json } from '../lib/yahoo.js'

// GET /api/divinfo?symbols=A.MI,B.MI,...  (max 20 per chiamata: ogni simbolo fa 2
// subrequest — quoteSummary + chart per validare la ex-date — e Workers le limita)
// Dati dividendo forward in blocco: yield, EX-DATE ANNUNCIATA, payout, yield medio 5 anni.
// Serve a popolare lista/calendario/ordinamento con ex-date corrette (non quelle passate).
export async function onRequestGet(context) {
  const url = new URL(context.request.url)
  const symbols = (url.searchParams.get('symbols') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20)
  if (!symbols.length) return json({ error: 'no symbols' }, 0)

  const cache = caches.default
  const cacheKey = new Request(url.toString())
  const hit = await cache.match(cacheKey)
  if (hit) return hit

  const results = await Promise.all(
    symbols.map(async (sym) => {
      const info = await fetchDivInfo(sym)
      return [sym, info]
    })
  )
  const out = {}
  for (const [sym, info] of results) if (info) out[sym] = info

  const res = json(out, 3600) // 1h
  context.waitUntil(cache.put(cacheKey, res.clone()))
  return res
}
