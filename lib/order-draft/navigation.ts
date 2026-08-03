import { ORDER_STEPS } from "@/lib/order-draft/constants";
import { orderRouteSchema } from "@/lib/order-draft/schemas";
import type { OrderDraftSnapshot, OrderStepId } from "@/lib/order-draft/types";

type GuardDraft = Pick<OrderDraftSnapshot, "selectedRoute" | "startingPointConfirmed" | "artworkAcknowledged" | "configuration">;

export function parseOrderRouteQuery(value: unknown) {
  if (typeof value !== "string") return null;
  const result = orderRouteSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function getEarliestIncompleteStep(draft: GuardDraft): OrderStepId {
  if (!draft.selectedRoute || !draft.startingPointConfirmed) return "start";
  if (!draft.artworkAcknowledged) return "artwork";
  if (!draft.configuration || draft.configuration.route !== draft.selectedRoute) return "configure";
  return "review";
}

export function getGuardRedirect(currentStep: OrderStepId, draft: GuardDraft) {
  const earliestStep = getEarliestIncompleteStep(draft);
  const currentIndex = ORDER_STEPS.findIndex((step) => step.id === currentStep);
  const earliestIndex = ORDER_STEPS.findIndex((step) => step.id === earliestStep);
  return currentIndex > earliestIndex
    ? ORDER_STEPS[earliestIndex].path
    : null;
}
