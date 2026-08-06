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
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-control border px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:border-border disabled:bg-disabled-background disabled:text-disabled-text",
    variant === "primary" && "border-primary-action bg-primary-action text-primary-action-foreground hover:border-primary-action-hover hover:bg-primary-action-hover",
    variant === "secondary" && "border-border-strong bg-secondary-action text-text-primary hover:border-primary-action hover:bg-raised",
    variant === "quiet" && "border-transparent px-0 text-text-primary hover:text-primary-action",
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
