"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getGuardRedirect } from "@/lib/order-draft/navigation";
import type { OrderStepId } from "@/lib/order-draft/types";
import { useOrderDraft } from "@/components/order/order-draft-provider";
import { useOrderDraftPersistence } from "@/components/order/order-draft-provider";
import { ActionButton } from "@/components/ui/button";

export function OrderRouteGuard({ step, children }: { step: OrderStepId; children: ReactNode }) {
  const router = useRouter();
  const selectedRoute = useOrderDraft((state) => state.selectedRoute);
  const startingPointConfirmed = useOrderDraft((state) => state.startingPointConfirmed);
  const artworkAcknowledged = useOrderDraft((state) => state.artworkAcknowledged);
  const configuration = useOrderDraft((state) => state.configuration);
  const hydrationState = useOrderDraft((state) => state.hydrationState);
  const persistenceError = useOrderDraft((state) => state.persistenceError);
  const { retryHydration } = useOrderDraftPersistence();

  const redirectPath = getGuardRedirect(step, {
    selectedRoute,
    startingPointConfirmed,
    artworkAcknowledged,
    configuration,
  });

  useEffect(() => {
    if (hydrationState === "ready" && redirectPath) router.replace(redirectPath);
  }, [hydrationState, redirectPath, router]);

  if (hydrationState === "initializing") {
    return <div aria-live="polite"><h1 className="font-display text-4xl uppercase text-text-primary">Initializing your draft.</h1><p className="mt-4 text-sm text-text-muted">Checking for securely stored project details.</p></div>;
  }

  if (hydrationState === "error") {
    return <div role="alert"><h1 className="font-display text-4xl uppercase text-text-primary">Your draft could not be checked.</h1><p className="mt-4 text-sm text-error">{persistenceError}</p><ActionButton type="button" className="mt-6" onClick={retryHydration}>Retry draft check</ActionButton></div>;
  }

  if (redirectPath) {
    return <div aria-live="polite"><h1 className="font-display text-4xl uppercase text-text-primary">Returning to your draft.</h1><p className="mt-4 text-sm text-text-muted">This step needs information from an earlier part of the prototype.</p></div>;
  }

  return children;
}
