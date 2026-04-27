export function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold">Dashboard</div>
        <div className="mt-1 text-sm text-text-secondary">Your operational snapshot for today.</div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-border-subtle bg-bg-card p-4"
          >
            <div className="text-xs text-text-muted">Metric</div>
            <div className="mt-2 text-2xl font-semibold">—</div>
            <div className="mt-2 text-xs text-text-secondary">Coming next</div>
          </div>
        ))}
      </div>
    </div>
  )
}
