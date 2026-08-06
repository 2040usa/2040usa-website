import { Crosshair, FileImage, ScanLine, Upload } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";

const transferMarks = [
  { label: "2040", className: "col-span-2 bg-sheet-ink text-accent" },
  { label: "DTF", className: "bg-registration-red text-sheet" },
  { label: "LA", className: "bg-accent text-accent-foreground" },
  { label: "PRINT", className: "col-span-2 bg-sheet-ink text-sheet" },
  { label: "★", className: "bg-sheet-ink text-accent" },
  { label: "20", className: "bg-registration-red text-sheet" },
] as const;

export function ArtworkDropzonePreview() {
  return (
    <aside id="start" className="relative scroll-mt-24 rounded-control border border-border bg-panel p-3 shadow-[var(--card-shadow)] sm:p-4" aria-label="Static artwork intake preview">
      <div className="mb-3 flex items-center justify-between text-xs font-medium text-text-muted">
        <span>Artwork example</span><span>24 × 36 in</span>
      </div>
      <div className="technical-grid relative min-h-64 overflow-hidden border border-border bg-raised p-5 sm:min-h-80 sm:p-7" aria-hidden="true">
        <div className="mx-auto grid max-w-sm -rotate-2 grid-cols-4 gap-2 border border-sheet-ink/30 bg-sheet p-4 shadow-2xl sm:p-6">
          {transferMarks.map((mark, index) => (
            <div key={`${mark.label}-${index}`} className={`grid min-h-14 place-items-center rounded-control border border-sheet-ink/20 font-display text-lg uppercase ${mark.className}`}>
              {mark.label}
            </div>
          ))}
        </div>
        <Crosshair className="absolute bottom-3 right-3 text-primary-action" size={38} strokeWidth={0.8} />
        <span className="absolute bottom-3 left-3 font-mono text-[0.65rem] text-text-muted">Registration / CMYK-W</span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="flex items-center gap-3 rounded-control border border-dashed border-border p-3">
          <Upload aria-hidden="true" className="shrink-0 text-primary-action" size={18} />
          <div><p className="text-sm font-semibold text-text-primary">Artwork upload preview</p><p className="mt-1 text-xs text-text-muted">Start a Print to choose and securely upload files</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-control border border-border p-3"><FileImage aria-hidden="true" className="text-accent" size={18} /><ScanLine aria-hidden="true" className="text-accent" size={18} /><StatusBadge tone="neutral">File check</StatusBadge></div>
      </div>
    </aside>
  );
}
