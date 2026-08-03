import {
  Boxes,
  CheckCircle2,
  FileCheck2,
  Layers3,
  PackageCheck,
  Printer,
  ScanLine,
  Scissors,
  Shirt,
  Sparkles,
  Upload,
} from "lucide-react";
import { ORDER_ROUTE_OPTIONS } from "@/lib/order-draft/constants";
import type { OrderRoute } from "@/lib/order-draft/types";

const routeIcons = { "gang-sheet": Layers3, "separate-artwork": FileCheck2, "transfers-by-size": ScanLine, "full-apparel": Shirt } satisfies Record<OrderRoute, typeof Layers3>;

export const workflowOptions = ORDER_ROUTE_OPTIONS.map((option) => ({
  route: option.value,
  title: option.name,
  description: option.description,
  meta: option.shortLabel,
  icon: routeIcons[option.value],
}));

export const processSteps = [
  { title: "Upload", detail: "Send your artwork and project notes.", icon: Upload },
  { title: "Artwork check", detail: "We inspect size, resolution, and transparency.", icon: FileCheck2 },
  { title: "Print", detail: "Approved artwork moves into the print queue.", icon: Printer },
  { title: "Cure", detail: "Ink and adhesive move through the curing stage.", icon: Sparkles },
  { title: "Quality check", detail: "Registration, color, and finish are reviewed.", icon: CheckCircle2 },
  { title: "Pickup", detail: "Packed, labeled, and ready in Downtown LA.", icon: PackageCheck },
] as const;

export const services = [
  { title: "Gang sheet setup", detail: "Clean nesting and spacing for efficient production.", icon: Boxes },
  { title: "Artwork cleanup", detail: "Practical file preparation for sharper transfers.", icon: Scissors },
  { title: "Apparel application", detail: "Consistent placement and pressing for finished goods.", icon: Shirt },
] as const;

export function getProcessStepNumbers() {
  return processSteps.map((_, index) => String(index + 1).padStart(2, "0"));
}
