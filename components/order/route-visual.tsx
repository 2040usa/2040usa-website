import { Shirt } from "lucide-react";
import type { OrderRoute } from "@/lib/order-draft/types";

export function RouteVisual({ route, compact = false }: { route: OrderRoute; compact?: boolean }) {
  const height = compact ? "h-20" : "h-28";
  if (route === "gang-sheet") {
    return <div className={`grid ${height} grid-cols-4 gap-1 bg-sheet p-2`} aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <span key={index} className={index % 3 === 0 ? "bg-registration-red" : index % 2 === 0 ? "bg-accent" : "bg-sheet-ink"} />)}</div>;
  }
  if (route === "separate-artwork") {
    return <div className={`grid ${height} grid-cols-2 gap-px bg-border`} aria-hidden="true"><span className="grid place-items-center bg-sheet font-display text-3xl text-registration-red">LA</span><span className="technical-grid grid place-items-center bg-raised font-display text-3xl text-accent">20</span></div>;
  }
  if (route === "transfers-by-size") {
    return <div className={`flex ${height} items-end justify-around border border-border bg-raised p-3`} aria-hidden="true">{["8″", "11″", "15″", "22″"].map((size, index) => <span key={size} style={{ height: `${36 + index * 14}%` }} className="grid w-10 place-items-center border border-border bg-panel font-mono text-[0.55rem] text-text-muted">{size}</span>)}</div>;
  }
  return <div className={`relative grid ${height} place-items-center border border-border bg-raised`} aria-hidden="true"><Shirt size={compact ? 48 : 64} strokeWidth={0.8} className="text-text-muted" /><span className="absolute font-display text-sm text-accent">2040</span></div>;
}
