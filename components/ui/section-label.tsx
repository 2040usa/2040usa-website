import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary", className)}>
      <span aria-hidden="true" className="h-px w-7 bg-accent" />
      {children}
    </p>
  );
}
