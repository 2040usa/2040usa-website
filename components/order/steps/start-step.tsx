"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { ORDER_ROUTE_OPTIONS } from "@/lib/order-draft/constants";
import type { OrderRoute } from "@/lib/order-draft/types";
import { useOrderDraft, useOrderDraftPersistence } from "@/components/order/order-draft-provider";
import { RouteVisual } from "@/components/order/route-visual";
import { ActionButton } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getPublicEnvironment } from "@/lib/env/public";
import { inspectBrowserSession } from "@/lib/supabase/session-inspection";

export function StartStep({ initialRoute }: { initialRoute: OrderRoute | null }) {
  const router = useRouter();
  const selectedRoute = useOrderDraft((state) => state.selectedRoute);
  const hydrationState = useOrderDraft((state) => state.hydrationState);
  const persistenceError = useOrderDraft((state) => state.persistenceError);
  const { bootstrap, retryHydration } = useOrderDraftPersistence();
  const customerChangedSelection = useRef(false);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [pendingRoute, setPendingRoute] = useState<OrderRoute | null>(initialRoute);
  const [attempted, setAttempted] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [sessionState, setSessionState] = useState<"checking" | "present" | "absent" | "error">("checking");
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState("");
  const environment = getPublicEnvironment();

  const inspectSession = useCallback(async () => {
    setSessionState("checking");
    setError("");
    const result = await inspectBrowserSession(createSupabaseBrowserClient());
    if (result.kind === "error") { setSessionState("error"); setError(result.message); return; }
    setSessionState(result.kind);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void inspectSession());
    return () => window.cancelAnimationFrame(frame);
  }, [inspectSession]);

  useEffect(() => {
    if (hydrationState !== "ready" || initialRoute || customerChangedSelection.current) return;
    const frame = window.requestAnimationFrame(() => {
      if (!customerChangedSelection.current) setPendingRoute(selectedRoute);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hydrationState, initialRoute, selectedRoute]);

  const confirmRoute = async () => {
    setAttempted(true);
    if (!pendingRoute || sessionState === "checking" || sessionState === "error" || (sessionState === "absent" && !captchaToken) || status === "working") return;
    setStatus("working");
    setError("");
    try {
      await bootstrap(pendingRoute, captchaToken);
      router.push("/order/artwork");
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "The secure draft could not be established.");
      setCaptchaToken("");
      turnstileRef.current?.reset();
    }
  };

  if (hydrationState === "initializing") return <div aria-live="polite"><h1 className="font-display text-4xl uppercase text-text-primary">Initializing your draft.</h1><p className="mt-4 text-sm text-text-muted">Checking for securely stored project details.</p></div>;
  if (hydrationState === "error") return <div role="alert"><h1 className="font-display text-4xl uppercase text-text-primary">Your draft could not be checked.</h1><p className="mt-4 max-w-xl text-sm text-error">{persistenceError}</p><ActionButton type="button" className="mt-6" onClick={retryHydration}>Retry draft check</ActionButton></div>;

  return (
    <div>
      <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.16em] text-accent">01 / Starting point</p>
      <h1 className="mt-4 max-w-4xl font-display text-4xl uppercase leading-[0.92] text-text-primary sm:text-6xl">How do you want to start?</h1>
      <p className="mt-5 max-w-2xl text-sm leading-6 text-text-muted">Choose the route closest to what you have today. Confirming establishes a secure anonymous draft; it does not create an order.</p>
      {attempted && !pendingRoute && <p id="route-selection-error" role="alert" className="mt-6 rounded-control border border-error bg-error/5 p-4 text-sm text-error">Choose one starting point before continuing.</p>}
      <fieldset aria-describedby={attempted && !pendingRoute ? "route-selection-error" : undefined} className="mt-8">
        <legend className="sr-only">Starting route</legend>
        <div className="grid gap-4 md:grid-cols-2">
          {ORDER_ROUTE_OPTIONS.map((option, index) => (
            <label key={option.value} className="group cursor-pointer rounded-control border border-border bg-panel p-4 transition-colors has-checked:border-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent sm:p-5">
              <span className="flex items-start justify-between gap-4"><span className="font-display text-2xl text-accent">{String(index + 1).padStart(2, "0")}</span><input type="radio" name="starting-route" value={option.value} checked={pendingRoute === option.value} onChange={() => { customerChangedSelection.current = true; setPendingRoute(option.value); }} className="mt-1 size-4 accent-accent" /></span>
              <span className="mt-4 block font-display text-2xl uppercase leading-none text-text-primary">{option.name}</span>
              <span className="mt-3 block min-h-10 text-xs leading-5 text-text-muted">{option.description}</span>
              <span className="mt-4 block"><RouteVisual route={option.value} compact /></span>
              <span className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2"><span><span className="block font-mono text-[0.5rem] uppercase tracking-widest text-accent">You have</span><span className="mt-1 block text-xs leading-5 text-text-muted">{option.customerHas}</span></span><span><span className="block font-mono text-[0.5rem] uppercase tracking-widest text-accent">2040 would handle</span><span className="mt-1 block text-xs leading-5 text-text-muted">{option.studioHandles}</span></span></span>
            </label>
          ))}
        </div>
      </fieldset>
      {sessionState === "absent" && <div className="mt-6 rounded-control border border-border bg-panel p-4"><p className="mb-3 font-mono text-[0.58rem] uppercase tracking-widest text-text-muted" aria-live="polite">Security verification is required before creating the anonymous draft.</p><Turnstile ref={turnstileRef} siteKey={environment.NEXT_PUBLIC_TURNSTILE_SITE_KEY} onSuccess={setCaptchaToken} onExpire={() => setCaptchaToken("")} onError={() => { setCaptchaToken(""); setError("Security verification failed. Retry the challenge."); }} options={{ theme: "dark" }} /></div>}
      {error && <p role="alert" className="mt-4 text-sm text-error">{error}</p>}
      {sessionState === "error" && <ActionButton type="button" variant="secondary" className="mt-4" onClick={() => void inspectSession()}>Retry session check</ActionButton>}
      <div className="mt-8 flex justify-end border-t border-border pt-6"><ActionButton type="button" disabled={status === "working" || sessionState === "checking" || sessionState === "error" || (sessionState === "absent" && !captchaToken)} onClick={() => void confirmRoute()}>{status === "working" ? "Establishing secure draft" : "Confirm starting point"}</ActionButton></div>
    </div>
  );
}
