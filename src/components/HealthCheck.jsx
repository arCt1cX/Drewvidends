// "Salute del titolo": automatizza la checklist rumore-vs-problema-strutturale.
// Tutti i dati arrivano da ciò che l'app già scarica (spark titolo+indice, storico div, payout, yield, news).

import Icon from './Icon.jsx'
import { fmtPctNum } from '../lib/format.js'

const pctChange = (arr) => {
  if (!arr || arr.length < 2) return null
  const a = arr[0]
  const b = arr[arr.length - 1]
  if (!a) return null
  return ((b - a) / a) * 100
}

// trailing 12 mesi vs i 12 mesi precedenti (dividendo cresce / stabile / tagliato)
function dividendTrend(history) {
  if (!history || history.length < 2) return null
  const now = Date.now() / 1000
  const y = 365 * 86400
  let recent = 0
  let prior = 0
  for (const h of history) {
    if (h.date > now - y) recent += h.amount
    else if (h.date > now - 2 * y) prior += h.amount
  }
  if (prior === 0) return null
  const diff = (recent - prior) / prior
  return { recent, prior, diff }
}

export default function HealthCheck({ row, index, importantNews = [] }) {
  const checks = []

  // 1) vs mercato (FTSE MIB) su ~1 mese
  const sp = pctChange(row.spark)
  const ip = pctChange(index?.spark)
  if (sp != null && ip != null) {
    const rel = sp - ip
    if (rel >= -3)
      checks.push({
        level: 'good',
        title: 'In linea col mercato',
        text: `Ultimo mese ${fmtPctNum(sp, 1)} vs FTSE MIB ${fmtPctNum(ip, 1)}: il calo è più di mercato che del titolo.`
      })
    else if (rel > -8)
      checks.push({
        level: 'warn',
        title: 'Un po’ peggio del mercato',
        text: `Sotto il FTSE MIB di ${fmtPctNum(Math.abs(rel), 1)} nell’ultimo mese: controlla se c’è un motivo.`
      })
    else
      checks.push({
        level: 'bad',
        title: 'Molto peggio del mercato',
        text: `Sotto il FTSE MIB di ${fmtPctNum(Math.abs(rel), 1)} nell’ultimo mese: spesso è un problema specifico del titolo.`
      })
  } else {
    checks.push({ level: 'wait', title: 'Confronto col mercato', text: 'Dati in caricamento…' })
  }

  // 2) trend dividendo
  const dt = dividendTrend(row.summary?.history)
  if (dt) {
    if (dt.diff >= 0.02)
      checks.push({ level: 'good', title: 'Dividendo in crescita', text: 'Distribuzione in aumento sull’ultimo anno: segnale di solidità.' })
    else if (dt.diff <= -0.05)
      checks.push({ level: 'bad', title: 'Dividendo in calo', text: 'Ha distribuito meno dell’anno prima: possibile problema strutturale.' })
    else checks.push({ level: 'good', title: 'Dividendo stabile', text: 'Distribuzione costante anno su anno.' })
  } else {
    checks.push({ level: 'wait', title: 'Trend dividendo', text: 'Storico insufficiente.' })
  }

  // 3) payout
  const p = row.payoutRatio
  if (p != null) {
    if (p > 1)
      checks.push({ level: 'bad', title: 'Payout oltre 100%', text: `Distribuisce ${fmtPctNum(p * 100, 0)} degli utili: dividendo poco sostenibile.` })
    else if (p > 0.8)
      checks.push({ level: 'warn', title: 'Payout alto', text: `${fmtPctNum(p * 100, 0)} degli utili: margine ridotto, tieni d’occhio.` })
    else checks.push({ level: 'good', title: 'Payout sostenibile', text: `${fmtPctNum(p * 100, 0)} degli utili: dividendo con margine.` })
  } else {
    checks.push({ level: 'wait', title: 'Payout', text: 'Dato non disponibile.' })
  }

  // 4) yield vs media 5 anni
  const cur = row.yield != null ? row.yield * 100 : null
  const five = row.fiveYearAvgYield
  if (cur != null && five) {
    if (cur > five * 1.3)
      checks.push({
        level: 'warn',
        title: 'Yield anomalo',
        text: `${fmtPctNum(cur, 1)} contro media storica ${fmtPctNum(five, 1)}: spesso il mercato sta scontando un taglio.`
      })
    else checks.push({ level: 'good', title: 'Yield nella norma', text: `${fmtPctNum(cur, 1)} in linea con la media storica ${fmtPctNum(five, 1)}.` })
  } else {
    checks.push({ level: 'wait', title: 'Yield vs storico', text: 'Dato non disponibile.' })
  }

  // 5) news rilevanti
  if (importantNews.length > 0)
    checks.push({ level: 'warn', title: 'Notizie rilevanti', text: `${importantNews.length} news importanti recenti: leggile prima di decidere (potrebbero spiegare il calo).` })
  else checks.push({ level: 'good', title: 'Nessuna notizia critica', text: 'Nessuna news rilevante recente trovata.' })

  // verdetto complessivo
  const hasBad = checks.some((c) => c.level === 'bad')
  const hasWarn = checks.some((c) => c.level === 'warn')
  const verdict = hasBad
    ? { level: 'bad', text: 'Segnali di rischio specifico: approfondisci bene prima di comprare.' }
    : hasWarn
    ? { level: 'warn', text: 'Quadro misto: controlla i punti in giallo prima di decidere.' }
    : { level: 'good', text: 'Quadro sano: nessun segnale di problema strutturale.' }

  return (
    <div>
      <div className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2.5">
        Salute del titolo
      </div>

      <div className={`rounded-2xl p-3.5 mb-2.5 flex items-start gap-2.5 ${BANNER[verdict.level]}`}>
        <Icon name={verdict.level === 'good' ? 'target' : 'alert'} size={20} className="mt-0.5 shrink-0" />
        <div className="text-sm leading-snug font-semibold">{verdict.text}</div>
      </div>

      <div className="space-y-1.5">
        {checks.map((c, i) => (
          <div key={i} className="flex items-start gap-2.5 bg-surface border border-line rounded-xl px-3 py-2">
            <span className={`mt-1.5 w-[7px] h-[7px] rounded-full shrink-0 ${DOT[c.level]}`} />
            <div className="min-w-0">
              <div className={`text-xs font-bold ${TEXT[c.level]}`}>{c.title}</div>
              <div className="text-[11px] text-muted leading-snug mt-0.5">{c.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const BANNER = {
  good: 'bg-accent-dim text-accent',
  warn: 'bg-warn/10 text-warn',
  bad: 'bg-danger/10 text-danger'
}
const DOT = { good: 'bg-accent', warn: 'bg-warn', bad: 'bg-danger', wait: 'bg-muted' }
const TEXT = { good: 'text-ink', warn: 'text-warn', bad: 'text-danger', wait: 'text-muted' }
