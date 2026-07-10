// Helper condiviso per parlare con Yahoo Finance lato server (Cloudflare Workers runtime).
// Gestisce cookie + crumb (richiesti da quote/quoteSummary/screener) e una cache leggera.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'

// Auth (cookie+crumb) cachata a livello di isolate per ~30 min.
let authCache = { cookie: '', crumb: '', ts: 0 }
// Mutex: con Promise.all su 40 simboli, 40 getAuth partono insieme -> senza lock
// martellerebbero fc.yahoo.com/getcrumb (subrequest inutili). Un solo giro alla volta.
let authInFlight = null

// Estrae "k=v; k2=v2" dai Set-Cookie di una response.
function extractCookie(r) {
  const setCookies = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : null
  if (setCookies && setCookies.length) {
    return setCookies.map((c) => c.split(';')[0]).join('; ')
  }
  const raw = r.headers.get('set-cookie') || ''
  return raw.split(/,(?=\s*\w+=)/).map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ')
}

async function doAuth() {
  // 1) cookie A1/A3. fc.yahoo.com è morto -> fallback su finance.yahoo.com. Mai lanciare.
  let cookie = ''
  for (const host of ['https://fc.yahoo.com', 'https://finance.yahoo.com']) {
    try {
      const r = await fetch(host, { headers: { 'User-Agent': UA }, redirect: 'follow' })
      cookie = extractCookie(r)
      if (cookie) break
    } catch { /* host irraggiungibile: prova il prossimo */ }
  }

  // 2) crumb con quel cookie
  let crumb = ''
  try {
    const cr = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, Cookie: cookie }
    })
    const txt = (await cr.text()).trim()
    // un crumb valido è una stringa corta senza spazi/HTML
    if (txt && txt.length < 40 && !/[<>\s]/.test(txt)) crumb = txt
  } catch { /* niente crumb: authedJson ritenterà */ }

  authCache = { cookie, crumb, ts: Date.now() }
  return authCache
}

async function getAuth(force = false) {
  const fresh = Date.now() - authCache.ts < 30 * 60 * 1000
  if (!force && fresh && authCache.crumb) return authCache
  if (authInFlight) return authInFlight
  authInFlight = doAuth().finally(() => { authInFlight = null })
  return authInFlight
}

// fetch JSON con auth; ritenta una volta rinfrescando il crumb se scade.
async function authedJson(buildUrl) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { cookie, crumb } = await getAuth(attempt === 1)
      const url = buildUrl(crumb)
      const res = await fetch(url, { headers: { 'User-Agent': UA, Cookie: cookie } })
      const txt = await res.text()
      if (res.status === 401 || res.status === 403 || /Invalid Crumb|Unauthorized/i.test(txt)) continue
      return JSON.parse(txt)
    } catch {
      // errore rete / JSON malformato: ritenta una volta rinfrescando l'auth
    }
  }
  return null
}

// Batch quote (v7): molti simboli in una chiamata. Ritorna mappa symbol -> dati grezzi.
export async function fetchQuotes(symbols) {
  const out = {}
  const chunkSize = 50
  for (let i = 0; i < symbols.length; i += chunkSize) {
    const chunk = symbols.slice(i, i + chunkSize)
    const data = await authedJson(
      (crumb) =>
        'https://query1.finance.yahoo.com/v7/finance/quote?symbols=' +
        encodeURIComponent(chunk.join(',')) +
        '&crumb=' +
        encodeURIComponent(crumb)
    )
    const arr = data?.quoteResponse?.result || []
    for (const q of arr) out[q.symbol] = q
  }
  return out
}

// quoteSummary (v10): dettaglio dividendi di un singolo titolo (yield, ex-date annunciata, payout...).
export async function fetchSummary(symbol) {
  const modules = 'summaryDetail,calendarEvents,defaultKeyStatistics,price'
  const data = await authedJson(
    (crumb) =>
      'https://query2.finance.yahoo.com/v10/finance/quoteSummary/' +
      encodeURIComponent(symbol) +
      '?modules=' +
      modules +
      '&crumb=' +
      encodeURIComponent(crumb)
  )
  return data?.quoteSummary?.result?.[0] || null
}

// chart (v8): storico prezzi + storico dividendi. Non richiede crumb.
export async function fetchChart(symbol, range = '1y', interval = '1d') {
  const url =
    'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(symbol) +
    `?range=${range}&interval=${interval}&events=div`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) return null
  const data = await res.json()
  return data?.chart?.result?.[0] || null
}

// search (v1): news + corrispondenze. Usato per le notizie della watchlist.
export async function fetchNews(symbol, count = 10) {
  const url =
    'https://query1.finance.yahoo.com/v1/finance/search?q=' +
    encodeURIComponent(symbol) +
    `&newsCount=${count}&quotesCount=0&enableFuzzyQuery=false`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) return []
  const data = await res.json()
  return data?.news || []
}

// Mini-serie prezzi per le sparkline delle card. Yahoo ha dismesso l'endpoint batch
// v7 "spark", quindi usiamo il chart v8 (lo stesso del grafico prezzi, niente crumb)
// un simbolo alla volta, in parallelo. Max ~40 simboli per chiamata (limite subrequest).
export async function fetchSpark(symbols, range = '1mo', interval = '1d') {
  const results = await Promise.all(
    symbols.map(async (sym) => {
      try {
        const c = await fetchChart(sym, range, interval)
        const closes = (c?.indicators?.quote?.[0]?.close || []).filter((v) => v != null)
        return [sym, closes.length >= 2 ? closes : null]
      } catch {
        return [sym, null]
      }
    })
  )
  const out = {}
  for (const [sym, closes] of results) if (closes) out[sym] = closes
  return out
}

// Scarta una ex-date "forward" implausibile.
// Dopo lo stacco Yahoo a volte rimette in exDividendDate una STIMA ingenua
// (ultimo stacco + ~1 mese): sbagliata per chi paga ogni 6/12 mesi. Es. Poste
// Italiane (stacco saldo a giugno, acconto a novembre) finiva col mostrare una
// finta cedola "a luglio". Con lo storico verifichiamo che la prossima ex-date
// cada DOPO l'ultimo stacco e ad almeno ~metà dell'intervallo tipico tra cedole.
// history: array di { date } (epoch sec) degli stacchi passati. Senza dati
// sufficienti per giudicare, ci si fida del valore Yahoo.
export function sanitizeExDate(exDate, history) {
  if (!exDate) return null
  const dates = (Array.isArray(history) ? history : [])
    .map((h) => h?.date)
    .filter((d) => d != null)
    .sort((a, b) => a - b)
  if (dates.length < 2) return exDate
  const last = dates[dates.length - 1]
  if (exDate <= last) return null // una "prossima" deve cadere dopo l'ultimo stacco noto
  const gaps = []
  for (let i = 1; i < dates.length; i++) gaps.push(dates[i] - dates[i - 1])
  gaps.sort((a, b) => a - b)
  const median = gaps[Math.floor(gaps.length / 2)]
  if (exDate - last < median * 0.5) return null // troppo vicino: stima fasulla "+1 mese"
  return exDate
}

// quoteSummary per dati dividendo in blocco: usata da /api/divinfo. Affianca una
// chart leggera (solo eventi dividendo) per validare la ex-date forward con lo storico.
export async function fetchDivInfo(symbol) {
  const [data, chart] = await Promise.all([
    authedJson(
      (crumb) =>
        'https://query2.finance.yahoo.com/v10/finance/quoteSummary/' +
        encodeURIComponent(symbol) +
        '?modules=summaryDetail,calendarEvents&crumb=' +
        encodeURIComponent(crumb)
    ),
    fetchChart(symbol, '3y', '1mo')
  ])
  const r = data?.quoteSummary?.result?.[0]
  if (!r) return null
  const sd = r.summaryDetail || {}
  const ce = r.calendarEvents || {}
  const history = (chart?.events?.dividends ? Object.values(chart.events.dividends) : [])
    .map((d) => ({ date: d.date }))
    .sort((a, b) => a.date - b.date)
  const rawEx = sd.exDividendDate?.raw ?? ce?.dividend?.exDate?.raw ?? null
  return {
    yield: sd.dividendYield?.raw ?? null,
    dividendRate: sd.dividendRate?.raw ?? null, // dividendo annuo per azione (forward, in valuta)
    exDate: sanitizeExDate(rawEx, history),
    payoutRatio: sd.payoutRatio?.raw ?? null,
    fiveYearAvgYield: sd.fiveYearAvgDividendYield?.raw ?? null,
    paymentDate: ce?.dividendDate?.raw ?? null
  }
}

// Storico prezzi per il grafico (timestamp + chiusure).
export async function fetchHistory(symbol, range = '6mo', interval = '1d') {
  const c = await fetchChart(symbol, range, interval)
  if (!c) return null
  const ts = c.timestamp || []
  const close = c.indicators?.quote?.[0]?.close || []
  const points = ts
    .map((t, i) => ({ t, c: close[i] }))
    .filter((p) => p.c != null)
  return {
    points,
    name: c.meta?.longName || c.meta?.shortName || symbol,
    currency: c.meta?.currency || 'EUR'
  }
}

// News VERE del titolo via feed RSS per-simbolo di Yahoo (la search dava news generiche).
export async function fetchNewsRss(symbol) {
  const url =
    'https://feeds.finance.yahoo.com/rss/2.0/headline?s=' +
    encodeURIComponent(symbol) +
    '&region=IT&lang=it-IT'
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) return []
  const xml = await res.text()
  const items = []
  const re = /<item>([\s\S]*?)<\/item>/g
  let m
  while ((m = re.exec(xml)) && items.length < 15) {
    const block = m[1]
    const pick = (tag) => {
      const mm = new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>').exec(block)
      return mm ? mm[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : ''
    }
    const title = pick('title')
    if (!title) continue
    const pub = pick('pubDate')
    items.push({
      title,
      link: pick('link'),
      time: pub ? Math.floor(new Date(pub).getTime() / 1000) : null,
      publisher: 'Yahoo Finance'
    })
  }
  return items
}

// Wrapper risposta JSON con cache HTTP (Cloudflare Cache rispetta Cache-Control).
export function json(data, maxAge = 600) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${maxAge}`
    }
  })
}
