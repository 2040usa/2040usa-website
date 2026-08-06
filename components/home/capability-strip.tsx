import { Building2, FileSearch2, Layers3, Upload } from "lucide-react";

const capabilities = [
  { label: "Printed in Downtown LA", icon: Building2 },
  { label: "Private resumable uploads", icon: Upload },
  { label: "Two gang-sheet routes", icon: Layers3 },
  { label: "Artwork-linked sizing", icon: FileSearch2 },
] as const;

export function CapabilityStrip() {
  return (
    <section aria-label="Production capabilities" className="border-b border-border bg-background">
      <div className="page-shell grid grid-cols-2 lg:grid-cols-4">
        {capabilities.map(({ label, icon: Icon }, index) => (
          <p key={label} className="flex min-h-20 items-center gap-3 border-b border-r border-border px-3 py-4 text-xs font-semibold text-text-primary last:border-r-0 sm:px-5 lg:border-b-0 lg:first:pl-0">
            <Icon aria-hidden="true" className="shrink-0 text-accent" size={19} strokeWidth={1.5} />
            <span><span className="mb-1 block text-[0.65rem] text-text-muted">0{index + 1}</span>{label}</span>
          </p>
        ))}
      </div>
    </section>
  );
}
