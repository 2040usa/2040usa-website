import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeading({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <h2 id={id} className={cn("font-display text-4xl font-semibold leading-tight tracking-[-0.025em] text-text-primary sm:text-5xl lg:text-6xl", className)}>
      {children}
    </h2>
  );
}
