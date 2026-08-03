import type { OrderRoute, OrderStepId } from "@/lib/order-draft/types";

export const MAX_NOTES_LENGTH = 1000;
export const MAX_DYNAMIC_ROWS = 20;

export const ORDER_ROUTE_VALUES = [
  "gang-sheet",
  "separate-artwork",
  "transfers-by-size",
  "full-apparel",
] as const satisfies readonly OrderRoute[];

export const ORDER_ROUTE_OPTIONS = [
  {
    value: "gang-sheet",
    name: "Print-ready gang sheet",
    description: "Start with a gang sheet already arranged at its intended print size.",
    customerHas: "A complete, dimensioned gang-sheet layout.",
    studioHandles: "Artwork review and the later production workflow.",
    shortLabel: "Fastest route",
  },
  {
    value: "separate-artwork",
    name: "Separate artwork",
    description: "Plan a run from individual transparent design files.",
    customerHas: "One or more individual designs and target widths.",
    studioHandles: "Collecting each design separately and organizing the run.",
    shortLabel: "Flexible setup",
  },
  {
    value: "transfers-by-size",
    name: "Transfers by size",
    description: "Use one design across multiple widths and quantities.",
    customerHas: "One design plus the sizes and counts needed.",
    studioHandles: "Collecting the size breakdown for later artwork processing.",
    shortLabel: "Simple repeats",
  },
  {
    value: "full-apparel",
    name: "Full apparel project",
    description: "Describe artwork, garments, placements, and estimated quantity together.",
    customerHas: "A project idea, garment direction, and placement needs.",
    studioHandles: "Reviewing the project scope before any work is accepted.",
    shortLabel: "End-to-end scope",
  },
] as const satisfies readonly {
  value: OrderRoute;
  name: string;
  description: string;
  customerHas: string;
  studioHandles: string;
  shortLabel: string;
}[];

export const ORDER_STEPS = [
  { id: "start", number: 1, title: "Starting point", path: "/order/start" },
  { id: "artwork", number: 2, title: "Artwork", path: "/order/artwork" },
  { id: "configure", number: 3, title: "Project details", path: "/order/configure" },
  { id: "review", number: 4, title: "Review", path: "/order/review" },
] as const satisfies readonly {
  id: OrderStepId;
  number: number;
  title: string;
  path: `/order/${OrderStepId}`;
}[];

export const ARTWORK_GUIDANCE: Record<OrderRoute, { title: string; detail: string; checklist: readonly string[] }> = {
  "gang-sheet": {
    title: "Prepare the arranged gang sheet",
    detail: "The future upload should already be arranged at its intended print dimensions.",
    checklist: ["One arranged sheet file", "Final intended width and length", "Artwork positioned as it should print"],
  },
  "separate-artwork": {
    title: "Prepare each design separately",
    detail: "Individual transparent design files will be uploaded and configured one by one.",
    checklist: ["A separate file for each design", "Transparent backgrounds where appropriate", "A target print width for every design"],
  },
  "transfers-by-size": {
    title: "Prepare one design and its size plan",
    detail: "One design may be requested at multiple widths and quantities.",
    checklist: ["One primary design file", "Every required print width", "A quantity for each width"],
  },
  "full-apparel": {
    title: "Prepare the complete project context",
    detail: "Artwork, garment details, and requested print placements will be collected together.",
    checklist: ["Available artwork or a clear design direction", "Garment sourcing preference", "Placement and estimated quantity"],
  },
};

export function getOrderRouteOption(route: OrderRoute) {
  return ORDER_ROUTE_OPTIONS.find((option) => option.value === route)!;
}
