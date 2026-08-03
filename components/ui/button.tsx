import Link from "next/link";
import type { ComponentProps } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonProps = ComponentProps<typeof Link> & {
  variant?: "primary" | "secondary" | "quiet";
  showArrow?: boolean;
};

type ActionButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "quiet";
};

function getButtonClasses(variant: "primary" | "secondary" | "quiet", className?: string) {
  return cn(
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-control border px-5 font-mono text-xs font-bold uppercase tracking-[0.16em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:border-border disabled:bg-raised disabled:text-text-muted",
    variant === "primary" && "border-accent bg-accent text-accent-foreground hover:bg-text-primary",
    variant === "secondary" && "border-border bg-transparent text-text-primary hover:border-text-primary",
    variant === "quiet" && "border-transparent px-0 text-text-primary hover:text-accent",
    className,
  );
}

export function Button({ className, variant = "primary", showArrow = false, children, ...props }: ButtonProps) {
  return (
    <Link
      className={getButtonClasses(variant, className)}
      {...props}
    >
      {children}
      {showArrow && <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />}
    </Link>
  );
}

export function ActionButton({ className, variant = "primary", children, ...props }: ActionButtonProps) {
  return <button className={getButtonClasses(variant, className)} {...props}>{children}</button>;
}
