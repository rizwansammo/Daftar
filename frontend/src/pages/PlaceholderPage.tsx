export function PlaceholderPage(props: { title: string }) {
  return (
    <div className="space-y-2">
      <div className="text-2xl font-semibold">{props.title}</div>
      <div className="text-sm text-text-secondary">This module UI is next.</div>
    </div>
  )
}
