import { workflowOptions } from "@/lib/homepage-data";
import { SectionHeading } from "@/components/ui/section-heading";
import { SectionLabel } from "@/components/ui/section-label";
import { WorkflowCard } from "@/components/home/workflow-card";

export function WorkflowSelector() {
  return (
    <section id="options" className="section-space border-b border-border" aria-labelledby="options-heading">
      <div className="page-shell">
        <div className="grid gap-7 lg:grid-cols-2 lg:items-end">
          <div><SectionLabel>Choose your starting point</SectionLabel><SectionHeading id="options-heading" className="mt-6">Start with<br />what you have.</SectionHeading></div>
          <p className="max-w-lg text-base leading-7 text-text-muted lg:justify-self-end">Choose whether your gang sheet is already arranged or whether you have individual designs that need sizes, quantities, and arrangement.</p>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {workflowOptions.map((option, index) => <WorkflowCard key={option.title} index={index} {...option} />)}
        </div>
      </div>
    </section>
  );
}
