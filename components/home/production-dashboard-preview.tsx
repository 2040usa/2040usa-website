import { Clock3, PackageCheck, Printer } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";

export function ProductionDashboardPreview() {
  return (
    <section className="min-w-0 rounded-control border border-border bg-panel shadow-[var(--card-shadow)]" aria-labelledby="dashboard-heading">
      <div className="border-b border-border p-5 sm:p-6">
        <SectionLabel>Production clarity</SectionLabel><h2 id="dashboard-heading" className="mt-4 font-display text-3xl font-semibold text-text-primary sm:text-4xl">Every project has a clear next step.</h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-text-muted">Straightforward communication keeps artwork checks, printing, and pickup coordination understandable.</p>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
        {[{ icon: Clock3, title: "Artwork check", detail: "Confirm the supplied files and project details." }, { icon: Printer, title: "Printing", detail: "Keep the active production stage easy to understand." }, { icon: PackageCheck, title: "Pickup", detail: "Coordinate handoff details for confirmed work." }].map(({ icon: Icon, title, detail }) => <div key={title} className="rounded-control border border-border bg-raised p-4"><Icon aria-hidden="true" className="text-primary-action" size={18} /><h3 className="mt-4 font-semibold text-text-primary">{title}</h3><p className="mt-2 text-xs leading-5 text-text-muted">{detail}</p></div>)}
      </div>
    </section>
  );
}
