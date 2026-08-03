import { Building2, FileSearch2, MapPin, RefreshCw } from "lucide-react";

const capabilities = [
  { label: "Printed in Downtown LA", icon: Building2 },
  { label: "Pickup coordination", icon: MapPin },
  { label: "Artwork check step", icon: FileSearch2 },
  { label: "Built for repeat runs", icon: RefreshCw },
] as const;

export function CapabilityStrip() {
  return (
    <section aria-label="Production capabilities" className="border-b border-border bg-background">
      <div className="page-shell grid grid-cols-2 lg:grid-cols-4">
        {capabilities.map(({ label, icon: Icon }, index) => (
          <p key={label} className="flex min-h-20 items-center gap-3 border-b border-r border-border px-3 py-4 font-mono text-[0.6rem] font-bold uppercase tracking-[0.11em] text-text-primary last:border-r-0 sm:px-5 lg:border-b-0 lg:first:pl-0">
            <Icon aria-hidden="true" className="shrink-0 text-accent" size={19} strokeWidth={1.5} />
            <span><span className="mb-1 block text-[0.52rem] text-text-muted">0{index + 1}</span>{label}</span>
          </p>
        ))}
      </div>
    </section>
  );
}
