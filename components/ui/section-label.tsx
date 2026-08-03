import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center gap-3 font-mono text-[0.68rem] font-bold uppercase tracking-[0.22em] text-accent", className)}>
      <span aria-hidden="true" className="h-px w-7 bg-accent" />
      {children}
    </p>
  );
}
