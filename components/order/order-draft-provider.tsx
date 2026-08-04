"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createOrderDraftStore, type OrderDraftStore } from "@/lib/order-draft/store";
import { canonicalOrderDraftSchema, clientSnapshotForServer, parseCurrentDraftResponse } from "@/lib/order-draft/durable";
import type { CanonicalOrderDraft, OrderRoute } from "@/lib/order-draft/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { inspectBrowserSession } from "@/lib/supabase/session-inspection";

type OrderDraftStoreApi = ReturnType<typeof createOrderDraftStore>;
const OrderDraftContext = createContext<OrderDraftStoreApi | null>(null);

type PersistenceActions = {
  bootstrap: (route: OrderRoute, captchaToken: string) => Promise<void>;
  flush: () => Promise<boolean>;
  reset: () => Promise<void>;
  reloadLatest: () => Promise<void>;
  retry: () => void;
  retryHydration: () => void;
  runSerialized: <T>(operation: () => Promise<T>) => Promise<T>;
  runAfterDraftFlush: <T>(operation: (state: OrderDraftStore) => Promise<T>) => Promise<T>;
  applyServerDraft: (draft: CanonicalOrderDraft) => void;
};
const PersistenceContext = createContext<PersistenceActions | null>(null);

function snapshotKey(state: OrderDraftStore | CanonicalOrderDraft) {
  return JSON.stringify({
    selectedRoute: state.selectedRoute,
    startingPointConfirmed: state.startingPointConfirmed,
    artworkAcknowledged: state.artworkAcknowledged,
    workingConfiguration: state.workingConfiguration,
    configuration: state.configuration,
  });
}

async function readResponseBody(response: Response) {
  try {
    return await response.json() as unknown;
  } catch {
    throw new Error("The draft service returned malformed JSON.");
  }
}

async function responseDraft(response: Response) {
  const body = await readResponseBody(response);
  const error = body && typeof body === "object" && "error" in body ? (body as { error?: { code?: string; message?: string } }).error : undefined;
  const result = body && typeof body === "object" && "draft" in body ? canonicalOrderDraftSchema.safeParse((body as { draft: unknown }).draft) : null;
  if (!response.ok) throw Object.assign(new Error(error?.message ?? "Draft request failed."), { status: response.status, code: error?.code, draft: result?.success ? result.data : null });
  if (!result?.success) throw new Error("The draft service returned an invalid draft.");
  return result.data;
}

async function currentDraftRequest() {
  const response = await fetch("/api/order-drafts/current", { cache: "no-store" });
  const parsed = parseCurrentDraftResponse(response.status, await readResponseBody(response));
  return parsed.kind === "draft" ? parsed.draft : null;
}

function usePersistence(store: OrderDraftStoreApi): PersistenceActions {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutationTail = useRef<Promise<void>>(Promise.resolve());
  const hydrationStarted = useRef(false);
  const persistedKey = useRef("");
  const flushRef = useRef<() => Promise<boolean>>(async () => false);

  const cancelDebounce = useCallback(() => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const coordinateMutation = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const result = mutationTail.current.then(operation, operation);
    mutationTail.current = result.then(() => undefined, () => undefined);
    return result;
  }, []);

  const applyCanonical = useCallback((draft: CanonicalOrderDraft | null) => {
    persistedKey.current = draft ? snapshotKey(draft) : snapshotKey({ ...store.getState(), selectedRoute: null, startingPointConfirmed: false, artworkAcknowledged: false, workingConfiguration: null, configuration: null });
    store.getState().hydrateDurableDraft(draft);
  }, [store]);

  const saveOnce = useCallback(async () => {
    const state = store.getState();
    if (!state.serverDraftId || !state.serverVersion || state.hydrationState !== "ready" || state.saveState === "conflict") return false;
    const key = snapshotKey(state);
    if (key === persistedKey.current) return true;
    state.markSaving();
    try {
      const response = await fetch(`/api/order-drafts/${state.serverDraftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientSnapshotForServer(state, state.serverVersion)),
      });
      if (response.status === 409) {
        store.getState().markConflict();
        return false;
      }
      const draft = await responseDraft(response);
      persistedKey.current = key;
      store.getState().markSaveSuccess(draft.version, draft.updatedAt);
      return true;
    } catch (error) {
      store.getState().markSaveError(error instanceof Error ? error.message : "Unable to save the draft.");
      return false;
    }
  }, [store]);

  const flushWithinMutation = useCallback(async () => {
    cancelDebounce();
    while (true) {
      const state = store.getState();
      if (!state.serverDraftId) return state.hydrationState === "ready";
      if (state.hydrationState !== "ready" || state.saveState === "conflict") return false;
      if (snapshotKey(state) === persistedKey.current) return true;
      if (!await saveOnce()) return false;
    }
  }, [cancelDebounce, saveOnce, store]);

  const flush = useCallback(() => coordinateMutation(flushWithinMutation), [coordinateMutation, flushWithinMutation]);

  const runAfterDraftFlush = useCallback(<T,>(operation: (state: OrderDraftStore) => Promise<T>) => coordinateMutation(async () => {
    cancelDebounce();
    if (!await flushWithinMutation()) {
      throw new Error(store.getState().persistenceError ?? "The latest draft changes could not be saved.");
    }
    return operation(store.getState());
  }), [cancelDebounce, coordinateMutation, flushWithinMutation, store]);

  useEffect(() => { flushRef.current = flush; }, [flush]);

  const hydrate = useCallback(async () => {
    store.getState().beginHydration();
    try {
      applyCanonical(await currentDraftRequest());
    } catch (error) {
      store.getState().markHydrationError(error instanceof Error ? error.message : "The stored draft could not be checked.");
    }
  }, [applyCanonical, store]);

  useEffect(() => {
    if (!hydrationStarted.current) {
      hydrationStarted.current = true;
      void hydrate();
    }
    const unsubscribe = store.subscribe((state) => {
      if (state.hydrationState !== "ready" || !state.serverDraftId || state.saveState === "conflict") return;
      if (snapshotKey(state) === persistedKey.current) return;
      state.markPending();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flushRef.current(), 650);
    });
    return () => { unsubscribe(); if (timer.current) clearTimeout(timer.current); };
  }, [hydrate, store]);

  return useMemo(() => ({
    bootstrap: (route: OrderRoute, captchaToken: string) => runAfterDraftFlush(async (flushedState) => {
      if (flushedState.serverDraftId && flushedState.selectedRoute === route && flushedState.startingPointConfirmed) {
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const session = await inspectBrowserSession(supabase);
      if (session.kind === "error") throw new Error(session.message);
      if (session.kind === "absent") {
        const result = await supabase.auth.signInAnonymously({ options: { captchaToken } });
        if (result.error) throw new Error(result.error.message);
      }

      const latestState = store.getState();
      const body = latestState.serverDraftId && latestState.serverVersion
        ? { selectedRoute: route, expectedVersion: latestState.serverVersion }
        : { selectedRoute: route };
      const response = await fetch("/api/order-drafts/bootstrap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (response.status === 409) store.getState().markConflict();
      try {
        applyCanonical(await responseDraft(response));
      } catch (error) {
        const canonical = error && typeof error === "object" && "draft" in error ? (error as { draft?: CanonicalOrderDraft | null }).draft : null;
        if (canonical) applyCanonical(canonical);
        throw error;
      }
    }),
    flush,
    reset: () => runAfterDraftFlush(async (state) => {
      if (!state.serverDraftId || !state.serverVersion) { state.resetDraft(); return; }
      try {
        const response = await fetch(`/api/order-drafts/${state.serverDraftId}/reset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: state.serverVersion }) });
        if (response.status === 409) store.getState().markConflict();
        const draft = await responseDraft(response);
        applyCanonical(draft);
      } catch (error) {
        const canonical = error && typeof error === "object" && "draft" in error ? (error as { draft?: CanonicalOrderDraft | null }).draft : null;
        if (canonical) applyCanonical(canonical);
        throw error;
      }
    }),
    reloadLatest: () => coordinateMutation(async () => {
      cancelDebounce();
      const draft = await currentDraftRequest();
      if (!draft) throw new Error("The latest draft is unavailable.");
      applyCanonical(draft);
      window.location.reload();
    }),
    retry: () => { void flush(); },
    retryHydration: () => { void hydrate(); },
    runSerialized: coordinateMutation,
    runAfterDraftFlush,
    applyServerDraft: applyCanonical,
  }), [applyCanonical, cancelDebounce, coordinateMutation, flush, hydrate, runAfterDraftFlush, store]);
}

function PersistenceProvider({ store, children }: { store: OrderDraftStoreApi; children: ReactNode }) {
  const actions = usePersistence(store);
  return <PersistenceContext.Provider value={actions}>{children}</PersistenceContext.Provider>;
}

export function OrderDraftProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createOrderDraftStore);
  return <OrderDraftContext.Provider value={store}><PersistenceProvider store={store}>{children}</PersistenceProvider></OrderDraftContext.Provider>;
}

export function useOrderDraft<T>(selector: (state: OrderDraftStore) => T) {
  const store = useContext(OrderDraftContext);
  if (!store) throw new Error("useOrderDraft must be used within OrderDraftProvider.");
  return useStore(store, selector);
}

export function useOrderDraftPersistence() {
  const actions = useContext(PersistenceContext);
  if (!actions) throw new Error("useOrderDraftPersistence must be used within OrderDraftProvider.");
  return actions;
}
