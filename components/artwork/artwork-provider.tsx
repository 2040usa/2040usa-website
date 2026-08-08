"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useOrderDraft, useOrderDraftPersistence } from "@/components/order/order-draft-provider";
import type { ArtworkReadiness, ArtworkUploadReservation, CanonicalArtworkRecord } from "@/lib/artwork/types";
import type { ReserveArtworkRequest } from "@/lib/artwork/schemas";
import { ArtworkRequestError, parseArtworkReservation, parseArtworkSnapshot, parseArtworkSnapshotWithDraft } from "@/lib/artwork/persistence";
import { applyCanonicalArtworkRecord, applyCanonicalArtworkSnapshot, EMPTY_ARTWORK_ORDERING_STATE } from "@/lib/artwork/canonical-ordering";
import { calculateArtworkReadiness } from "@/lib/artwork/readiness";

type ArtworkState = {
  records: CanonicalArtworkRecord[];
  readiness: ArtworkReadiness;
  state: "idle" | "loading" | "ready" | "mutating" | "error";
  error: string | null;
  recoveryTarget: CanonicalArtworkRecord | null;
  selectRecoveryTarget: (record: CanonicalArtworkRecord | null) => void;
  refresh: () => Promise<void>;
  reconcile: () => Promise<void>;
  reserve: (request: ReserveArtworkRequest) => Promise<ArtworkUploadReservation>;
  complete: (artworkId: string) => Promise<void>;
  fail: (record: Pick<CanonicalArtworkRecord, "id" | "version">) => Promise<CanonicalArtworkRecord | undefined>;
  remove: (record: Pick<CanonicalArtworkRecord, "id" | "version">) => Promise<void>;
  acknowledge: () => Promise<boolean>;
  replaceSnapshot: (records: CanonicalArtworkRecord[], readiness: ArtworkReadiness) => void;
};

const EMPTY_READINESS: ArtworkReadiness = { ready: false, uploadedCount: 0, activeCount: 0, totalDeclaredBytes: 0, totalVerifiedBytes: 0 };
const ArtworkContext = createContext<ArtworkState | null>(null);

export function ArtworkProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const draftId = useOrderDraft((state) => state.serverDraftId);
  const hydrationState = useOrderDraft((state) => state.hydrationState);
  const selectedRoute = useOrderDraft((state) => state.selectedRoute);
  const { applyServerDraft, runAfterDraftFlush, runSerialized } = useOrderDraftPersistence();
  const [records, setRecords] = useState<CanonicalArtworkRecord[]>([]);
  const [readiness, setReadiness] = useState(EMPTY_READINESS);
  const [state, setState] = useState<ArtworkState["state"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [recoveryTarget, setRecoveryTarget] = useState<CanonicalArtworkRecord | null>(null);
  const sequenceRef = useRef(0);
  const latestIssuedRef = useRef(0);
  const orderingRef = useRef(EMPTY_ARTWORK_ORDERING_STATE);
  const pendingCompletionsRef = useRef(0);

  const beginCanonicalOperation = useCallback(() => {
    const sequence = sequenceRef.current + 1;
    sequenceRef.current = sequence;
    latestIssuedRef.current = sequence;
    return sequence;
  }, []);

  const applySnapshot = useCallback((snapshot: { artwork: CanonicalArtworkRecord[]; readiness: ArtworkReadiness }, sequence = beginCanonicalOperation()) => {
    const next = applyCanonicalArtworkSnapshot(orderingRef.current, snapshot.artwork, sequence);
    orderingRef.current = next;
    setRecords(next.records);
    setReadiness(calculateArtworkReadiness(selectedRoute, next.records));
    if (pendingCompletionsRef.current === 0) setState("ready");
    setError(null);
  }, [beginCanonicalOperation, selectedRoute]);

  const applyRecord = useCallback((record: CanonicalArtworkRecord, sequence: number) => {
    const next = applyCanonicalArtworkRecord(orderingRef.current, record, sequence);
    orderingRef.current = next;
    setRecords(next.records);
    setReadiness(calculateArtworkReadiness(selectedRoute, next.records));
  }, [selectedRoute]);

  const refresh = useCallback(async () => {
    if (!draftId || !selectedRoute) { applySnapshot({ artwork: [], readiness: EMPTY_READINESS }); return; }
    const sequence = beginCanonicalOperation();
    setState("loading");
    try { applySnapshot(await parseArtworkSnapshot(await fetch(`/api/order-drafts/${draftId}/artwork`, { cache: "no-store" })), sequence); }
    catch (cause) { if (sequence === latestIssuedRef.current) { setState("error"); setError(cause instanceof Error ? cause.message : "Artwork could not be loaded."); } throw cause; }
  }, [applySnapshot, beginCanonicalOperation, draftId, selectedRoute]);

  const reconcile = useCallback(async () => {
    if (!draftId) return;
    return runAfterDraftFlush(async (draftState) => {
      if (!draftState.serverVersion) throw new Error("The durable draft version is unavailable.");
      const sequence = beginCanonicalOperation();
      setState("loading");
      try {
        const snapshot = await parseArtworkSnapshotWithDraft(await fetch(`/api/order-drafts/${draftId}/artwork/reconcile`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedDraftVersion: draftState.serverVersion }) }));
        if (snapshot.draft) applyServerDraft(snapshot.draft);
        applySnapshot(snapshot, sequence);
      } catch (cause) {
        if (cause instanceof ArtworkRequestError && cause.snapshot) {
          if (cause.snapshot.draft) applyServerDraft(cause.snapshot.draft);
          applySnapshot(cause.snapshot, sequence);
        }
        if (sequence === latestIssuedRef.current) { setState("error"); setError(cause instanceof Error ? cause.message : "Artwork could not be reconciled."); } throw cause;
      }
    });
  }, [applyServerDraft, applySnapshot, beginCanonicalOperation, draftId, runAfterDraftFlush]);

  useEffect(() => {
    if (hydrationState !== "ready") return;
    if (!draftId || !selectedRoute) {
      const frame = window.requestAnimationFrame(() => applySnapshot({ artwork: [], readiness: EMPTY_READINESS }));
      return () => window.cancelAnimationFrame(frame);
    }
    const frame = window.requestAnimationFrame(() => {
      const operation = pathname === "/order/artwork" ? reconcile : refresh;
      void operation().catch(() => undefined);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [applySnapshot, draftId, hydrationState, pathname, reconcile, refresh, selectedRoute]);

  const context = useMemo<ArtworkState>(() => ({
    records, readiness, state, error, recoveryTarget,
    selectRecoveryTarget: setRecoveryTarget,
    refresh,
    reconcile,
    reserve: async (request) => {
      if (!draftId) throw new Error("Confirm a starting point before uploading artwork.");
      const sequence = beginCanonicalOperation();
      setState("mutating");
      try {
        const reservation = await parseArtworkReservation(await fetch(`/api/order-drafts/${draftId}/artwork`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) }));
        applyRecord(reservation.artwork, sequence);
        setRecoveryTarget(null);
        if (!reservation.upload) await refresh();
        setState("ready"); setError(null); return reservation;
      } catch (cause) {
        // Reservation failures belong to one selected file. The uploader retains
        // that file and renders its retry control; duplicating the same failure as
        // provider- and step-level alerts obscures which file needs attention.
        if (sequence === latestIssuedRef.current) { setState("ready"); setError(null); }
        throw cause;
      }
    },
    complete: async (artworkId) => {
      if (!draftId) throw new Error("Draft unavailable.");
      pendingCompletionsRef.current += 1;
      setState("mutating");
      let completedSuccessfully = false;
      try {
        const replaced = await runSerialized(async () => {
          const sequence = beginCanonicalOperation();
          try {
            const snapshot = await parseArtworkSnapshotWithDraft(await fetch(`/api/artwork/${artworkId}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draftId }) }));
            if (snapshot.draft) applyServerDraft(snapshot.draft);
            const completed = snapshot.artwork.find((record) => record.id === artworkId);
            const replaced = completed?.replacementForId ? snapshot.artwork.find((record) => record.id === completed.replacementForId) : null;
            applySnapshot(snapshot, sequence);
            return replaced;
          }
          catch (cause) {
            if (cause instanceof ArtworkRequestError && cause.snapshot) {
              if (cause.snapshot.draft) applyServerDraft(cause.snapshot.draft);
              applySnapshot(cause.snapshot, sequence);
            }
            if (sequence === latestIssuedRef.current) { setState("error"); setError(cause instanceof Error ? cause.message : "Upload completion could not be verified."); } throw cause;
          }
        });
        if (replaced) {
          try {
            await runAfterDraftFlush(async (draftState) => {
              if (!draftState.serverVersion) throw new Error("The durable draft version is unavailable.");
              const deletionSequence = beginCanonicalOperation();
              const deletion = await parseArtworkSnapshotWithDraft(await fetch(`/api/artwork/${replaced.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draftId, expectedVersion: replaced.version, expectedDraftVersion: draftState.serverVersion }) }));
              if (deletion.draft) applyServerDraft(deletion.draft);
              applySnapshot(deletion, deletionSequence);
            });
          } catch (cause) {
            if (cause instanceof ArtworkRequestError && cause.snapshot) {
              if (cause.snapshot.draft) applyServerDraft(cause.snapshot.draft);
              applySnapshot(cause.snapshot, beginCanonicalOperation());
            }
            setState("error"); setError(cause instanceof Error ? cause.message : "Replacement cleanup could not be completed."); throw cause;
          }
        }
        completedSuccessfully = true;
      } finally {
        pendingCompletionsRef.current -= 1;
        if (pendingCompletionsRef.current === 0 && completedSuccessfully) setState("ready");
      }
    },
    fail: async (record) => {
      if (!draftId) return undefined;
      return runSerialized(async () => {
        const sequence = beginCanonicalOperation();
        try {
          const snapshot = await parseArtworkSnapshot(await fetch(`/api/artwork/${record.id}/fail`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draftId, expectedVersion: record.version, failureCode: "upload_failed" }) }));
          applySnapshot(snapshot, sequence);
          return snapshot.artwork.find((item) => item.id === record.id);
        } catch { await refresh(); return undefined; }
      });
    },
    remove: async (record) => {
      if (!draftId) return;
      try {
        await runAfterDraftFlush(async (draftState) => {
          if (!draftState.serverVersion) throw new Error("The durable draft version is unavailable.");
          const sequence = beginCanonicalOperation();
          setState("mutating");
          const currentSnapshot = await parseArtworkSnapshot(await fetch(`/api/order-drafts/${draftId}/artwork`, { cache: "no-store" }));
          const current = currentSnapshot.artwork.find((item) => item.id === record.id);
          if (!current) { applySnapshot(currentSnapshot, sequence); return; }
          const snapshot = await parseArtworkSnapshotWithDraft(await fetch(`/api/artwork/${record.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draftId, expectedVersion: current.version, expectedDraftVersion: draftState.serverVersion }) }));
          if (snapshot.draft) applyServerDraft(snapshot.draft);
          applySnapshot(snapshot, sequence);
        });
      } catch (cause) {
        if (cause instanceof ArtworkRequestError && cause.snapshot) {
          if (cause.snapshot.draft) applyServerDraft(cause.snapshot.draft);
          applySnapshot(cause.snapshot, beginCanonicalOperation());
        } else await refresh().catch(() => undefined);
        setError(cause instanceof Error ? cause.message : "Artwork deletion failed. Retry deletion.");
        throw cause;
      }
    },
    acknowledge: async () => {
      if (!draftId) return false;
      return runAfterDraftFlush(async (draftState) => {
        if (!draftState.serverVersion) return false;
        const sequence = beginCanonicalOperation();
        setState("mutating");
        try {
          const snapshot = await parseArtworkSnapshotWithDraft(await fetch(`/api/order-drafts/${draftId}/artwork/acknowledge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedDraftVersion: draftState.serverVersion }) }));
          if (!snapshot.draft) return false;
          applyServerDraft(snapshot.draft); applySnapshot(snapshot, sequence); return true;
        } catch (cause) {
          if (cause instanceof ArtworkRequestError && cause.snapshot) {
            if (cause.snapshot.draft) applyServerDraft(cause.snapshot.draft);
            applySnapshot(cause.snapshot, sequence);
          }
          setState("error"); setError(cause instanceof Error ? cause.message : "Artwork readiness could not be confirmed."); return false;
        }
      });
    },
    replaceSnapshot: (nextRecords, nextReadiness) => applySnapshot({ artwork: nextRecords, readiness: nextReadiness }),
  }), [applyRecord, applyServerDraft, applySnapshot, beginCanonicalOperation, draftId, error, readiness, records, reconcile, recoveryTarget, refresh, runAfterDraftFlush, runSerialized, state]);

  return <ArtworkContext.Provider value={context}>{children}</ArtworkContext.Provider>;
}

export function useArtwork() {
  const context = useContext(ArtworkContext);
  if (!context) throw new Error("useArtwork must be used within ArtworkProvider.");
  return context;
}
