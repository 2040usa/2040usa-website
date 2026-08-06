"use client";

import { CheckCircle2, Info } from "lucide-react";
import { ARTWORK_GUIDANCE, getOrderRouteOption } from "@/lib/order-draft/constants";
import { useOrderDraft } from "@/components/order/order-draft-provider";
import { OrderRouteGuard } from "@/components/order/order-route-guard";
import { RouteVisual } from "@/components/order/route-visual";
import { StepActions } from "@/components/order/step-actions";
import { useRouter } from "next/navigation";
import { ArtworkUploader } from "@/components/artwork/artwork-uploader";
import { ArtworkFileList } from "@/components/artwork/artwork-file-list";
import { useArtwork } from "@/components/artwork/artwork-provider";

export function ArtworkStep() {
  const router = useRouter();
  const selectedRoute = useOrderDraft((state) => state.selectedRoute);
  const draftId = useOrderDraft((state) => state.serverDraftId);
  const { readiness, acknowledge, state, error } = useArtwork();
  const continueToConfigure = async () => { if (await acknowledge()) router.push("/order/configure"); };

  return (
    <OrderRouteGuard step="artwork">
      {selectedRoute && <div>
        <p className="text-sm font-semibold text-text-secondary">Step 2 · Artwork</p>
        <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold leading-tight tracking-[-0.03em] text-text-primary sm:text-6xl">{ARTWORK_GUIDANCE[selectedRoute].title}</h1>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-text-muted">{ARTWORK_GUIDANCE[selectedRoute].detail}</p>
        <div className="mt-8 grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-control border border-border bg-panel p-4 shadow-[var(--card-shadow)]"><RouteVisual route={selectedRoute} /><p className="mt-4 font-display text-xl font-semibold text-text-primary">{getOrderRouteOption(selectedRoute).name}</p></div>
          <section className="rounded-control border border-border bg-panel p-5 shadow-[var(--card-shadow)]" aria-labelledby="artwork-checklist-title"><h2 id="artwork-checklist-title" className="font-display text-2xl font-semibold text-text-primary">Artwork requirements</h2><ul className="mt-5 space-y-3">{ARTWORK_GUIDANCE[selectedRoute].checklist.map((item) => <li key={item} className="flex items-start gap-3 text-sm leading-6 text-text-muted"><Info aria-hidden="true" className="mt-1 shrink-0 text-primary-action" size={15} />{item}</li>)}</ul></section>
        </div>
        {draftId && <ArtworkUploader draftId={draftId} />}
        <ArtworkFileList />
        <div className={`mt-6 flex items-start gap-4 rounded-control border p-5 ${readiness.ready ? "border-success/40 bg-success/5" : "border-border bg-raised"}`}><CheckCircle2 aria-hidden="true" className={`mt-0.5 shrink-0 ${readiness.ready ? "text-success" : "text-text-muted"}`} size={22} /><div><p className="text-sm font-semibold text-text-primary">{readiness.ready ? "Artwork ready for this draft" : "Artwork is not ready yet"}</p><p className="mt-2 text-sm leading-6 text-text-muted">Readiness comes from server-verified completed upload records, not the local upload queue.</p></div></div>
        {error && <p role="alert" className="mt-4 text-sm text-error">{error}</p>}
        <StepActions backHref="/order/start" continueLabel="Continue to project details" isSubmitting={!readiness.ready || state === "mutating" || state === "loading"} onContinue={() => void continueToConfigure()} />
      </div>}
    </OrderRouteGuard>
  );
}
