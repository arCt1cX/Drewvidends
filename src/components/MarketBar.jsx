// Barra "stato del mercato" (FTSE MIB) in cima alla Lista: livello, variazione oggi,
// fase rialzista/ribassista (prezzo vs media 200gg) e posizione nel range annuale.

import { useStore } from '../state/store.jsx'
import { fmtNum, fmtPctNum } from '../lib/format.js'
import Icon from './Icon.jsx'
import Sparkline from './Sparkline.jsx'

export default function MarketBar() {
  const { index } = useStore()
  const price = index?.price

  if (price == null) {
    return (
      <div className="bg-surface border border-line rounded-2xl px-4 py-3 mb-2 text-[11px] text-muted">
        Carico stato del mercato…
      </div>
    )
  }

  const up = (index.changePct ?? 0) >= 0
  const bull = index.ma200 != null ? price >= index.ma200 : null
  const spark = index.spark
  const monthUp = spark && spark.length > 1 ? spark[spark.length - 1] >= spark[0] : up

  // posizione nel range 52 settimane
  let posText = null
  if (index.high52 && index.low52 && index.high52 > index.low52) {
    const pos = (price - index.low52) / (index.high52 - index.low52)
    posText = pos >= 0.8 ? 'vicino ai massimi dell’anno' : pos <= 0.2 ? 'vicino ai minimi dell’anno' : 'a metà del range annuale'
  }

  return (
    <div className="bg-surface border border-line rounded-2xl px-4 py-3 mb-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted">Mercato · FTSE MIB</div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-lg font-extrabold">{fmtNum(price, 0)}</span>
            <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${up ? 'text-pos' : 'text-danger'}`}>
              <Icon name={up ? 'triUp' : 'triDn'} size={12} />
              {fmtPctNum(Math.abs(index.changePct), 2)}
            </span>
          </div>
        </div>
        {spark && (
          <div className={`shrink-0 ${monthUp ? 'text-pos' : 'text-danger'}`}>
            <Sparkline data={spark} w={92} h={28} />
          </div>
        )}
      </div>

      {bull != null && (
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-line text-[11px]">
          <span className={`inline-flex items-center gap-1.5 font-bold ${bull ? 'text-accent' : 'text-danger'}`}>
            <span className={`w-[6px] h-[6px] rounded-full ${bull ? 'bg-accent' : 'bg-danger'}`} />
            {bull ? 'Fase rialzista' : 'Fase ribassista'}
          </span>
          <span className="text-muted">
            (prezzo {bull ? 'sopra' : 'sotto'} media 200gg){posText ? ` · ${posText}` : ''}
          </span>
        </div>
      )}
    </div>
  )
}
