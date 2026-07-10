// Client per le Pages Functions (/api/*). Le Functions parlano con Yahoo lato server.

async function getJson(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error('HTTP ' + r.status)
  return r.json()
}

export const api = {
  // fresh=true aggiunge un timestamp -> URL diverso -> salta cache edge + service worker
  quotes: (symbols, fresh = false) =>
    getJson(
      '/api/quotes?symbols=' +
        encodeURIComponent(symbols.join(',')) +
        (fresh ? '&t=' + Date.now() : '')
    ),
  divinfo: (symbols) =>
    getJson('/api/divinfo?symbols=' + encodeURIComponent(symbols.join(','))),
  spark: (symbols) =>
    getJson('/api/spark?symbols=' + encodeURIComponent(symbols.join(','))),
  market: () => getJson('/api/market'),
  summary: (symbol) => getJson('/api/summary?symbol=' + encodeURIComponent(symbol)),
  chart: (symbol, range) =>
    getJson('/api/chart?symbol=' + encodeURIComponent(symbol) + '&range=' + encodeURIComponent(range)),
  news: (symbol) => getJson('/api/news?symbol=' + encodeURIComponent(symbol))
}
