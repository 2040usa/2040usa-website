"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getGuardRedirect } from "@/lib/order-draft/navigation";
import type { OrderStepId } from "@/lib/order-draft/types";
import { useOrderDraft } from "@/components/order/order-draft-provider";
import { useOrderDraftPersistence } from "@/components/order/order-draft-provider";
import { ActionButton } from "@/components/ui/button";
import { useArtwork } from "@/components/artwork/artwork-provider";

export function OrderRouteGuard({ step, children }: { step: OrderStepId; children: ReactNode }) {
  const router = useRouter();
  const selectedRoute = useOrderDraft((state) => state.selectedRoute);
  const startingPointConfirmed = useOrderDraft((state) => state.startingPointConfirmed);
  const artworkAcknowledged = useOrderDraft((state) => state.artworkAcknowledged);
  const configuration = useOrderDraft((state) => state.configuration);
  const hydrationState = useOrderDraft((state) => state.hydrationState);
  const persistenceError = useOrderDraft((state) => state.persistenceError);
  const { retryHydration } = useOrderDraftPersistence();
  const artwork = useArtwork();

  const draftRedirectPath = getGuardRedirect(step, {
    selectedRoute,
    startingPointConfirmed,
    artworkAcknowledged,
    configuration,
  });
  const needsReadyArtwork = step === "configure" || step === "review";
  const redirectPath = needsReadyArtwork && artwork.state === "ready" && !artwork.readiness.ready ? "/order/artwork" : draftRedirectPath;

  useEffect(() => {
    if (hydrationState === "ready" && redirectPath) router.replace(redirectPath);
  }, [hydrationState, redirectPath, router]);

  if (hydrationState === "initializing" || (needsReadyArtwork && (artwork.state === "idle" || artwork.state === "loading"))) {
    return <div aria-live="polite"><h1 className="font-display text-4xl font-semibold text-text-primary">Initializing your draft.</h1><p className="mt-4 text-sm text-text-muted">Checking for securely stored project details.</p></div>;
  }

  if (needsReadyArtwork && artwork.state === "error") {
    return <div role="alert" className="rounded-control border border-error/30 bg-panel p-5"><h1 className="font-display text-4xl font-semibold text-text-primary">Your artwork could not be checked.</h1><p className="mt-4 text-sm text-error">{artwork.error}</p><ActionButton type="button" className="mt-6" onClick={() => void artwork.reconcile()}>Retry artwork check</ActionButton></div>;
  }

  if (hydrationState === "error") {
    return <div role="alert" className="rounded-control border border-error/30 bg-panel p-5"><h1 className="font-display text-4xl font-semibold text-text-primary">Your draft could not be checked.</h1><p className="mt-4 text-sm text-error">{persistenceError}</p><ActionButton type="button" className="mt-6" onClick={retryHydration}>Retry draft check</ActionButton></div>;
  }

  if (redirectPath) {
    return <div aria-live="polite"><h1 className="font-display text-4xl font-semibold text-text-primary">Returning to your draft.</h1><p className="mt-4 text-sm text-text-muted">This step needs information from an earlier part of the draft.</p></div>;
  }

  return children;
}
