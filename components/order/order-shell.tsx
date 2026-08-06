"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ORDER_STEPS } from "@/lib/order-draft/constants";
import type { OrderStepId } from "@/lib/order-draft/types";
import { useOrderDraft, useOrderDraftPersistence } from "@/components/order/order-draft-provider";
import { OrderProgress } from "@/components/order/order-progress";
import { OrderSummaryRail } from "@/components/order/order-summary-rail";

function stepFromPath(pathname: string): OrderStepId {
  return ORDER_STEPS.find((step) => pathname === step.path)?.id ?? "start";
}

export function OrderShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const currentStep = stepFromPath(pathname);
  const currentStepMeta = ORDER_STEPS.find((step) => step.id === currentStep)!;
  const selectedRoute = useOrderDraft((state) => state.selectedRoute);
  const artworkAcknowledged = useOrderDraft((state) => state.artworkAcknowledged);
  const lastCompletedStep = useOrderDraft((state) => state.lastCompletedStep);
  const saveState = useOrderDraft((state) => state.saveState);
  const hydrationState = useOrderDraft((state) => state.hydrationState);
  const persistenceError = useOrderDraft((state) => state.persistenceError);
  const { flush, reloadLatest, retry, retryHydration } = useOrderDraftPersistence();
  const mainRef = useRef<HTMLElement>(null);
  const showSummary = selectedRoute && currentStep !== "start" && currentStep !== "review";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => mainRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  const status = hydrationState === "initializing" ? "Initializing" : hydrationState === "error" ? "Draft check failed" : saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : saveState === "error" ? "Unable to save" : saveState === "conflict" ? "Conflict detected" : "Local until confirmed";
  const exitOrder = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (await flush()) router.push("/");
  };

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <header className="border-b border-border bg-panel">
        <div className="page-shell flex min-h-16 items-center justify-between gap-4 py-3">
          <Link href="/" className="flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring" aria-label="2040 USA homepage"><span className="font-display text-2xl font-bold tracking-[-0.03em]">2040</span><span className="text-xs font-semibold tracking-[0.08em] text-primary-action">USA</span></Link>
          <Link href="/" onClick={(event) => void exitOrder(event)} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring"><ArrowLeft aria-hidden="true" size={14} /> Exit order</Link>
        </div>
        <div className="border-t border-border bg-raised px-4 py-2 text-center text-xs font-medium text-text-secondary">Secure draft — project details can be saved, but no order is created</div>
      </header>
      <OrderProgress currentStep={currentStep} lastCompletedStep={lastCompletedStep} />
      <div className="page-shell flex flex-wrap items-center justify-between gap-3 border-b border-border py-4 text-xs text-text-muted"><span>Step {currentStepMeta.number} of {ORDER_STEPS.length}</span><span className="font-semibold text-text-primary">{currentStepMeta.title}</span><span aria-live="polite" className={saveState === "error" || saveState === "conflict" ? "font-semibold text-error" : saveState === "saved" ? "font-semibold text-success" : "text-text-muted"}>{status}</span></div>
      {(hydrationState === "error" || saveState === "error" || saveState === "conflict") && <div className="page-shell mt-4 rounded-control border border-error/30 bg-error/5 px-4 py-3 text-sm text-error" role="alert"><span>{persistenceError}</span><button type="button" className="ml-3 font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-focus-ring" onClick={() => hydrationState === "error" ? retryHydration() : saveState === "conflict" ? void reloadLatest() : retry()}>{hydrationState === "error" ? "Retry draft check" : saveState === "conflict" ? "Reload latest" : "Retry"}</button></div>}
      <div className={`page-shell grid min-w-0 gap-8 py-10 sm:py-14 ${showSummary ? "lg:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}>
        <main ref={mainRef} tabIndex={-1} className="min-w-0 outline-none">{children}</main>
        {showSummary && <OrderSummaryRail route={selectedRoute} artworkAcknowledged={artworkAcknowledged} />}
      </div>
    </div>
  );
}
