import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import universe from '../data/universe.json'
import { api } from '../lib/api.js'
import { load, save } from '../lib/storage.js'

const Ctx = createContext(null)

// arrotonda agli euro-centesimi: evita code di decimali da virgola mobile (es. 206,872586…)
const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100

export function Store({ children }) {
  const [quotes, setQuotes] = useState({}) // symbol -> quote
  const [spark, setSpark] = useState({}) // symbol -> [close...] per sparkline
  const [divinfo, setDivinfo] = useState({}) // symbol -> dati dividendo forward (ex-date annunciata, payout...)
  const [summaries, setSummaries] = useState({}) // symbol -> dettaglio completo
  const [loading, setLoading] = useState(true)
  const [divProgress, setDivProgress] = useState(0) // 0..1 caricamento ex-date in background
  const [error, setError] = useState(null)

  const [watch, setWatch] = useState(() => load('dv_watch', []))
  const [notes, setNotes] = useState(() => load('dv_notes', {}))
  // symbol -> { price: costo di 1 azione all'acquisto, invested: € totali, since: epoch spunta }
  const [portfolio, setPortfolio] = useState(() => {
    const p = load('dv_portfolio', {})
    for (const k of Object.keys(p)) {
      // migrazione vecchio formato { price, qty } -> { price, invested }
      if (p[k]?.qty != null && p[k].invested == null) {
        p[k] = { price: p[k].price, invested: p[k].price != null ? p[k].price * p[k].qty : null }
      }
      // holding salvati prima del campo "since": i dividendi contano da oggi
      if (p[k] && p[k].since == null) p[k].since = Math.floor(Date.now() / 1000)
    }
    return p
  })
  const [index, setIndex] = useState({ changePct: null, spark: null }) // FTSE MIB, per confronto col mercato
  // capital = SOLO il capitale immesso a mano dall'utente (resta fisso, non lo tocca la vendita).
  // realized = plus/minusvalenze già realizzate con le vendite.
  // realizedDiv = dividendi netti dei titoli ormai venduti (così restano contati dopo la vendita).
  // Il "capitale totale" mostrato = capital + realized + realizedDiv + dividendi dei titoli aperti.
  const [capital, setCapitalState] = useState(() => load('dv_capital', 0))
  const [realized, setRealized] = useState(() => load('dv_realized', 0))
  const [realizedDiv, setRealizedDiv] = useState(() => load('dv_realized_div', 0))

  // Migrazione v0->v1: prima la vendita sommava il guadagno realizzato anche al capitale
  // immesso (corrompendolo). Lo scorporiamo una volta sola così il campo torna corretto.
  useEffect(() => {
    if (load('dv_capital_v', 0) < 1) {
      setCapitalState((c) => round2(Math.max(0, (c || 0) - (load('dv_realized', 0) || 0))))
      save('dv_capital_v', 1)
    }
  }, [])

  const refresh = useCallback(async (fresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const list = universe.map((u) => u.symbol)
      const data = await api.quotes(list, fresh)
      const map = {}
      for (const q of data) map[q.symbol] = q
      setQuotes(map)
    } catch (e) {
      setError(e.message || 'errore caricamento')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Carica in background le ex-date forward (+ payout, yield medio) di TUTTI i titoli.
  // Blocchi di 20: ogni simbolo fa 2 subrequest lato server (quoteSummary + chart per
  // validare la ex-date), quindi 20 simboli = ~40 subrequest (limite Workers).
  // Senza questo, ex-date/calendario sbagliati.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const all = universe.map((u) => u.symbol)
      const chunk = 20
      for (let i = 0; i < all.length && alive; i += chunk) {
        const part = all.slice(i, i + chunk)
        try {
          const map = await api.divinfo(part)
          if (!alive) return
          setDivinfo((p) => ({ ...p, ...map }))
        } catch {
          /* salta il blocco fallito */
        }
        setDivProgress(Math.min(1, (i + chunk) / all.length))
      }
      if (alive) setDivProgress(1)
    })()
    return () => {
      alive = false
    }
  }, [])

  // Dati indice FTSE MIB (variazione oggi + serie 1 mese) per il confronto "vs mercato".
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [q, sp] = await Promise.all([api.quotes(['FTSEMIB.MI']), api.spark(['FTSEMIB.MI'])])
        if (!alive) return
        setIndex({ ...(q?.[0] || {}), spark: sp?.['FTSEMIB.MI'] ?? null })
      } catch {
        /* ignora */
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // Carica in background le mini-serie prezzi (sparkline) di tutti i titoli,
  // a blocchi di 40 (una chart per simbolo lato server: limite subrequest Workers).
  useEffect(() => {
    let alive = true
    ;(async () => {
      const all = universe.map((u) => u.symbol)
      const chunk = 40
      for (let i = 0; i < all.length && alive; i += chunk) {
        try {
          const map = await api.spark(all.slice(i, i + chunk))
          if (!alive) return
          setSpark((p) => ({ ...p, ...map }))
        } catch {
          /* salta */
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => save('dv_watch', watch), [watch])
  useEffect(() => save('dv_notes', notes), [notes])
  useEffect(() => save('dv_portfolio', portfolio), [portfolio])
  useEffect(() => save('dv_capital', capital), [capital])
  useEffect(() => save('dv_realized', realized), [realized])
  useEffect(() => save('dv_realized_div', realizedDiv), [realizedDiv])

  const loadSummary = useCallback(
    async (symbol) => {
      if (summaries[symbol]) return summaries[symbol]
      try {
        const s = await api.summary(symbol)
        setSummaries((p) => ({ ...p, [symbol]: s }))
        return s
      } catch {
        return null
      }
    },
    [summaries]
  )

  const toggleWatch = useCallback(
    (sym) => setWatch((w) => (w.includes(sym) ? w.filter((x) => x !== sym) : [...w, sym])),
    []
  )
  const isWatched = useCallback((sym) => watch.includes(sym), [watch])
  const setNote = useCallback((sym, txt) => setNotes((n) => ({ ...n, [sym]: txt })), [])

  // Acquisti: dati della posizione per i "titoli comprati". Alla prima spunta
  // registriamo "since": da lì contiamo gli stacchi dividendo del titolo.
  const setHolding = useCallback(
    (sym, data) =>
      setPortfolio((p) => ({
        ...p,
        [sym]: { since: Math.floor(Date.now() / 1000), ...p[sym], ...data }
      })),
    []
  )
  const removeHolding = useCallback(
    (sym) =>
      setPortfolio((p) => {
        const next = { ...p }
        delete next[sym]
        return next
      }),
    []
  )

  const setCapital = useCallback((v) => setCapitalState(v != null && v >= 0 ? round2(v) : 0), [])

  // Vendita di una posizione: registra il guadagno realizzato (gain = valore attuale - investito)
  // e blocca i dividendi netti maturati (che non saranno più calcolabili dai titoli aperti).
  // NON tocca il capitale immesso: il "capitale totale" li somma comunque in fase di calcolo.
  const sellHolding = useCallback((sym, { gain = 0, dividends = 0 } = {}) => {
    setRealized((r) => round2((r || 0) + gain))
    setRealizedDiv((d) => round2((d || 0) + dividends))
    removeHolding(sym)
  }, [removeHolding])

  // righe = universo + quote + divinfo + summary. Campi dividendo presi dalla fonte migliore
  // disponibile: summary (dettaglio) > divinfo (blocco, ex-date forward) > quote (trailing).
  const rows = useMemo(
    () =>
      universe.map((u) => {
        const q = quotes[u.symbol] || { symbol: u.symbol, name: u.name, missing: true }
        const d = divinfo[u.symbol] || {}
        const s = summaries[u.symbol] || null
        return {
          ...u,
          ...q,
          yield: s?.yield ?? d.yield ?? q.yield ?? null,
          dividendRate: s?.dividendRate ?? d.dividendRate ?? q.dividendRate ?? null, // € per azione/anno
          nextDividend: s?.nextDividend ?? d.nextDividend ?? null, // € del prossimo singolo stacco (stima)
          exDate: s?.exDate ?? d.exDate ?? null, // solo forward (no campo trailing inaffidabile)
          payoutRatio: s?.payoutRatio ?? d.payoutRatio ?? null,
          fiveYearAvgYield: s?.fiveYearAvgYield ?? d.fiveYearAvgYield ?? null,
          paymentDate: s?.paymentDate ?? d.paymentDate ?? null,
          spark: spark[u.symbol] || null,
          summary: s
        }
      }),
    [quotes, divinfo, summaries, spark]
  )

  const value = {
    rows,
    quotes,
    summaries,
    index,
    loading,
    divProgress,
    error,
    refresh,
    loadSummary,
    watch,
    toggleWatch,
    isWatched,
    notes,
    setNote,
    portfolio,
    setHolding,
    removeHolding,
    capital,
    realized,
    realizedDiv,
    setCapital,
    sellHolding
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)
