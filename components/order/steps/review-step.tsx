"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { formatConfigurationSummary } from "@/lib/order-draft/summary";
import { getOrderRouteOption } from "@/lib/order-draft/constants";
import { useOrderDraft, useOrderDraftPersistence } from "@/components/order/order-draft-provider";
import { OrderRouteGuard } from "@/components/order/order-route-guard";
import { ActionButton } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useArtwork } from "@/components/artwork/artwork-provider";
import { formatBytes } from "@/lib/artwork/constants";

export function ReviewStep() {
  const router = useRouter();
  const selectedRoute = useOrderDraft((state) => state.selectedRoute);
  const artworkAcknowledged = useOrderDraft((state) => state.artworkAcknowledged);
  const configuration = useOrderDraft((state) => state.configuration);
  const { reset } = useOrderDraftPersistence();
  const [resetError, setResetError] = useState("");
  const { records: artworkRecords, refresh: refreshArtwork } = useArtwork();
  const summary = configuration ? formatConfigurationSummary(configuration) : [];
  const startOver = async () => {
    if (!window.confirm("Clear this durable prototype draft and return to the starting point?")) return;
    setResetError("");
    try {
      await reset();
      router.replace("/order/start");
    } catch (error) {
      await refreshArtwork().catch(() => undefined);
      setResetError(error instanceof Error ? error.message : "The draft could not be reset. Retry when the connection is available.");
    }
  };

  return (
    <OrderRouteGuard step="review">
      {selectedRoute && configuration && <div>
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.16em] text-accent">04 / Review</p><h1 className="mt-4 max-w-4xl font-display text-4xl uppercase leading-[0.92] text-text-primary sm:text-6xl">Review your draft.</h1></div><StatusBadge tone="accent">Prototype only</StatusBadge></div>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-text-muted">Review the securely stored prototype draft. No order, price, payment, or production request exists.</p>
        <section className="mt-8 rounded-control border border-border bg-panel" aria-labelledby="route-review-title"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5"><div><p className="font-mono text-[0.54rem] uppercase tracking-widest text-accent">Starting point</p><h2 id="route-review-title" className="mt-2 font-display text-2xl uppercase text-text-primary">{getOrderRouteOption(selectedRoute).name}</h2></div><Link href="/order/start" className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-text-primary underline decoration-accent underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">Edit starting point</Link></div><div className="p-5"><p className="text-sm text-text-muted">{getOrderRouteOption(selectedRoute).description}</p></div></section>
        <section className="mt-4 rounded-control border border-border bg-panel" aria-labelledby="artwork-review-title"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5"><div><p className="font-mono text-[0.54rem] uppercase tracking-widest text-accent">Artwork step</p><h2 id="artwork-review-title" className="mt-2 font-display text-2xl uppercase text-text-primary">{artworkAcknowledged ? "Uploaded artwork" : "Artwork incomplete"}</h2></div><Link href="/order/artwork" className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-text-primary underline decoration-accent underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">Edit artwork</Link></div><ul className="divide-y divide-border">{artworkRecords.filter((record) => record.status === "uploaded").map((record) => <li key={record.id} className="grid gap-2 p-5 text-xs sm:grid-cols-[minmax(0,1fr)_auto]"><div><p className="font-semibold text-text-primary">{record.originalName}</p><p className="mt-1 text-text-muted">{record.mimeType} · {record.purpose.replaceAll("-", " ")}</p></div><p className="font-mono uppercase tracking-widest text-success">Upload complete · {formatBytes(record.verifiedSizeBytes ?? 0)}</p></li>)}</ul></section>
        <section className="mt-4 rounded-control border border-border bg-panel" aria-labelledby="configuration-review-title"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5"><div><p className="font-mono text-[0.54rem] uppercase tracking-widest text-accent">Configuration</p><h2 id="configuration-review-title" className="mt-2 font-display text-2xl uppercase text-text-primary">Project details</h2></div><Link href="/order/configure" className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-text-primary underline decoration-accent underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">Edit project details</Link></div><div data-testid="configuration-summary-grid" className={cn("grid gap-px bg-border", summary.length > 1 && "md:grid-cols-2")}>{summary.map((group) => <div key={group.title} className="bg-background p-5"><h3 className="font-display text-xl uppercase text-text-primary">{group.title}</h3><dl className="mt-4 space-y-3">{group.items.map((item) => <div key={`${item.label}-${item.value}`} className="flex items-start justify-between gap-4 border-t border-border pt-3"><dt className="text-xs text-text-muted">{item.label}</dt><dd className="text-right text-xs text-text-primary">{item.value}</dd></div>)}</dl></div>)}</div>{configuration.notes && <div className="border-t border-border p-5"><h3 className="font-mono text-[0.58rem] uppercase tracking-widest text-accent">Project notes</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-muted">{configuration.notes}</p></div>}</section>
        <div className="mt-6 rounded-control border border-accent/60 bg-accent/5 p-5"><p className="font-mono text-xs font-bold uppercase tracking-widest text-text-primary">Prototype ends here</p><p className="mt-2 text-sm leading-6 text-text-muted">Payment and order submission will be added after artwork upload and server-owned pricing.</p><ActionButton type="button" disabled className="mt-4 w-full sm:w-auto">Submission unavailable</ActionButton></div>
        {resetError && <p role="alert" className="mt-5 text-sm text-error">{resetError}</p>}
        <div className="mt-8 flex justify-start border-t border-border pt-6"><ActionButton type="button" variant="quiet" className="text-error hover:text-text-primary" onClick={() => void startOver()}><RotateCcw aria-hidden="true" size={15} /> Start over</ActionButton></div>
      </div>}
    </OrderRouteGuard>
  );
}
