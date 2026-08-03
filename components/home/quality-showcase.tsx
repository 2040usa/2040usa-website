import { Check, Crosshair } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";

const checks = ["Artwork dimensions reviewed", "Registration and finish checked", "Pickup handoff confirmed"];

export function QualityShowcase() {
  return (
    <section id="quality" className="bg-panel p-5 sm:p-6" aria-labelledby="quality-heading">
      <SectionLabel>Our quality</SectionLabel>
      <h2 id="quality-heading" className="mt-5 font-display text-3xl uppercase leading-[0.95] text-text-primary sm:text-4xl">Production checks at the points that matter.</h2>
      <div className="technical-grid relative mt-6 min-h-40 overflow-hidden border border-border bg-background" aria-hidden="true">
        <span className="absolute left-1/2 top-0 h-full w-px bg-border" /><span className="absolute left-0 top-1/2 h-px w-full bg-border" />
        <Crosshair className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-accent" size={92} strokeWidth={0.65} />
        <div className="absolute bottom-3 left-3 right-3 grid grid-cols-3 gap-1"><span className="h-5 bg-accent" /><span className="h-5 bg-text-primary" /><span className="h-5 bg-registration-red" /></div>
      </div>
      <ul className="mt-5 divide-y divide-border border-y border-border">
        {checks.map((item) => <li key={item} className="flex items-center gap-3 py-3 text-xs text-text-muted"><Check aria-hidden="true" className="shrink-0 text-accent" size={15} />{item}</li>)}
      </ul>
      <p className="mt-4 font-mono text-[0.55rem] uppercase tracking-widest text-text-muted">Exact checks depend on artwork and material.</p>
    </section>
  );
}
