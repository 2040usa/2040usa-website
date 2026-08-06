import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function IconContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex size-11 items-center justify-center rounded-control border border-border bg-raised text-primary-action", className)}>{children}</span>;
}
