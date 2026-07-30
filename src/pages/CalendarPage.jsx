import { useMemo, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { fmtPct, fmtMoney, fmtDate, fmtDays, daysUntil } from '../lib/format.js'
import Icon from '../components/Icon.jsx'

export default function CalendarPage({ onOpen }) {
  const { rows, isWatched, divProgress, divFailed, divChunks, reloadDivinfo } = useStore()
  const [onlyWatch, setOnlyWatch] = useState(false)

  const groups = useMemo(() => {
    const items = rows
      .map((r) => {
        const ex = r.summary?.exDate ?? r.exDate ?? null
        return ex ? { ...r, ex, days: daysUntil(ex) } : null
      })
      .filter((r) => r && r.days >= 0 && r.days <= 200) // solo da oggi in poi, ~6 mesi
      .filter((r) => (onlyWatch ? isWatched(r.symbol) : true))
      .sort((a, b) => a.days - b.days)

    const map = new Map()
    for (const r of items) {
      const d = new Date(r.ex * 1000)
      const key = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    }
    return [...map.entries()]
  }, [rows, onlyWatch, isWatched])

  return (
    <div className="px-4">
      <header className="pt-3 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Calendario stacchi</h1>
          <p className="text-[11px] text-muted">Prossime ex-date (compra prima per il dividendo).</p>
        </div>
        <button
          onClick={() => setOnlyWatch((v) => !v)}
          className={`flex items-center gap-1.5 text-xs font-semibold rounded-xl px-3 py-1.5 border ${
            onlyWatch ? 'bg-accent-dim text-accent border-transparent' : 'bg-surface text-muted border-line'
          }`}
        >
          <Icon name={onlyWatch ? 'starFill' : 'star'} size={14} /> Watchlist
        </button>
      </header>

      {/* Elenco parziale: alcuni blocchi non hanno risposto, quindi mancano dei titoli.
          Senza questo avviso la lista sembra completa e non lo è. */}
      {divProgress >= 1 && divFailed > 0 && groups.length > 0 && (
        <div className="mb-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2">
          <p className="text-[11px] text-danger font-semibold">
            Elenco incompleto: {divFailed * 20} titoli su {divChunks * 20} non caricati.
          </p>
          <button onClick={reloadDivinfo} className="mt-1 text-[11px] font-bold text-accent underline">
            Ricarica le ex-date
          </button>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="pt-6 text-center space-y-2">
          {divProgress < 1 ? (
            <p className="text-sm text-muted">Carico le ex-date… {Math.round(divProgress * 100)}%</p>
          ) : divFailed > 0 ? (
            <>
              <p className="text-sm text-danger font-semibold">
                Ex-date non caricate: {divFailed} blocchi su {divChunks} non hanno risposto.
              </p>
              <p className="text-[11px] text-muted px-6">
                Non vuol dire che non ci sono stacchi: vuol dire che i dati non sono arrivati.
              </p>
              <button
                onClick={reloadDivinfo}
                className="mt-1 text-xs font-bold rounded-xl px-4 py-2 bg-accent-dim text-accent"
              >
                Riprova
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">Nessuna ex-date annunciata nei prossimi 6 mesi.</p>
              <p className="text-[11px] text-muted px-6">
                Dati caricati correttamente su {divChunks * 20} titoli. Yahoo pubblica la data solo
                dopo l’annuncio ufficiale della società.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4 pb-safe">
          {groups.map(([month, items]) => (
            <div key={month}>
              <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5 capitalize">
                {month}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {items.map((r) => {
                  const yieldDec = r.summary?.yield ?? r.yield ?? null
                  // € per azione/anno: dividendo annuo ufficiale (Yahoo), altrimenti stima rendimento × prezzo
                  const perShare =
                    r.dividendRate ?? (yieldDec != null && r.price != null ? yieldDec * r.price : null)
                  return (
                    <div
                      key={r.symbol}
                      onClick={() => onOpen(r.symbol)}
                      className="bg-surface rounded-xl border border-line p-3 flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm font-semibold truncate">
                          {isWatched(r.symbol) && <Icon name="starFill" size={13} className="text-accent shrink-0" />}
                          <span className="truncate">{r.name}</span>
                        </div>
                        <div className="text-[11px] text-muted">ex {fmtDate(r.ex)} · {fmtDays(r.days)}</div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="text-accent font-bold text-sm">{fmtPct(yieldDec, 1)}</div>
                        {perShare != null && (
                          <div className="text-[10px] text-muted">{fmtMoney(perShare, r.currency)}/az l’anno</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
