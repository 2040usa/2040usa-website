"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ORDER_ROUTE_OPTIONS } from "@/lib/order-draft/constants";
import type { OrderRoute } from "@/lib/order-draft/types";
import { useOrderDraft } from "@/components/order/order-draft-provider";
import { RouteVisual } from "@/components/order/route-visual";
import { ActionButton } from "@/components/ui/button";

export function StartStep({ initialRoute }: { initialRoute: OrderRoute | null }) {
  const router = useRouter();
  const selectedRoute = useOrderDraft((state) => state.selectedRoute);
  const selectRoute = useOrderDraft((state) => state.selectRoute);
  const confirmStartingPoint = useOrderDraft((state) => state.confirmStartingPoint);
  const appliedQuery = useRef(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!appliedQuery.current && initialRoute) {
      appliedQuery.current = true;
      selectRoute(initialRoute);
    }
  }, [initialRoute, selectRoute]);

  const confirmRoute = () => {
    setAttempted(true);
    if (selectedRoute) {
      confirmStartingPoint();
      router.push("/order/artwork");
    }
  };

  return (
    <div>
      <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.16em] text-accent">01 / Starting point</p>
      <h1 className="mt-4 max-w-4xl font-display text-4xl uppercase leading-[0.92] text-text-primary sm:text-6xl">How do you want to start?</h1>
      <p className="mt-5 max-w-2xl text-sm leading-6 text-text-muted">Choose the route closest to what you have today. You will confirm this choice before moving forward, and you can return here later.</p>
      {attempted && !selectedRoute && <p id="route-selection-error" role="alert" className="mt-6 rounded-control border border-error bg-error/5 p-4 text-sm text-error">Choose one starting point before continuing.</p>}
      <fieldset aria-describedby={attempted && !selectedRoute ? "route-selection-error" : undefined} className="mt-8">
        <legend className="sr-only">Starting route</legend>
        <div className="grid gap-4 md:grid-cols-2">
          {ORDER_ROUTE_OPTIONS.map((option, index) => (
            <label key={option.value} className="group cursor-pointer rounded-control border border-border bg-panel p-4 transition-colors has-checked:border-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent sm:p-5">
              <span className="flex items-start justify-between gap-4"><span className="font-display text-2xl text-accent">{String(index + 1).padStart(2, "0")}</span><input type="radio" name="starting-route" value={option.value} checked={selectedRoute === option.value} onChange={() => selectRoute(option.value)} className="mt-1 size-4 accent-accent" /></span>
              <span className="mt-4 block font-display text-2xl uppercase leading-none text-text-primary">{option.name}</span>
              <span className="mt-3 block min-h-10 text-xs leading-5 text-text-muted">{option.description}</span>
              <span className="mt-4 block"><RouteVisual route={option.value} compact /></span>
              <span className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2"><span><span className="block font-mono text-[0.5rem] uppercase tracking-widest text-accent">You have</span><span className="mt-1 block text-xs leading-5 text-text-muted">{option.customerHas}</span></span><span><span className="block font-mono text-[0.5rem] uppercase tracking-widest text-accent">2040 would handle</span><span className="mt-1 block text-xs leading-5 text-text-muted">{option.studioHandles}</span></span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-8 flex justify-end border-t border-border pt-6"><ActionButton type="button" onClick={confirmRoute}>Confirm starting point</ActionButton></div>
    </div>
  );
}
