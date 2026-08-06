import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ActionButton } from "@/components/ui/button";

export function StepActions({ backHref, continueLabel = "Continue", isSubmitting = false, onContinue }: { backHref?: string; continueLabel?: string; isSubmitting?: boolean; onContinue?: () => void }) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
      {backHref ? <Link href={backHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control border border-border-strong bg-panel px-5 text-sm font-semibold text-text-primary hover:border-primary-action hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring"><ArrowLeft aria-hidden="true" size={15} /> Back</Link> : <span />}
      <ActionButton type={onContinue ? "button" : "submit"} onClick={onContinue} disabled={isSubmitting}>{continueLabel}<ArrowRight aria-hidden="true" size={15} /></ActionButton>
    </div>
  );
}
