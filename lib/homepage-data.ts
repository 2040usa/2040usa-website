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

export const workflowOptions = [
  { title: "Print-ready gang sheet", description: "Your layout is built, sized, and ready for artwork review.", meta: "Fastest route", preview: "gang-sheet", icon: Layers3 },
  { title: "Separate artwork", description: "Send individual transparent files to organize into a run.", meta: "Flexible setup", preview: "artwork", icon: FileCheck2 },
  { title: "Transfers by size", description: "Choose dimensions and quantities for each transfer design.", meta: "Simple repeats", preview: "sizes", icon: ScanLine },
  { title: "Full apparel project", description: "Bring the garments, art, and count to map the project scope.", meta: "End-to-end", preview: "apparel", icon: Shirt },
] as const;

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
