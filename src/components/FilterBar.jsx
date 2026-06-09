import Icon from './Icon.jsx'

const SORTS = [
  { id: 'yield', label: 'Dividendo ↓' },
  { id: 'ex', label: 'Ex-date vicina' },
  { id: 'below', label: 'Più sotto media' },
  { id: 'name', label: 'Nome A-Z' },
  { id: 'mcap', label: 'Capitalizzazione ↓' }
]

const chip = 'h-8 px-3.5 rounded-xl text-[12.5px] font-semibold shrink-0 border'

export default function FilterBar({
  q,
  setQ,
  sort,
  setSort,
  onlyBelow,
  setOnlyBelow,
  onlyPopular,
  setOnlyPopular,
  minYield,
  setMinYield
}) {
  return (
    <div className="sticky top-[env(safe-area-inset-top)] z-20 bg-bg/95 backdrop-blur pt-2 pb-2 space-y-2.5">
      <div className="flex items-center gap-2.5 h-11 px-3.5 rounded-2xl bg-surface border border-line text-muted">
        <Icon name="search" size={17} className="shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca titolo o ticker…"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className={`${chip} bg-surface border-line text-muted`}
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => setOnlyPopular((v) => !v)}
          className={`${chip} ${
            onlyPopular ? 'bg-accent-dim text-accent border-transparent' : 'bg-surface text-muted border-line'
          }`}
        >
          Popolari
        </button>
        <button
          onClick={() => setOnlyBelow((v) => !v)}
          className={`${chip} ${
            onlyBelow ? 'bg-accent-dim text-accent border-transparent' : 'bg-surface text-muted border-line'
          }`}
        >
          Sotto media
        </button>
        <select
          value={minYield}
          onChange={(e) => setMinYield(Number(e.target.value))}
          className={`${chip} bg-surface border-line text-muted`}
        >
          <option value={0}>Yield: tutti</option>
          <option value={2}>Yield ≥ 2%</option>
          <option value={4}>Yield ≥ 4%</option>
          <option value={6}>Yield ≥ 6%</option>
        </select>
      </div>
    </div>
  )
}
