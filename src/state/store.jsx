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

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = universe.map((u) => u.symbol)
      const data = await api.quotes(list)
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

  // Carica in background le mini-serie prezzi (sparkline) di tutti i titoli, a blocchi.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const all = universe.map((u) => u.symbol)
      const chunk = 80
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
    loading,
    divProgress,
    error,
    refresh,
    loadSummary,
    watch,
    toggleWatch,
    isWatched,
    notes,
    setNote
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)
