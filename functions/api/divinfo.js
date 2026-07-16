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
      try {
        const info = await fetchDivInfo(sym)
        return [sym, info]
      } catch {
        return [sym, null]
      }
    })
  )
  const out = {}
  for (const [sym, info] of results) if (info) out[sym] = info

  // fetchDivInfo ritorna null solo se la chiamata Yahoo è FALLITA (un titolo senza
  // dividendi risponde comunque, con campi null). Se manca anche un solo simbolo la
  // risposta è incompleta per colpa di Yahoo: serviamola ma NON cachearla per 1h,
  // altrimenti quei titoli restano "sconosciuti" finché la cache non scade.
  if (Object.keys(out).length < symbols.length) return json(out, 0)

  const res = json(out, 3600) // 1h
  context.waitUntil(cache.put(cacheKey, res.clone()))
  return res
}
