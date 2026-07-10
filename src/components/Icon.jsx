// Icon.jsx — set di icone a linea (sostituisce le emoji).
// Stroke = currentColor: il colore si controlla con le classi text-* di Tailwind.
//   <Icon name="star" className="w-5 h-5 text-accent" />
//   <Icon name="list" size={22} />

const BASE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
}

const PATHS = {
  list: (p) => (
    <>
      <path {...p} d="M7 6h12M7 12h12M7 18h12" />
      <circle cx="3.4" cy="6" r="1.1" {...p} />
      <circle cx="3.4" cy="12" r="1.1" {...p} />
      <circle cx="3.4" cy="18" r="1.1" {...p} />
    </>
  ),
  star: (p) => (
    <path {...p} d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.8-5.2-2.74-5.2 2.74 1-5.8-4.2-4.1 5.8-.85z" />
  ),
  starFill: () => (
    <path
      d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.8-5.2-2.74-5.2 2.74 1-5.8-4.2-4.1 5.8-.85z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  ),
  compare: (p) => (
    <>
      <path {...p} d="M6 20V10M12 20V5M18 20v-7" />
      <path {...p} d="M4 20h16" />
    </>
  ),
  calendar: (p) => (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" {...p} />
      <path {...p} d="M3.5 9.5h17M8 3.2v3.4M16 3.2v3.4" />
      <circle cx="8.2" cy="13.5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="13.5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="15.8" cy="13.5" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  search: (p) => (
    <>
      <circle cx="11" cy="11" r="6.4" {...p} />
      <path {...p} d="M16 16l4 4" />
    </>
  ),
  bell: (p) => (
    <>
      <path
        {...p}
        d="M6 9a6 6 0 1112 0c0 4 1.2 5.3 2 6.2.4.5.1 1.3-.6 1.3H4.6c-.7 0-1-.8-.6-1.3.8-.9 2-2.2 2-6.2z"
      />
      <path {...p} d="M10 20a2.2 2.2 0 004 0" />
    </>
  ),
  refresh: (p) => (
    <>
      <path {...p} d="M20 11a8 8 0 10-1 5" />
      <path {...p} d="M20 5v4h-4" />
    </>
  ),
  chevR: (p) => <path {...p} d="M9 5l7 7-7 7" />,
  chevL: (p) => <path {...p} d="M15 5l-7 7 7 7" />,
  chevD: (p) => <path {...p} d="M5 9l7 7 7-7" />,
  triUp: () => <path d="M12 7l5 8H7z" fill="currentColor" stroke="none" />,
  triDn: () => <path d="M12 17l-5-8h10z" fill="currentColor" stroke="none" />,
  clock: (p) => (
    <>
      <circle cx="12" cy="12" r="8" {...p} />
      <path {...p} d="M12 8v4l2.5 1.5" />
    </>
  ),
  target: (p) => (
    <>
      <circle cx="12" cy="12" r="8" {...p} />
      <circle cx="12" cy="12" r="3.6" {...p} />
    </>
  ),
  alert: (p) => (
    <>
      <path {...p} d="M12 4l9 16H3z" />
      <path {...p} d="M12 10v4" />
      <circle cx="12" cy="17" r="0.7" fill="currentColor" stroke="none" />
    </>
  ),
  sliders: (p) => (
    <>
      <path {...p} d="M5 7h9M5 12h5M5 17h11" />
      <circle cx="17" cy="7" r="2" {...p} />
      <circle cx="13" cy="12" r="2" {...p} />
      <circle cx="19" cy="17" r="2" {...p} />
    </>
  ),
  arrowDn: (p) => <path {...p} d="M12 5v14M6 13l6 6 6-6" />,
  x: (p) => <path {...p} d="M6 6l12 12M18 6L6 18" />,
  check: (p) => (
    <>
      <circle cx="12" cy="12" r="8.5" {...p} />
      <path {...p} d="M8.4 12.3l2.4 2.4 4.8-5.2" />
    </>
  ),
  checkFill: () => (
    <>
      <circle cx="12" cy="12" r="8.5" fill="currentColor" stroke="none" />
      <path
        d="M8.4 12.3l2.4 2.4 4.8-5.2"
        fill="none"
        stroke="#14161b"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  note: (p) => (
    <>
      <path {...p} d="M5 4h11l4 4v12H5z" />
      <path {...p} d="M15 4v5h5" />
    </>
  )
}

export default function Icon({ name, size = 20, strokeWidth, className = '', style }) {
  const draw = PATHS[name]
  if (!draw) return null
  const p = strokeWidth ? { ...BASE, strokeWidth } : BASE
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{ display: 'block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {draw(p)}
    </svg>
  )
}
