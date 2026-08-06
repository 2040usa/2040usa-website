import { Check, FileImage, Ruler } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { StatusBadge } from "@/components/ui/status-badge";

const orderSteps = ["Choose route", "Add artwork", "Set sizes and quantities", "Review draft"];

export function OrderExperiencePreview() {
  return (
    <section id="experience" className="min-w-0 rounded-control border border-border bg-panel shadow-[var(--card-shadow)]" aria-labelledby="experience-heading">
      <div className="border-b border-border p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><SectionLabel>Draft experience</SectionLabel><h2 id="experience-heading" className="mt-4 font-display text-3xl font-semibold text-text-primary sm:text-4xl">A clear route from artwork to saved details.</h2></div><StatusBadge tone="accent">Example</StatusBadge></div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-text-muted">This static example shows the current draft steps. Use Start a Print for the working artwork upload experience.</p>
      </div>
      <div className="grid md:grid-cols-[0.72fr_1.28fr]">
        <aside className="border-b border-border p-4 md:border-b-0 md:border-r" aria-label="Example order steps">
          <ol className="space-y-2">{orderSteps.map((step, index) => <li key={step} className={`flex items-center gap-3 rounded-control border p-3 text-xs ${index === 1 ? "border-primary-action bg-raised text-text-primary" : "border-border text-text-muted"}`}><span className={`grid size-6 place-items-center rounded-full text-[0.68rem] ${index === 0 ? "bg-success text-white" : index === 1 ? "bg-primary-action text-primary-action-foreground" : "border border-border"}`}>{index === 0 ? <Check aria-hidden="true" size={13} /> : index + 1}</span>{step}</li>)}</ol>
        </aside>
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-text-secondary">Example artwork</p><h3 className="mt-2 font-display text-2xl font-semibold text-text-primary">Front graphic</h3></div><FileImage aria-hidden="true" className="text-text-muted" size={29} strokeWidth={1} /></div>
          <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-control border border-border bg-raised p-3"><Ruler aria-hidden="true" className="mb-4 text-primary-action" size={17} /><p className="text-xs text-text-muted">Set by width</p><p className="mt-2 text-base text-text-primary">11.5 in</p></div><div className="rounded-control border border-border bg-raised p-3"><p className="text-xs text-text-muted">Example quantity</p><p className="mt-8 text-base text-text-primary">24 pieces</p></div></div>
          <div className="mt-5 rounded-control border border-dashed border-border px-4 py-3 text-xs text-text-muted" aria-label="Static preview only">Working upload controls are available from Start a Print</div>
        </div>
      </div>
    </section>
  );
}
