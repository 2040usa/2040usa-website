import type { OrderRoute, OrderStepId } from "@/lib/order-draft/types";

export const MAX_NOTES_LENGTH = 1000;
export const MAX_CHANGE_INSTRUCTIONS_LENGTH = 1000;
export const MAX_DYNAMIC_ROWS = 20;
export const MAX_PRINT_QUANTITY = 10000;
export const MAX_PRINT_DIMENSION_INCHES = 1000;

export const ORDER_ROUTE_VALUES = ["gang-sheet", "individual-designs"] as const satisfies readonly OrderRoute[];

export const ORDER_ROUTE_OPTIONS = [
  {
    value: "gang-sheet",
    name: "Print-Ready Gang Sheet",
    description: "Upload a completed gang sheet that is already arranged at its intended print size.",
    customerHas: "A complete, dimensioned gang-sheet layout.",
    studioHandles: "Printing the supplied arrangement after the future review boundary.",
    shortLabel: "Already arranged",
  },
  {
    value: "individual-designs",
    name: "Individual Designs",
    description: "Upload separate designs and specify the print sizes and quantities you need.",
    customerHas: "One or more separate artwork files.",
    studioHandles: "Arranging the designs into a gang sheet after reviewing your requests.",
    shortLabel: "Needs arrangement",
  },
] as const satisfies readonly { value: OrderRoute; name: string; description: string; customerHas: string; studioHandles: string; shortLabel: string }[];

export const ORDER_STEPS = [
  { id: "start", number: 1, title: "Starting point", path: "/order/start" },
  { id: "artwork", number: 2, title: "Artwork", path: "/order/artwork" },
  { id: "configure", number: 3, title: "Project details", path: "/order/configure" },
  { id: "review", number: 4, title: "Review", path: "/order/review" },
] as const satisfies readonly { id: OrderStepId; number: number; title: string; path: `/order/${OrderStepId}` }[];

export const ARTWORK_GUIDANCE: Record<OrderRoute, { title: string; detail: string; checklist: readonly string[] }> = {
  "gang-sheet": {
    title: "Upload your arranged gang sheet",
    detail: "The file should already be arranged at its intended print dimensions. This workflow does not include a gang-sheet editor.",
    checklist: ["One or more arranged gang-sheet files", "Final intended width and length", "Artwork positioned as it should print"],
  },
  "individual-designs": {
    title: "Upload each individual design",
    detail: "Add every separate artwork file, then specify one or more sizes and quantities for each design.",
    checklist: ["A separate file for each design", "Transparent backgrounds where appropriate", "Sizes and quantities are entered in Project Details"],
  },
};

export function getOrderRouteOption(route: OrderRoute) {
  return ORDER_ROUTE_OPTIONS.find((option) => option.value === route)!;
}
