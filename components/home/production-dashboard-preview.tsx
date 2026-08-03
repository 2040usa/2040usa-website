import { Clock3, PackageCheck, Printer } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { StatusBadge } from "@/components/ui/status-badge";

const jobs = [
  { id: "DEMO-0184", customer: "Morrow Studio", stage: "Printing", time: "10:30 AM", tone: "accent" as const },
  { id: "DEMO-0183", customer: "Westside Crew", stage: "QC passed", time: "9:45 AM", tone: "success" as const },
  { id: "DEMO-0182", customer: "Union Athletics", stage: "Artwork check", time: "9:10 AM", tone: "neutral" as const },
];

export function ProductionDashboardPreview() {
  return (
    <section className="min-w-0 rounded-control border border-border bg-panel" aria-labelledby="dashboard-heading">
      <div className="border-b border-border p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><SectionLabel>Production dashboard</SectionLabel><h2 id="dashboard-heading" className="mt-4 font-display text-3xl uppercase text-text-primary sm:text-4xl">Every job has a visible next step.</h2></div><StatusBadge tone="neutral">Internal concept</StatusBadge></div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-text-muted">A static demonstration with fictional job data. Nothing here can modify production records.</p>
      </div>
      <div className="grid grid-cols-3 border-b border-border">{[{ icon: Clock3, value: "03", label: "Due today" }, { icon: Printer, value: "02", label: "On press" }, { icon: PackageCheck, value: "04", label: "Ready" }].map(({ icon: Icon, value, label }) => <div key={label} className="border-r border-border p-4 last:border-0"><Icon aria-hidden="true" className="text-accent" size={16} /><p className="mt-4 font-display text-3xl text-text-primary">{value}</p><p className="font-mono text-[0.5rem] uppercase tracking-widest text-text-muted">{label}</p></div>)}</div>
      <div className="overflow-x-auto" tabIndex={0} aria-label="Scrollable fictional production queue">
        <table className="w-full min-w-[500px] text-left"><thead><tr className="font-mono text-[0.54rem] uppercase tracking-widest text-text-muted"><th className="p-3 font-normal">Job</th><th className="p-3 font-normal">Customer</th><th className="p-3 font-normal">Stage</th><th className="p-3 font-normal">Target</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id} className="border-t border-border text-xs text-text-primary"><td className="p-3 font-mono">{job.id}</td><td className="p-3">{job.customer}</td><td className="p-3"><StatusBadge tone={job.tone}>{job.stage}</StatusBadge></td><td className="p-3 text-text-muted">{job.time}</td></tr>)}</tbody></table>
      </div>
    </section>
  );
}
