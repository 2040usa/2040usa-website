import { FileCheck2 } from "lucide-react";
import { getOrderRouteOption } from "@/lib/order-draft/constants";
import type { OrderRoute } from "@/lib/order-draft/types";
import { StatusBadge } from "@/components/ui/status-badge";
import { useArtwork } from "@/components/artwork/artwork-provider";
import { formatBytes } from "@/lib/artwork/constants";

export function OrderSummaryRail({ route, artworkAcknowledged }: { route: OrderRoute; artworkAcknowledged: boolean }) {
  const option = getOrderRouteOption(route);
  const { records, readiness } = useArtwork();
  return (
    <aside className="h-fit min-w-0 rounded-control border border-border bg-panel p-5 shadow-[var(--card-shadow)] lg:sticky lg:top-5" aria-labelledby="draft-summary-title">
      <div className="flex items-center justify-between gap-3"><p id="draft-summary-title" className="text-sm font-semibold text-text-primary">Current draft</p><StatusBadge tone="neutral">Saved draft</StatusBadge></div>
      <p className="mt-5 font-display text-2xl font-semibold leading-tight text-text-primary">{option.name}</p>
      <p className="mt-3 text-xs leading-5 text-text-muted">{option.description}</p>
      <div className="mt-5 flex items-start gap-3 border-t border-border pt-4"><FileCheck2 aria-hidden="true" className="mt-0.5 shrink-0 text-primary-action" size={16} /><div><p className="text-xs font-semibold text-text-secondary">Artwork</p><p className="mt-1 text-xs text-text-primary">{records.filter((record) => record.status === "uploaded").length} uploaded · {formatBytes(readiness.totalVerifiedBytes)}</p><p className="mt-1 text-xs text-text-muted">{readiness.ready && artworkAcknowledged ? "Ready and acknowledged" : readiness.ready ? "Ready to continue" : "Incomplete"}</p></div></div>
      <p className="mt-5 border-t border-border pt-4 text-xs leading-5 text-text-muted">Saved project details return after refresh. No customer order exists.</p>
    </aside>
  );
}
