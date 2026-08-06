import Link from "next/link";
import { Check } from "lucide-react";
import { ORDER_STEPS } from "@/lib/order-draft/constants";
import type { CompletedStep, OrderStepId } from "@/lib/order-draft/types";
import { cn } from "@/lib/utils";

export function OrderProgress({ currentStep, lastCompletedStep }: { currentStep: OrderStepId; lastCompletedStep: CompletedStep }) {
  return (
    <nav aria-label="Order draft progress" className="border-b border-border bg-panel">
      <ol className="page-shell grid grid-cols-4">
        {ORDER_STEPS.map((step) => {
          const isCurrent = step.id === currentStep;
          const isCompleted = step.number <= lastCompletedStep && !isCurrent;
          const content = (
            <>
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold", isCurrent && "border-primary-action bg-primary-action text-primary-action-foreground", isCompleted && "border-success bg-success/8 text-success", !isCurrent && !isCompleted && "border-border text-text-muted")}>
                {isCompleted ? <Check aria-hidden="true" size={14} /> : String(step.number).padStart(2, "0")}
              </span>
              <span className="hidden min-w-0 sm:block"><span className="block text-[0.65rem] text-text-muted">{isCompleted ? "Completed" : isCurrent ? "Current" : "Not started"}</span><span className="mt-1 block truncate text-xs font-medium text-text-primary">{step.title}</span></span>
              <span className="sr-only sm:hidden">{step.title}: {isCompleted ? "completed" : isCurrent ? "current step" : "not started"}</span>
            </>
          );
          const className = "flex min-h-16 items-center justify-center gap-3 border-r border-border px-2 last:border-r-0 sm:justify-start sm:px-4";

          return (
            <li key={step.id} className="min-w-0">
              {isCompleted ? <Link href={step.path} className={`${className} hover:bg-raised focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-focus-ring`}>{content}</Link> : <div className={className} aria-current={isCurrent ? "step" : undefined}>{content}</div>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
