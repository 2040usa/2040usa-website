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
import { useArtwork } from "@/components/artwork/artwork-provider";

export function StartStep({ initialRoute }: { initialRoute: OrderRoute | null }) {
  const router = useRouter();
  const selectedRoute = useOrderDraft((state) => state.selectedRoute);
  const configuration = useOrderDraft((state) => state.configuration);
  const workingConfiguration = useOrderDraft((state) => state.workingConfiguration);
  const hydrationState = useOrderDraft((state) => state.hydrationState);
  const persistenceError = useOrderDraft((state) => state.persistenceError);
  const { bootstrap, retryHydration } = useOrderDraftPersistence();
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [highlightedRoute, setHighlightedRoute] = useState<OrderRoute | null>(initialRoute);
  const [captchaToken, setCaptchaToken] = useState("");
  const [sessionState, setSessionState] = useState<"checking" | "present" | "absent" | "error">("checking");
  const [pendingRoute, setPendingRoute] = useState<OrderRoute | null>(null);
  const [error, setError] = useState("");
  const environment = getPublicEnvironment();
  const { records: artworkRecords, refresh: refreshArtwork } = useArtwork();

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

  const activateRoute = async (route: OrderRoute) => {
    setHighlightedRoute(route);
    if (pendingRoute || sessionState === "checking" || sessionState === "error" || (sessionState === "absent" && !captchaToken)) return;
    const changingPopulatedDraft = selectedRoute && route !== selectedRoute && (artworkRecords.length > 0 || configuration !== null || workingConfiguration !== null);
    if (changingPopulatedDraft && !window.confirm("Changing the starting point will remove incompatible artwork and project details after cleanup succeeds. Continue?")) return;
    setPendingRoute(route);
    setError("");
    try {
      await bootstrap(route, captchaToken);
      router.push("/order/artwork");
    } catch (reason) {
      await refreshArtwork().catch(() => undefined);
      setError(reason instanceof Error ? reason.message : "The secure draft could not be established. Activate the route again to retry.");
      setCaptchaToken("");
      turnstileRef.current?.reset();
      setPendingRoute(null);
    }
  };

  if (hydrationState === "initializing") return <div aria-live="polite"><h1 className="font-display text-4xl font-semibold text-text-primary">Initializing your draft.</h1><p className="mt-4 text-sm text-text-muted">Checking for securely stored project details.</p></div>;
  if (hydrationState === "error") return <div role="alert" className="rounded-control border border-error/30 bg-panel p-5"><h1 className="font-display text-4xl font-semibold text-text-primary">Your draft could not be checked.</h1><p className="mt-4 max-w-xl text-sm text-error">{persistenceError}</p><ActionButton type="button" className="mt-6" onClick={retryHydration}>Retry draft check</ActionButton></div>;

  const routeUnavailable = sessionState === "checking" || sessionState === "error" || (sessionState === "absent" && !captchaToken);
  const displayedRoute = highlightedRoute ?? initialRoute ?? selectedRoute;
  return <div>
    <p className="text-sm font-semibold text-text-secondary">Step 1 · Starting point</p>
    <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold leading-tight tracking-[-0.03em] text-text-primary sm:text-6xl">How do you want to start?</h1>
    <p className="mt-5 max-w-2xl text-sm leading-6 text-text-muted">Activate one route to establish the secure anonymous draft and continue to Artwork. This does not create or submit an order.</p>
    {sessionState === "absent" && <div className="mt-6 rounded-control border border-border bg-panel p-4"><p className="mb-3 text-sm text-text-muted" aria-live="polite">Complete the security check, then activate a route.</p><Turnstile ref={turnstileRef} siteKey={environment.NEXT_PUBLIC_TURNSTILE_SITE_KEY} onSuccess={setCaptchaToken} onExpire={() => setCaptchaToken("")} onError={() => { setCaptchaToken(""); setError("Security verification failed. Retry the challenge."); }} options={{ theme: "light" }} /></div>}
    <div role="group" aria-label="Starting route" className="mt-8 grid gap-4 md:grid-cols-2">
      {ORDER_ROUTE_OPTIONS.map((option, index) => {
        const pending = pendingRoute === option.value;
        const selected = displayedRoute === option.value;
        return <button key={option.value} type="button" aria-pressed={selected} disabled={Boolean(pendingRoute) || routeUnavailable} onClick={() => void activateRoute(option.value)} className="group min-h-11 rounded-control border border-border bg-panel p-4 text-left shadow-[var(--card-shadow)] transition-colors hover:border-primary-action hover:bg-raised aria-pressed:border-primary-action aria-pressed:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-60 sm:p-5">
          <span className="flex items-start justify-between gap-4"><span className="text-sm font-semibold text-text-muted">{String(index + 1).padStart(2, "0")}</span><span className="text-xs font-semibold text-primary-action">{pending ? "Establishing secure draft…" : selected ? "Selected" : "Choose route"}</span></span>
          <span className="mt-4 block font-display text-2xl font-semibold leading-tight text-text-primary">{option.name}</span>
          <span className="mt-3 block min-h-10 text-xs leading-5 text-text-muted">{option.description}</span>
          <span className="mt-4 block"><RouteVisual route={option.value} compact /></span>
          <span className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2"><span><span className="block text-xs font-semibold text-text-secondary">You have</span><span className="mt-1 block text-xs leading-5 text-text-muted">{option.customerHas}</span></span><span><span className="block text-xs font-semibold text-text-secondary">2040 would handle</span><span className="mt-1 block text-xs leading-5 text-text-muted">{option.studioHandles}</span></span></span>
        </button>;
      })}
    </div>
    {error && <p role="alert" className="mt-4 text-sm text-error">{error}</p>}
    {sessionState === "error" && <ActionButton type="button" variant="secondary" className="mt-4" onClick={() => void inspectSession()}>Retry session check</ActionButton>}
  </div>;
}
