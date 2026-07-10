import { fetchChart, json } from '../lib/yahoo.js'

// GET /api/market  -> stato FTSE MIB per la barra in cima alla Lista.
// Usa la chart v8 (NIENTE crumb, endpoint affidabile anche da IP Cloudflare):
// v7/finance/quote è instabile per l'indice e lasciava la barra su "Carico...".
// Un'unica chiamata (range 1y) dà prezzo, variazione oggi, media 200gg, range 52 sett e sparkline.
export async function onRequestGet(context) {
  const url = new URL(context.request.url)
  const cache = caches.default
  const cacheKey = new Request(url.toString())
  const hit = await cache.match(cacheKey)
  if (hit) return hit

  let out = null
  try {
    const c = await fetchChart('FTSEMIB.MI', '1y', '1d')
    const meta = c?.meta
    const ts = c?.timestamp || []
    // tiene solo le sedute con close valido, preservando il timestamp allineato
    const pairs = ts
      .map((t, i) => ({ t, close: c?.indicators?.quote?.[0]?.close?.[i] }))
      .filter((p) => p.close != null)
    const closes = pairs.map((p) => p.close)
    if (meta && closes.length) {
      const price = meta.regularMarketPrice ?? closes[closes.length - 1]
      // Chiusura precedente per la variazione di GIORNATA. Se l'ultima barra è di
      // oggi (stesso giorno di regularMarketTime) il "precedente" è la penultima;
      // altrimenti (pre-apertura: ultima barra = ieri) è l'ultima.
      const sameDay = (a, b) =>
        new Date(a * 1000).toDateString() === new Date(b * 1000).toDateString()
      const lastIsToday =
        meta.regularMarketTime && sameDay(pairs[pairs.length - 1].t, meta.regularMarketTime)
      const prev = lastIsToday ? closes[closes.length - 2] : closes[closes.length - 1]
      const changePct = prev ? ((price - prev) / prev) * 100 : null
      const ma200 = closes.length >= 200
        ? closes.slice(-200).reduce((a, b) => a + b, 0) / 200
        : null
      out = {
        price,
        changePct,
        ma200,
        high52: meta.fiftyTwoWeekHigh ?? null,
        low52: meta.fiftyTwoWeekLow ?? null,
        spark: closes.slice(-22) // ~1 mese di sedute per la sparkline
      }
    }
  } catch {
    /* rete/Yahoo giù: torna null, la barra riproverà al refresh */
  }

  const res = json(out, 600) // fresco 10 min
  if (out) context.waitUntil(cache.put(cacheKey, res.clone()))
  return res
}
