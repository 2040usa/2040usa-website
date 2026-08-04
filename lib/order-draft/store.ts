import { createStore } from "zustand/vanilla";
import type { CanonicalOrderDraft, DraftHydrationState, DraftSaveState, OrderConfiguration, OrderDraftSnapshot, OrderRoute, WorkingOrderConfiguration } from "@/lib/order-draft/types";
import { toWorkingConfiguration } from "@/lib/order-draft/working-configuration";

export const initialOrderDraft: OrderDraftSnapshot = {
  selectedRoute: null,
  startingPointConfirmed: false,
  artworkAcknowledged: false,
  workingConfiguration: null,
  configuration: null,
  lastCompletedStep: 0,
};

export type OrderDraftStore = OrderDraftSnapshot & {
  serverDraftId: string | null;
  serverVersion: number | null;
  hydrationState: DraftHydrationState;
  saveState: DraftSaveState;
  lastSavedAt: string | null;
  persistenceError: string | null;
  selectRoute: (route: OrderRoute) => void;
  confirmStartingPoint: () => void;
  acknowledgeArtwork: () => void;
  saveWorkingConfiguration: (configuration: WorkingOrderConfiguration) => void;
  saveConfiguration: (configuration: OrderConfiguration) => void;
  resetDraft: () => void;
  hydrateDurableDraft: (draft: CanonicalOrderDraft | null) => void;
  beginHydration: () => void;
  markHydrationError: (message: string) => void;
  markSaving: () => void;
  markPending: () => void;
  markSaveSuccess: (version: number, updatedAt: string) => void;
  markSaveError: (message: string) => void;
  markConflict: () => void;
};

export function createOrderDraftStore() {
  return createStore<OrderDraftStore>()((set) => ({
    ...initialOrderDraft,
    serverDraftId: null,
    serverVersion: null,
    hydrationState: "initializing",
    saveState: "idle",
    lastSavedAt: null,
    persistenceError: null,
    selectRoute: (route) => set((state) => state.selectedRoute === route
      ? state
      : {
          selectedRoute: route,
          startingPointConfirmed: false,
          artworkAcknowledged: false,
          workingConfiguration: null,
          configuration: null,
          lastCompletedStep: 0,
        }),
    confirmStartingPoint: () => set((state) => state.selectedRoute
      ? { ...state, startingPointConfirmed: true, lastCompletedStep: Math.max(state.lastCompletedStep, 1) as 1 | 2 | 3 }
      : state),
    acknowledgeArtwork: () => set((state) => state.selectedRoute
      ? { ...state, artworkAcknowledged: true, lastCompletedStep: Math.max(state.lastCompletedStep, 2) as 2 | 3 }
      : state),
    saveWorkingConfiguration: (workingConfiguration) => set((state) => state.selectedRoute === workingConfiguration.route
      ? { workingConfiguration }
      : state),
    saveConfiguration: (configuration) => set((state) => state.selectedRoute === configuration.route
      ? { configuration, workingConfiguration: toWorkingConfiguration(configuration), lastCompletedStep: 3 }
      : state),
    resetDraft: () => set((state) => ({ ...initialOrderDraft, serverDraftId: state.serverDraftId, serverVersion: state.serverVersion, hydrationState: "ready", saveState: "idle", lastSavedAt: null, persistenceError: null })),
    hydrateDurableDraft: (draft) => set(draft ? {
      selectedRoute: draft.selectedRoute,
      startingPointConfirmed: draft.startingPointConfirmed,
      artworkAcknowledged: draft.artworkAcknowledged,
      workingConfiguration: draft.workingConfiguration,
      configuration: draft.configuration,
      lastCompletedStep: draft.lastCompletedStep,
      serverDraftId: draft.id,
      serverVersion: draft.version,
      hydrationState: "ready",
      saveState: "saved",
      lastSavedAt: draft.updatedAt,
      persistenceError: null,
    } : {
      ...initialOrderDraft,
      serverDraftId: null,
      serverVersion: null,
      hydrationState: "ready",
      saveState: "idle",
      lastSavedAt: null,
      persistenceError: null,
    }),
    beginHydration: () => set({ hydrationState: "initializing", persistenceError: null }),
    markHydrationError: (persistenceError) => set({ hydrationState: "error", saveState: "error", persistenceError }),
    markSaving: () => set({ saveState: "saving", persistenceError: null }),
    markPending: () => set((state) => state.saveState === "saved" ? { saveState: "idle" } : state),
    markSaveSuccess: (serverVersion, lastSavedAt) => set({ serverVersion, lastSavedAt, saveState: "saved", persistenceError: null }),
    markSaveError: (persistenceError) => set({ saveState: "error", persistenceError }),
    markConflict: () => set({ saveState: "conflict", persistenceError: "A newer server draft exists." }),
  }));
}
