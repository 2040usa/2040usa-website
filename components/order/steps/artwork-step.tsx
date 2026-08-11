"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { ARTWORK_GUIDANCE, getOrderRouteOption } from "@/lib/order-draft/constants";
import { useOrderDraft } from "@/components/order/order-draft-provider";
import { OrderRouteGuard } from "@/components/order/order-route-guard";
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
  const hasUploadedArtwork = readiness.uploadedCount > 0;
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
      ? "Wait for every upload, replacement, and removal to finish."
      : saveState === "saving"
        ? "Wait for the current draft save to finish."
        : saveState === "error" || saveState === "conflict" || state === "error"
          ? "Resolve the visible draft or artwork error before continuing."
          : "Complete the required project details before continuing.";

  return (
    <OrderRouteGuard step="artwork">
      {selectedRoute && <div>
        <p className="text-sm font-semibold text-text-secondary">Step 2 · {getOrderRouteOption(selectedRoute).name}</p>
        <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold leading-tight tracking-[-0.03em] text-text-primary sm:text-6xl">Artwork &amp; Layout</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-text-muted">{selectedRoute === "gang-sheet" ? "Add your gang sheets and tell us the finished size and copies." : "Add your designs and tell us the size and quantity."}</p>
        <details className="mt-6 border-y border-border py-3" data-testid="artwork-requirements">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-primary-action focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring"><span>Artwork requirements</span><span aria-hidden="true" className="text-lg font-normal">+</span></summary>
          <div className="pb-2 pt-3 text-sm leading-6 text-text-muted">
            <p>PNG, JPG, JPEG, WebP, PDF, AI, or PSD. Up to 50 MiB per file.</p>
            <p className="mt-2">{ARTWORK_GUIDANCE[selectedRoute].detail}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">{ARTWORK_GUIDANCE[selectedRoute].checklist.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </details>
        {draftId && !hasUploadedArtwork && <div className="xl:w-[60%]" data-testid="empty-artwork-uploader"><ArtworkUploader draftId={draftId} onActivityChange={setUploadActivity} /></div>}
        <ArtworkFileList includeUploaded={false} />
        {hasUploadedArtwork && <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-success" aria-live="polite"><Check aria-hidden="true" size={17} />{readiness.uploadedCount} {selectedRoute === "gang-sheet" ? `gang sheet${readiness.uploadedCount === 1 ? "" : "s"}` : `design${readiness.uploadedCount === 1 ? "" : "s"}`} uploaded</p>}
        {error && <p role="alert" className="mt-4 text-sm text-error">{error}</p>}
        {hasUploadedArtwork && <section className="mt-8" aria-label="Artwork and layout workspace">
          <div>
            {selectedRoute === "gang-sheet" && <GangSheetForm continueBlocked={continueBlocked} blockedReason={blockedReason} addArtworkAction={draftId ? <ArtworkUploader draftId={draftId} onActivityChange={setUploadActivity} /> : null} />}
            {selectedRoute === "individual-designs" && <IndividualDesignsForm continueBlocked={continueBlocked} blockedReason={blockedReason} addArtworkAction={draftId ? <ArtworkUploader draftId={draftId} onActivityChange={setUploadActivity} /> : null} />}
          </div>
        </section>}
      </div>}
    </OrderRouteGuard>
  );
}
