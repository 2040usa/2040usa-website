import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "accent" }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-2 rounded-control border px-2.5 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em]",
      tone === "neutral" && "border-border text-text-muted",
      tone === "success" && "border-success/50 text-success",
      tone === "accent" && "border-accent/50 text-accent",
    )}>
      <span className="h-1.5 w-1.5 bg-current" aria-hidden="true" />{children}
    </span>
  );
}
