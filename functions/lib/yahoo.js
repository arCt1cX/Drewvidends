// Helper condiviso per parlare con Yahoo Finance lato server (Cloudflare Workers runtime).
// Gestisce cookie + crumb (richiesti da quote/quoteSummary/screener) e una cache leggera.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'

// Auth (cookie+crumb) cachata a livello di isolate per ~30 min.
let authCache = { cookie: '', crumb: '', ts: 0 }

async function getAuth(force = false) {
  const fresh = Date.now() - authCache.ts < 30 * 60 * 1000
  if (!force && fresh && authCache.crumb) return authCache

  // 1) prendi cookie (fc.yahoo.com risponde 404 ma setta il cookie A1/A3)
  const r = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA } })
  let cookie = ''
  const setCookies = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : null
  if (setCookies && setCookies.length) {
    cookie = setCookies.map((c) => c.split(';')[0]).join('; ')
  } else {
    const raw = r.headers.get('set-cookie') || ''
    cookie = raw.split(/,(?=\s*\w+=)/).map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ')
  }

  // 2) prendi crumb usando quel cookie
  const cr = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: cookie }
  })
  const crumb = (await cr.text()).trim()

  authCache = { cookie, crumb, ts: Date.now() }
  return authCache
}

// fetch JSON con auth; ritenta una volta rinfrescando il crumb se scade.
async function authedJson(buildUrl) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { cookie, crumb } = await getAuth(attempt === 1)
    const url = buildUrl(crumb)
    const res = await fetch(url, { headers: { 'User-Agent': UA, Cookie: cookie } })
    const txt = await res.text()
    if (res.status === 401 || /Invalid Crumb/i.test(txt)) continue
    try {
      return JSON.parse(txt)
    } catch {
      return null
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

// Mini-serie prezzi in blocco (endpoint "spark") per le sparkline delle card. 1 chiamata = molti titoli.
export async function fetchSpark(symbols, range = '1mo', interval = '1d') {
  const out = {}
  const chunkSize = 80
  for (let i = 0; i < symbols.length; i += chunkSize) {
    const chunk = symbols.slice(i, i + chunkSize)
    const data = await authedJson(
      (crumb) =>
        'https://query1.finance.yahoo.com/v7/finance/spark?symbols=' +
        encodeURIComponent(chunk.join(',')) +
        `&range=${range}&interval=${interval}&crumb=` +
        encodeURIComponent(crumb)
    )
    const arr = data?.spark?.result || []
    for (const r of arr) {
      const resp = r?.response?.[0]
      const closes = (resp?.indicators?.quote?.[0]?.close || []).filter((c) => c != null)
      if (closes.length >= 2) out[r.symbol] = closes
    }
  }
  return out
}

// quoteSummary "leggera" per dati dividendo in blocco (niente chart): usata da /api/divinfo.
export async function fetchDivInfo(symbol) {
  const data = await authedJson(
    (crumb) =>
      'https://query2.finance.yahoo.com/v10/finance/quoteSummary/' +
      encodeURIComponent(symbol) +
      '?modules=summaryDetail,calendarEvents&crumb=' +
      encodeURIComponent(crumb)
  )
  const r = data?.quoteSummary?.result?.[0]
  if (!r) return null
  const sd = r.summaryDetail || {}
  const ce = r.calendarEvents || {}
  return {
    yield: sd.dividendYield?.raw ?? null,
    exDate: sd.exDividendDate?.raw ?? ce?.dividend?.exDate?.raw ?? null,
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
