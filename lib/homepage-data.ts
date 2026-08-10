import {
  FileCheck2,
  Layers3,
  Upload,
} from "lucide-react";
import { ORDER_ROUTE_OPTIONS } from "@/lib/order-draft/constants";
import type { OrderRoute } from "@/lib/order-draft/types";

const routeIcons = { "gang-sheet": Layers3, "individual-designs": FileCheck2 } satisfies Record<OrderRoute, typeof Layers3>;

export const workflowOptions = ORDER_ROUTE_OPTIONS.map((option) => ({
  route: option.value,
  title: option.name,
  description: option.description,
  meta: option.shortLabel,
  icon: routeIcons[option.value],
}));

export const processSteps = [
  { title: "Choose a route", detail: "Start with an arranged gang sheet or individual designs.", icon: Layers3 },
  { title: "Artwork & Layout", detail: "Upload files, configure each artwork, and review the current layout preview.", icon: Upload },
  { title: "Review draft", detail: "Check the saved draft before this prototype ends.", icon: Layers3 },
] as const;

export const services = [
  { title: "Print-ready gang sheets", detail: "Upload a completed arrangement at its intended size.", icon: Layers3 },
  { title: "Individual design arrangement", detail: "Provide separate files, sizes, and quantities for later review.", icon: Layers3 },
  { title: "Requested artwork changes", detail: "Describe changes for each design without implying approval or a fee.", icon: FileCheck2 },
] as const;

export function getProcessStepNumbers() {
  return processSteps.map((_, index) => String(index + 1).padStart(2, "0"));
}
