"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getGuardRedirect } from "@/lib/order-draft/navigation";
import type { OrderStepId } from "@/lib/order-draft/types";
import { useOrderDraft } from "@/components/order/order-draft-provider";

export function OrderRouteGuard({ step, children }: { step: OrderStepId; children: ReactNode }) {
  const router = useRouter();
  const selectedRoute = useOrderDraft((state) => state.selectedRoute);
  const startingPointConfirmed = useOrderDraft((state) => state.startingPointConfirmed);
  const artworkAcknowledged = useOrderDraft((state) => state.artworkAcknowledged);
  const configuration = useOrderDraft((state) => state.configuration);
  const redirectPath = getGuardRedirect(step, {
    selectedRoute,
    startingPointConfirmed,
    artworkAcknowledged,
    configuration,
  });

  useEffect(() => {
    if (redirectPath) router.replace(redirectPath);
  }, [redirectPath, router]);

  if (redirectPath) {
    return <div aria-live="polite"><h1 className="font-display text-4xl uppercase text-text-primary">Returning to your draft.</h1><p className="mt-4 text-sm text-text-muted">This step needs information from an earlier part of the prototype.</p></div>;
  }

  return children;
}
