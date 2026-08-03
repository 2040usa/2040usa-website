import Link from "next/link";
import { Check } from "lucide-react";
import { ORDER_STEPS } from "@/lib/order-draft/constants";
import type { CompletedStep, OrderStepId } from "@/lib/order-draft/types";
import { cn } from "@/lib/utils";

export function OrderProgress({ currentStep, lastCompletedStep }: { currentStep: OrderStepId; lastCompletedStep: CompletedStep }) {
  return (
    <nav aria-label="Order prototype progress" className="border-y border-border bg-raised">
      <ol className="page-shell grid grid-cols-4">
        {ORDER_STEPS.map((step) => {
          const isCurrent = step.id === currentStep;
          const isCompleted = step.number <= lastCompletedStep && !isCurrent;
          const content = (
            <>
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-control border font-mono text-[0.58rem]", isCurrent && "border-accent bg-accent text-accent-foreground", isCompleted && "border-success text-success", !isCurrent && !isCompleted && "border-border text-text-muted")}>
                {isCompleted ? <Check aria-hidden="true" size={14} /> : String(step.number).padStart(2, "0")}
              </span>
              <span className="hidden min-w-0 sm:block"><span className="block font-mono text-[0.5rem] uppercase tracking-widest text-text-muted">{isCompleted ? "Completed" : isCurrent ? "Current" : "Not started"}</span><span className="mt-1 block truncate text-xs text-text-primary">{step.title}</span></span>
              <span className="sr-only sm:hidden">{step.title}: {isCompleted ? "completed" : isCurrent ? "current step" : "not started"}</span>
            </>
          );
          const className = "flex min-h-16 items-center justify-center gap-3 border-r border-border px-2 last:border-r-0 sm:justify-start sm:px-4";

          return (
            <li key={step.id} className="min-w-0">
              {isCompleted ? <Link href={step.path} className={`${className} hover:bg-panel focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-accent`}>{content}</Link> : <div className={className} aria-current={isCurrent ? "step" : undefined}>{content}</div>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
