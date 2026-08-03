"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createOrderDraftStore, type OrderDraftStore } from "@/lib/order-draft/store";

type OrderDraftStoreApi = ReturnType<typeof createOrderDraftStore>;
const OrderDraftContext = createContext<OrderDraftStoreApi | null>(null);

export function OrderDraftProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createOrderDraftStore);
  return <OrderDraftContext.Provider value={store}>{children}</OrderDraftContext.Provider>;
}

export function useOrderDraft<T>(selector: (state: OrderDraftStore) => T) {
  const store = useContext(OrderDraftContext);
  if (!store) throw new Error("useOrderDraft must be used within OrderDraftProvider.");
  return useStore(store, selector);
}
