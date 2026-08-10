"use client";

import { useState } from "react";
import { CheckCircle2, Info } from "lucide-react";
import { ARTWORK_GUIDANCE, getOrderRouteOption } from "@/lib/order-draft/constants";
import { useOrderDraft } from "@/components/order/order-draft-provider";
import { OrderRouteGuard } from "@/components/order/order-route-guard";
import { RouteVisual } from "@/components/order/route-visual";
import { ArtworkUploader } from "@/components/artwork/artwork-uploader";
import { ArtworkFileList } from "@/components/artwork/artwork-file-list";
import { useArtwork } from "@/components/artwork/artwork-provider";
import { GangSheetForm } from "@/components/order/forms/gang-sheet-form";
import { IndividualDesignsForm } from "@/components/order/forms/individual-designs-form";

export function ArtworkStep() {
  const [uploadActivity, setUploadActivity] = useState(false);
  const selectedRoute = useOrderDraft((state) => state.selectedRoute);
  const draftId = useOrderDraft((state) => state.serverDraftId);
  const saveState = useOrderDraft((state) => state.saveState);
  const { records, readiness, state, error } = useArtwork();
  const unresolvedCanonicalArtwork = records.some((record) => record.status !== "uploaded");
  const continueBlocked = !readiness.ready
    || uploadActivity
    || unresolvedCanonicalArtwork
    || state !== "ready"
    || saveState === "saving"
    || saveState === "error"
    || saveState === "conflict";
  const blockedReason = !readiness.ready
    ? "Upload and verify at least one artwork file before continuing."
    : uploadActivity || unresolvedCanonicalArtwork || state === "mutating" || state === "loading" || state === "idle"
      ? "Wait for every upload, replacement, deletion, and canonical verification to finish."
      : saveState === "saving"
        ? "Wait for the current draft save to finish."
        : saveState === "error" || saveState === "conflict" || state === "error"
          ? "Resolve the visible draft or artwork error before continuing."
          : "Complete the required project details before continuing.";

  return (
    <OrderRouteGuard step="artwork">
      {selectedRoute && <div>
        <p className="text-sm font-semibold text-text-secondary">Step 2 · Artwork &amp; Layout</p>
        <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold leading-tight tracking-[-0.03em] text-text-primary sm:text-6xl">Upload and configure your artwork.</h1>
        <p className="mt-5 max-w-3xl text-sm leading-6 text-text-muted">Add files, configure each verified upload, and review the current layout preview in one workspace for <span className="text-text-primary">{getOrderRouteOption(selectedRoute).name}</span>.</p>
        <div className="mt-8 grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
          <div className="rounded-control border border-border bg-panel p-4 shadow-[var(--card-shadow)]"><RouteVisual route={selectedRoute} /><p className="mt-4 font-display text-xl font-semibold text-text-primary">{ARTWORK_GUIDANCE[selectedRoute].title}</p><p className="mt-2 text-xs leading-5 text-text-muted">{ARTWORK_GUIDANCE[selectedRoute].detail}</p></div>
          <section className="rounded-control border border-border bg-panel p-5 shadow-[var(--card-shadow)]" aria-labelledby="artwork-checklist-title"><h2 id="artwork-checklist-title" className="font-display text-2xl font-semibold text-text-primary">Prepare this workspace</h2><ul className="mt-5 grid gap-3 sm:grid-cols-3">{ARTWORK_GUIDANCE[selectedRoute].checklist.map((item) => <li key={item} className="flex items-start gap-3 text-sm leading-6 text-text-muted"><Info aria-hidden="true" className="mt-1 shrink-0 text-primary-action" size={15} />{item}</li>)}</ul></section>
        </div>
        {draftId && <ArtworkUploader draftId={draftId} onActivityChange={setUploadActivity} />}
        <ArtworkFileList includeUploaded={false} />
        <div className={`mt-6 flex items-start gap-4 rounded-control border p-5 ${readiness.ready ? "border-success/40 bg-success/5" : "border-border bg-raised"}`}><CheckCircle2 aria-hidden="true" className={`mt-0.5 shrink-0 ${readiness.ready ? "text-success" : "text-text-muted"}`} size={22} /><div><p className="text-sm font-semibold text-text-primary">{readiness.ready ? "Artwork ready for this draft" : "Artwork is not ready yet"}</p><p className="mt-2 text-sm leading-6 text-text-muted">Readiness comes from server-verified completed upload records, not the local upload queue.</p></div></div>
        {error && <p role="alert" className="mt-4 text-sm text-error">{error}</p>}
        <section className="mt-10" aria-labelledby="configure-artwork-title">
          <p className="text-xs font-semibold text-text-secondary">Project details</p>
          <h2 id="configure-artwork-title" className="mt-2 font-display text-3xl font-semibold text-text-primary">Configure uploaded artwork</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-text-muted">Configuration cards appear as uploads reach canonical verified state. Each card remains linked to its server-issued artwork identity.</p>
          <div className="mt-6">
            {selectedRoute === "gang-sheet" && <GangSheetForm continueBlocked={continueBlocked} blockedReason={blockedReason} />}
            {selectedRoute === "individual-designs" && <IndividualDesignsForm continueBlocked={continueBlocked} blockedReason={blockedReason} />}
          </div>
        </section>
      </div>}
    </OrderRouteGuard>
  );
}
