"use client";

import { FileQuestion, Info } from "lucide-react";
import { ARTWORK_GUIDANCE, getOrderRouteOption } from "@/lib/order-draft/constants";
import { useOrderDraft, useOrderDraftPersistence } from "@/components/order/order-draft-provider";
import { OrderRouteGuard } from "@/components/order/order-route-guard";
import { RouteVisual } from "@/components/order/route-visual";
import { StepActions } from "@/components/order/step-actions";
import { useRouter } from "next/navigation";

export function ArtworkStep() {
  const router = useRouter();
  const selectedRoute = useOrderDraft((state) => state.selectedRoute);
  const acknowledgeArtwork = useOrderDraft((state) => state.acknowledgeArtwork);
  const { flush } = useOrderDraftPersistence();
  const continueToConfigure = async () => { acknowledgeArtwork(); if (await flush()) router.push("/order/configure"); };

  return (
    <OrderRouteGuard step="artwork">
      {selectedRoute && <div>
        <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.16em] text-accent">02 / Artwork</p>
        <h1 className="mt-4 max-w-4xl font-display text-4xl uppercase leading-[0.92] text-text-primary sm:text-6xl">{ARTWORK_GUIDANCE[selectedRoute].title}</h1>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-text-muted">{ARTWORK_GUIDANCE[selectedRoute].detail}</p>
        <div className="mt-8 grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-control border border-border bg-panel p-4"><RouteVisual route={selectedRoute} /><p className="mt-4 font-display text-xl uppercase text-text-primary">{getOrderRouteOption(selectedRoute).name}</p></div>
          <section className="rounded-control border border-border bg-panel p-5" aria-labelledby="artwork-checklist-title"><h2 id="artwork-checklist-title" className="font-display text-2xl uppercase text-text-primary">What the future artwork step will request</h2><ul className="mt-5 space-y-3">{ARTWORK_GUIDANCE[selectedRoute].checklist.map((item) => <li key={item} className="flex items-start gap-3 text-sm leading-6 text-text-muted"><Info aria-hidden="true" className="mt-1 shrink-0 text-accent" size={15} />{item}</li>)}</ul></section>
        </div>
        <div className="mt-6 flex items-start gap-4 rounded-control border border-accent/60 bg-accent/5 p-5"><FileQuestion aria-hidden="true" className="mt-0.5 shrink-0 text-accent" size={22} /><div><p className="font-mono text-xs font-bold uppercase tracking-widest text-text-primary">No upload control yet</p><p className="mt-2 text-sm leading-6 text-text-muted">Artwork uploading will be enabled in the next development increment. Continuing only records that you reviewed this guidance.</p></div></div>
        <StepActions backHref="/order/start" continueLabel="Acknowledge and continue" onContinue={() => void continueToConfigure()} />
      </div>}
    </OrderRouteGuard>
  );
}
