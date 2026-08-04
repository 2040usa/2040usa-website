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
      <header className="border-b border-border bg-background">
        <div className="page-shell flex min-h-16 items-center justify-between gap-4 py-3">
          <Link href="/" className="flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" aria-label="2040 USA homepage"><span className="font-display text-2xl tracking-[-0.03em]">2040</span><span className="font-mono text-[0.55rem] font-bold uppercase tracking-widest text-accent">USA</span></Link>
          <Link href="/" onClick={(event) => void exitOrder(event)} className="inline-flex items-center gap-2 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-text-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"><ArrowLeft aria-hidden="true" size={14} /> Exit order</Link>
        </div>
        <div className="border-t border-border bg-accent px-4 py-2 text-center font-mono text-[0.58rem] font-bold uppercase tracking-[0.13em] text-accent-foreground">Draft prototype — project details are stored securely, but no order is created</div>
      </header>
      <OrderProgress currentStep={currentStep} lastCompletedStep={lastCompletedStep} />
      <div className="page-shell flex flex-wrap items-center justify-between gap-4 border-b border-border py-4 font-mono text-[0.58rem] uppercase tracking-widest text-text-muted"><span>Step {currentStepMeta.number} of {ORDER_STEPS.length}</span><span className="text-text-primary">{currentStepMeta.title}</span><span aria-live="polite" className={saveState === "error" || saveState === "conflict" ? "text-error" : saveState === "saved" ? "text-success" : "text-text-muted"}>{status}</span></div>
      {(hydrationState === "error" || saveState === "error" || saveState === "conflict") && <div className="page-shell border-b border-border py-3 text-xs text-error" role="alert"><span>{persistenceError}</span><button type="button" className="ml-3 font-mono uppercase underline decoration-accent underline-offset-4 focus-visible:outline-2 focus-visible:outline-accent" onClick={() => hydrationState === "error" ? retryHydration() : saveState === "conflict" ? void reloadLatest() : retry()}>{hydrationState === "error" ? "Retry draft check" : saveState === "conflict" ? "Reload latest" : "Retry"}</button></div>}
      <div className={`page-shell grid min-w-0 gap-8 py-10 sm:py-14 ${showSummary ? "lg:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}>
        <main ref={mainRef} tabIndex={-1} className="min-w-0 outline-none">{children}</main>
        {showSummary && <OrderSummaryRail route={selectedRoute} artworkAcknowledged={artworkAcknowledged} />}
      </div>
    </div>
  );
}
