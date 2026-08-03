"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { useRouter } from "next/navigation";
import { gangSheetConfigurationSchema, type GangSheetFormValues } from "@/lib/order-draft/schemas";
import { MAX_NOTES_LENGTH } from "@/lib/order-draft/constants";
import type { WorkingGangSheetConfiguration } from "@/lib/order-draft/types";
import { toWorkingConfiguration } from "@/lib/order-draft/working-configuration";
import { useOrderDraft } from "@/components/order/order-draft-provider";
import { FieldErrorMessage, FormErrorSummary, inputClassName, labelClassName } from "@/components/order/forms/form-feedback";
import { useWorkingConfiguration } from "@/components/order/forms/use-working-configuration";
import { StepActions } from "@/components/order/step-actions";

const defaults: WorkingGangSheetConfiguration = { route: "gang-sheet", sheetCount: "1", finishedWidth: "1", finishedLength: "1", notes: "" };

export function GangSheetForm() {
  const router = useRouter();
  const working = useOrderDraft((state) => state.workingConfiguration?.route === "gang-sheet" ? state.workingConfiguration : null);
  const completed = useOrderDraft((state) => state.configuration?.route === "gang-sheet" ? state.configuration : null);
  const saveConfiguration = useOrderDraft((state) => state.saveConfiguration);
  const { register, handleSubmit, formState, watch } = useForm<WorkingGangSheetConfiguration, unknown, GangSheetFormValues>({
    resolver: zodResolver(gangSheetConfigurationSchema) as Resolver<WorkingGangSheetConfiguration, unknown, GangSheetFormValues>,
    defaultValues: working ?? (completed ? toWorkingConfiguration(completed) : defaults),
  });
  useWorkingConfiguration("gang-sheet", watch);
  const onSubmit = (values: GangSheetFormValues) => { saveConfiguration(values); router.push("/order/review"); };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)}>
      <input type="hidden" {...register("route")} />
      <FormErrorSummary errors={formState.errors} submitCount={formState.submitCount} />
      <div className="grid gap-5 sm:grid-cols-3">
        <div><label htmlFor="sheet-count" className={labelClassName}>Number of sheets</label><input id="sheet-count" type="number" step="1" inputMode="numeric" aria-describedby="sheet-count-error" aria-invalid={Boolean(formState.errors.sheetCount)} className={inputClassName} {...register("sheetCount")} /><FieldErrorMessage id="sheet-count-error" error={formState.errors.sheetCount} /></div>
        <div><label htmlFor="finished-width" className={labelClassName}>Expected finished width <span className="text-text-muted">(in)</span></label><input id="finished-width" type="number" step="any" inputMode="decimal" aria-describedby="finished-width-error" aria-invalid={Boolean(formState.errors.finishedWidth)} className={inputClassName} {...register("finishedWidth")} /><FieldErrorMessage id="finished-width-error" error={formState.errors.finishedWidth} /></div>
        <div><label htmlFor="finished-length" className={labelClassName}>Expected finished length <span className="text-text-muted">(in)</span></label><input id="finished-length" type="number" step="any" inputMode="decimal" aria-describedby="finished-length-error" aria-invalid={Boolean(formState.errors.finishedLength)} className={inputClassName} {...register("finishedLength")} /><FieldErrorMessage id="finished-length-error" error={formState.errors.finishedLength} /></div>
      </div>
      <div className="mt-6"><label htmlFor="gang-notes" className={labelClassName}>Optional project notes</label><textarea id="gang-notes" rows={5} maxLength={MAX_NOTES_LENGTH} aria-describedby="gang-notes-hint gang-notes-error" aria-invalid={Boolean(formState.errors.notes)} className={`${inputClassName} resize-y py-3`} {...register("notes")} /><span id="gang-notes-hint" className="mt-2 block text-[0.55rem] text-text-muted">Up to {MAX_NOTES_LENGTH} characters. Do not include payment details.</span><FieldErrorMessage id="gang-notes-error" error={formState.errors.notes} /></div>
      <StepActions backHref="/order/artwork" continueLabel="Review draft" isSubmitting={formState.isSubmitting} />
    </form>
  );
}
