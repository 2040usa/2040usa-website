"use client";

import { useEffect } from "react";
import type { FieldValues, UseFormWatch } from "react-hook-form";
import type { OrderRoute, WorkingOrderConfiguration } from "@/lib/order-draft/types";
import { useOrderDraft } from "@/components/order/order-draft-provider";

export function useWorkingConfiguration<TValues extends FieldValues & WorkingOrderConfiguration>(
  route: OrderRoute,
  watch: UseFormWatch<TValues>,
) {
  const saveWorkingConfiguration = useOrderDraft((state) => state.saveWorkingConfiguration);

  useEffect(() => {
    const subscription = watch((values) => {
      if (values.route === route) {
        saveWorkingConfiguration(values as WorkingOrderConfiguration);
      }
    });
    return () => subscription.unsubscribe();
  }, [route, saveWorkingConfiguration, watch]);
}
