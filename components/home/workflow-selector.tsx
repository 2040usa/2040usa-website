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
          <p className="max-w-lg text-base leading-7 text-text-muted lg:justify-self-end">You don’t need to translate your project into printer language. Pick the route that looks closest; the production path can be refined during artwork review.</p>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {workflowOptions.map((option, index) => <WorkflowCard key={option.title} index={index} {...option} />)}
        </div>
      </div>
    </section>
  );
}
