import { FileCheck2 } from "lucide-react";
import { getOrderRouteOption } from "@/lib/order-draft/constants";
import type { OrderRoute } from "@/lib/order-draft/types";
import { StatusBadge } from "@/components/ui/status-badge";

export function OrderSummaryRail({ route, artworkAcknowledged }: { route: OrderRoute; artworkAcknowledged: boolean }) {
  const option = getOrderRouteOption(route);
  return (
    <aside className="h-fit min-w-0 rounded-control border border-border bg-panel p-5 lg:sticky lg:top-5" aria-labelledby="draft-summary-title">
      <div className="flex items-center justify-between gap-3"><p id="draft-summary-title" className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-accent">Current draft</p><StatusBadge tone="neutral">Durable draft</StatusBadge></div>
      <p className="mt-5 font-display text-2xl uppercase leading-none text-text-primary">{option.name}</p>
      <p className="mt-3 text-xs leading-5 text-text-muted">{option.description}</p>
      <div className="mt-5 flex items-start gap-3 border-t border-border pt-4"><FileCheck2 aria-hidden="true" className="mt-0.5 shrink-0 text-accent" size={16} /><div><p className="font-mono text-[0.52rem] uppercase tracking-widest text-text-muted">Artwork guidance</p><p className="mt-1 text-xs text-text-primary">{artworkAcknowledged ? "Acknowledged" : "Not yet acknowledged"}</p></div></div>
      <p className="mt-5 border-t border-border pt-4 font-mono text-[0.52rem] uppercase leading-5 tracking-widest text-text-muted">Saved project details return after refresh. No customer order exists.</p>
    </aside>
  );
}
