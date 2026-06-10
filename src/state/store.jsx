import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import universe from '../data/universe.json'
import { api } from '../lib/api.js'
import { load, save } from '../lib/storage.js'

const Ctx = createContext(null)

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
  // symbol -> { price: costo di 1 azione all'acquisto, invested: euro totali messi sul titolo }
  const [portfolio, setPortfolio] = useState(() => {
    const p = load('dv_portfolio', {})
    // migrazione vecchio formato { price, qty } -> { price, invested }
    for (const k of Object.keys(p)) {
      if (p[k]?.qty != null && p[k].invested == null) {
        p[k] = { price: p[k].price, invested: p[k].price != null ? p[k].price * p[k].qty : null }
      }
    }
    return p
  })
  const [index, setIndex] = useState({ changePct: null, spark: null }) // FTSE MIB, per confronto col mercato

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

  // Carica in background le ex-date forward (+ payout, yield medio) di TUTTI i titoli,
  // a blocchi di 40 (limite subrequest Workers). Senza questo, ex-date/calendario sbagliati.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const all = universe.map((u) => u.symbol)
      const chunk = 40
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

  // Acquisti: prezzo di carico + quantità per i "titoli comprati".
  const setHolding = useCallback(
    (sym, data) => setPortfolio((p) => ({ ...p, [sym]: { ...p[sym], ...data } })),
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
    removeHolding
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)
