import { createStore } from "zustand/vanilla";
import type { OrderConfiguration, OrderDraftSnapshot, OrderRoute, WorkingOrderConfiguration } from "@/lib/order-draft/types";
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
  selectRoute: (route: OrderRoute) => void;
  confirmStartingPoint: () => void;
  acknowledgeArtwork: () => void;
  saveWorkingConfiguration: (configuration: WorkingOrderConfiguration) => void;
  saveConfiguration: (configuration: OrderConfiguration) => void;
  resetDraft: () => void;
};

export function createOrderDraftStore() {
  return createStore<OrderDraftStore>()((set) => ({
    ...initialOrderDraft,
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
    resetDraft: () => set(initialOrderDraft),
  }));
}
