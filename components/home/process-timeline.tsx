import { ArrowRight } from "lucide-react";
import { processSteps } from "@/lib/homepage-data";
import { IconContainer } from "@/components/ui/icon-container";
import { SectionHeading } from "@/components/ui/section-heading";
import { SectionLabel } from "@/components/ui/section-label";

export function ProcessTimeline() {
  return (
    <section id="process" className="section-space border-b border-border bg-raised" aria-labelledby="process-heading">
      <div className="page-shell">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><SectionLabel>Four draft steps</SectionLabel><SectionHeading id="process-heading" className="mt-5">How it works.</SectionHeading></div>
          <p className="max-w-md text-sm leading-6 text-text-muted">The active website collects artwork and project details into a saved draft. Later commercial and production steps are not yet available here.</p>
        </div>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {processSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="relative min-h-56 rounded-control border border-border bg-panel p-5">
                <div className="flex items-start justify-between"><IconContainer className="size-10 bg-panel"><Icon aria-hidden="true" size={18} strokeWidth={1.5} /></IconContainer><span className="font-display text-3xl text-border">{String(index + 1).padStart(2, "0")}</span></div>
                <h3 className="mt-10 font-display text-xl font-semibold text-text-primary">{step.title}</h3>
                <p className="mt-3 text-xs leading-5 text-text-muted">{step.detail}</p>
                {index < processSteps.length - 1 && <ArrowRight aria-hidden="true" className="absolute -right-5 top-1/2 z-10 hidden rounded-full border border-border bg-raised p-1 text-primary-action xl:block" size={24} />}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
