import { ArrowUpRight, CopyCheck, History, RefreshCw } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { StatusBadge } from "@/components/ui/status-badge";

const referenceRows = [
  { icon: CopyCheck, label: "Artwork file", value: "westside-mark-v4.png" },
  { icon: History, label: "Requested variants", value: "3 sizes with separate quantities" },
  { icon: RefreshCw, label: "Sizing intent", value: "Width, height, or original size" },
] as const;

export function RepeatBusinessPanel() {
  return (
    <section className="rounded-control border border-border bg-panel p-5 shadow-[var(--card-shadow)] sm:p-6" aria-labelledby="repeat-heading">
      <SectionLabel>File-linked details</SectionLabel>
      <h2 id="repeat-heading" className="mt-5 font-display text-3xl font-semibold leading-tight text-text-primary sm:text-4xl">Keep every size tied to the right design.</h2>
      <p className="mt-5 text-sm leading-6 text-text-muted">Each uploaded individual design has its own sizes, quantities, and optional requested-change instructions.</p>
      <div className="mt-6 rounded-control border border-border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4"><p className="font-display text-xl font-semibold text-text-primary">Example project</p><StatusBadge tone="accent">Preview</StatusBadge></div>
        {referenceRows.map(({ icon: Icon, label, value }) => <div key={label} className="grid grid-cols-[auto_1fr] gap-3 border-b border-border py-4 last:border-0"><Icon aria-hidden="true" className="mt-0.5 text-primary-action" size={17} /><div><p className="text-xs font-semibold text-text-secondary">{label}</p><p className="mt-1 text-xs text-text-primary">{value}</p></div></div>)}
      </div>
      <a href="#experience" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary-action hover:text-primary-action-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring">View experience preview <ArrowUpRight aria-hidden="true" size={14} /></a>
    </section>
  );
}
