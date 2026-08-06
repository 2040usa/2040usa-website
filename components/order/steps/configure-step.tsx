"use client";

import { getOrderRouteOption } from "@/lib/order-draft/constants";
import { useOrderDraft } from "@/components/order/order-draft-provider";
import { OrderRouteGuard } from "@/components/order/order-route-guard";
import { GangSheetForm } from "@/components/order/forms/gang-sheet-form";
import { SeparateArtworkForm } from "@/components/order/forms/separate-artwork-form";
import { TransfersBySizeForm } from "@/components/order/forms/transfers-by-size-form";
import { FullApparelForm } from "@/components/order/forms/full-apparel-form";

export function ConfigureStep() {
  const selectedRoute = useOrderDraft((state) => state.selectedRoute);
  return (
    <OrderRouteGuard step="configure">
      {selectedRoute && <div>
        <p className="text-sm font-semibold text-text-secondary">Step 3 · Project details</p>
        <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold leading-tight tracking-[-0.03em] text-text-primary sm:text-6xl">Describe the project.</h1>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-text-muted">Fields below are specific to <span className="text-text-primary">{getOrderRouteOption(selectedRoute).name}</span>. No pricing is calculated and nothing is submitted.</p>
        <div className="mt-8">
          {selectedRoute === "gang-sheet" && <GangSheetForm />}
          {selectedRoute === "separate-artwork" && <SeparateArtworkForm />}
          {selectedRoute === "transfers-by-size" && <TransfersBySizeForm />}
          {selectedRoute === "full-apparel" && <FullApparelForm />}
        </div>
      </div>}
    </OrderRouteGuard>
  );
}
