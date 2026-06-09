import { fmtPct, fmtMoney, fmtPctNum, netYield, belowAvg, daysUntil, fmtDays } from '../lib/format.js'
import { useStore } from '../state/store.jsx'
import Icon from './Icon.jsx'
import Sparkline from './Sparkline.jsx'

export default function StockCard({ row, onOpen }) {
  const { isWatched, toggleWatch } = useStore()
  const watched = isWatched(row.symbol)

  const yieldDec = row.yield ?? null
  const days = row.exDate ? daysUntil(row.exDate) : null
  const gap200 = belowAvg(row.price, row.ma200)
  const change = row.changePct
  const up = change >= 0
  const ticker = row.symbol.replace('.MI', '')
  const below = gap200 != null && gap200 <= -0.03

  return (
    <div
      onClick={() => onOpen(row.symbol)}
      className="bg-surface rounded-2xl border border-line p-4 active:bg-surface2 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[15px] font-bold tracking-tight truncate">{row.name}</div>
          <div className="text-[11.5px] font-semibold text-muted tracking-wide">{ticker}</div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleWatch(row.symbol)
          }}
          className={`shrink-0 -mt-0.5 ${watched ? 'text-accent' : 'text-muted'}`}
          aria-label="watchlist"
        >
          <Icon name={watched ? 'starFill' : 'star'} size={19} />
        </button>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <div className="text-3xl font-extrabold text-accent leading-[0.95] tracking-tightish">
            {yieldDec != null ? fmtPct(yieldDec, 2) : 'n/d'}
          </div>
          <div className="mt-1.5 text-[10px] uppercase tracking-wider text-muted">
            lordo · <span className="text-ink">{fmtPct(netYield(yieldDec), 2)}</span> netto
          </div>
        </div>
        <div className="text-right">
          <div className="text-[15px] font-bold">{fmtMoney(row.price, row.currency)}</div>
          {change != null && (
            <div
              className={`flex items-center justify-end gap-1 mt-0.5 text-xs font-bold ${
                up ? 'text-pos' : 'text-danger'
              }`}
            >
              <Icon name={up ? 'triUp' : 'triDn'} size={12} />
              {fmtPctNum(Math.abs(change), 2)}
            </div>
          )}
          {row.spark && (
            <div className={`mt-1.5 flex justify-end ${up ? 'text-pos' : 'text-danger'}`}>
              <Sparkline data={row.spark} w={72} h={22} />
            </div>
          )}
        </div>
      </div>

      {(below || (days != null && days >= 0 && days <= 200) || row.missing) && (
        <div className="mt-3 pt-3 border-t border-line flex items-center gap-4 text-[11.5px] font-semibold">
          {below && (
            <div className="flex items-center gap-1.5 text-accent">
              <span className="w-[5px] h-[5px] rounded-full bg-accent" />
              {fmtPctNum(gap200 * 100, 0)} sotto media
            </div>
          )}
          {days != null && days >= 0 && days <= 200 && (
            <div className={`flex items-center gap-1.5 ${days <= 10 ? 'text-warn' : 'text-muted'}`}>
              <Icon name="clock" size={13} strokeWidth={1.7} />
              ex {fmtDays(days)}
            </div>
          )}
          {row.missing && <div className="text-muted">dati n/d</div>}
        </div>
      )}
    </div>
  )
}
