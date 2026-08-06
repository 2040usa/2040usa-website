import type { OrderRoute } from "@/lib/order-draft/types";

export function RouteVisual({ route, compact = false }: { route: OrderRoute; compact?: boolean }) {
  const height = compact ? "h-20" : "h-28";
  if (route === "gang-sheet") {
    return <div className={`grid ${height} grid-cols-4 gap-1 bg-sheet p-2`} aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <span key={index} className={index % 3 === 0 ? "bg-registration-red" : index % 2 === 0 ? "bg-accent" : "bg-sheet-ink"} />)}</div>;
  }
  return <div className={`grid ${height} grid-cols-3 gap-2 border border-border bg-raised p-3`} aria-hidden="true">
    {["W", "H", "1:1"].map((label, index) => <span key={label} className="grid place-items-center rounded-control border border-border bg-panel text-xs font-semibold text-text-secondary" style={{ transform: `scale(${0.78 + index * 0.11})` }}>{label}</span>)}
  </div>;
}
