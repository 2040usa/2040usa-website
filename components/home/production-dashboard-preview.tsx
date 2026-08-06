import { Clock3, PackageCheck, Printer } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";

export function ProductionDashboardPreview() {
  return (
    <section className="min-w-0 rounded-control border border-border bg-panel shadow-[var(--card-shadow)]" aria-labelledby="dashboard-heading">
      <div className="border-b border-border p-5 sm:p-6">
        <SectionLabel>Current boundary</SectionLabel><h2 id="dashboard-heading" className="mt-4 font-display text-3xl font-semibold text-text-primary sm:text-4xl">The website ends with a saved draft.</h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-text-muted">This is a guide to the active draft experience, not a customer or production-management dashboard.</p>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
        {[{ icon: Clock3, title: "Saved draft", detail: "Artwork and project details remain editable." }, { icon: Printer, title: "No submission", detail: "Nothing is sent into production from this website." }, { icon: PackageCheck, title: "No checkout", detail: "Pricing, payment, and pickup remain outside this experience." }].map(({ icon: Icon, title, detail }) => <div key={title} className="rounded-control border border-border bg-raised p-4"><Icon aria-hidden="true" className="text-primary-action" size={18} /><h3 className="mt-4 font-semibold text-text-primary">{title}</h3><p className="mt-2 text-xs leading-5 text-text-muted">{detail}</p></div>)}
      </div>
    </section>
  );
}
