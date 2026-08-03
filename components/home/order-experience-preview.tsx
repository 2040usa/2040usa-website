import { Check, FileImage, Ruler } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { StatusBadge } from "@/components/ui/status-badge";

const orderSteps = ["Choose route", "Add artwork", "Set quantities", "Review request"];

export function OrderExperiencePreview() {
  return (
    <section id="experience" className="min-w-0 rounded-control border border-border bg-panel" aria-labelledby="experience-heading">
      <div className="border-b border-border p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><SectionLabel>Order experience</SectionLabel><h2 id="experience-heading" className="mt-4 font-display text-3xl uppercase text-text-primary sm:text-4xl">A clear route from file to pickup.</h2></div><StatusBadge tone="accent">Non-functional preview</StatusBadge></div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-text-muted">This demonstration cannot upload files, calculate prices, submit requests, or place orders.</p>
      </div>
      <div className="grid md:grid-cols-[0.72fr_1.28fr]">
        <aside className="border-b border-border p-4 md:border-b-0 md:border-r" aria-label="Example order steps">
          <ol className="space-y-2">{orderSteps.map((step, index) => <li key={step} className={`flex items-center gap-3 rounded-control border p-3 text-xs ${index === 1 ? "border-accent text-text-primary" : "border-border text-text-muted"}`}><span className={`grid size-6 place-items-center font-mono text-[0.58rem] ${index === 0 ? "bg-success text-background" : index === 1 ? "bg-accent text-accent-foreground" : "border border-border"}`}>{index === 0 ? <Check aria-hidden="true" size={13} /> : index + 1}</span>{step}</li>)}</ol>
        </aside>
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between"><div><p className="font-mono text-[0.58rem] uppercase tracking-widest text-accent">Example artwork 01</p><h3 className="mt-2 font-display text-2xl uppercase text-text-primary">Front graphic</h3></div><FileImage aria-hidden="true" className="text-text-muted" size={29} strokeWidth={1} /></div>
          <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-control border border-border p-3"><Ruler aria-hidden="true" className="mb-4 text-accent" size={17} /><p className="font-mono text-[0.53rem] uppercase tracking-widest text-text-muted">Example width</p><p className="mt-2 text-base text-text-primary">11.5 in</p></div><div className="rounded-control border border-border p-3"><p className="font-mono text-[0.53rem] uppercase tracking-widest text-text-muted">Example quantity</p><p className="mt-8 text-base text-text-primary">24 pieces</p></div></div>
          <div className="mt-5 rounded-control border border-dashed border-border px-4 py-3 font-mono text-[0.58rem] uppercase tracking-widest text-text-muted" aria-label="Static preview only">Interactive prototype available from Start a Print</div>
        </div>
      </div>
    </section>
  );
}
