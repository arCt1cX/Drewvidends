export default function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
      <div className="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}
