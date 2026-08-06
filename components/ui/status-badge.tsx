import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "accent" }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold",
      tone === "neutral" && "border-border bg-raised text-text-secondary",
      tone === "success" && "border-success/30 bg-success/8 text-success",
      tone === "accent" && "border-primary-action/25 bg-primary-action/8 text-primary-action",
    )}>
      <span className="h-1.5 w-1.5 bg-current" aria-hidden="true" />{children}
    </span>
  );
}
