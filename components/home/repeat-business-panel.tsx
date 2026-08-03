import { ArrowUpRight, CopyCheck, History, RefreshCw } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { StatusBadge } from "@/components/ui/status-badge";

const referenceRows = [
  { icon: CopyCheck, label: "Artwork reference", value: "westside-mark-v4.png" },
  { icon: History, label: "Previous setup", value: "48 pieces / 3 sizes" },
  { icon: RefreshCw, label: "Future route", value: "Reuse setup, confirm quantity" },
] as const;

export function RepeatBusinessPanel() {
  return (
    <section className="bg-panel p-5 sm:p-6" aria-labelledby="repeat-heading">
      <SectionLabel>Built for repeat business</SectionLabel>
      <h2 id="repeat-heading" className="mt-5 font-display text-3xl uppercase leading-[0.95] text-text-primary sm:text-4xl">Keep approved project context together.</h2>
      <p className="mt-5 text-sm leading-6 text-text-muted">A future repeat-order flow can reference prior artwork and production notes after account features are approved.</p>
      <div className="mt-6 rounded-control border border-border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4"><p className="font-display text-xl uppercase text-text-primary">Example project</p><StatusBadge tone="accent">Preview</StatusBadge></div>
        {referenceRows.map(({ icon: Icon, label, value }) => <div key={label} className="grid grid-cols-[auto_1fr] gap-3 border-b border-border py-4 last:border-0"><Icon aria-hidden="true" className="mt-0.5 text-accent" size={17} /><div><p className="font-mono text-[0.54rem] uppercase tracking-widest text-text-muted">{label}</p><p className="mt-1 text-xs text-text-primary">{value}</p></div></div>)}
      </div>
      <a href="#experience" className="mt-5 inline-flex items-center gap-2 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-text-primary hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">View experience preview <ArrowUpRight aria-hidden="true" size={14} /></a>
    </section>
  );
}
