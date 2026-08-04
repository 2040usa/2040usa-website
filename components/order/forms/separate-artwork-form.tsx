"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, type Resolver } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { separateArtworkConfigurationSchema, type SeparateArtworkFormValues } from "@/lib/order-draft/schemas";
import { MAX_DYNAMIC_ROWS, MAX_NOTES_LENGTH } from "@/lib/order-draft/constants";
import type { WorkingSeparateArtworkConfiguration } from "@/lib/order-draft/types";
import { createDraftRowId } from "@/lib/order-draft/summary";
import { toWorkingConfiguration } from "@/lib/order-draft/working-configuration";
import { useOrderDraft, useOrderDraftPersistence } from "@/components/order/order-draft-provider";
import { ActionButton } from "@/components/ui/button";
import { FieldErrorMessage, FormErrorSummary, inputClassName, labelClassName } from "@/components/order/forms/form-feedback";
import { useWorkingConfiguration } from "@/components/order/forms/use-working-configuration";
import { StepActions } from "@/components/order/step-actions";

const newDesign = () => ({ id: createDraftRowId(), label: "", width: "1", quantity: "1" });
const defaults: WorkingSeparateArtworkConfiguration = { route: "separate-artwork", designs: [{ id: "design-1", label: "", width: "1", quantity: "1" }], notes: "" };

export function SeparateArtworkForm() {
  const router = useRouter();
  const working = useOrderDraft((state) => state.workingConfiguration?.route === "separate-artwork" ? state.workingConfiguration : null);
  const completed = useOrderDraft((state) => state.configuration?.route === "separate-artwork" ? state.configuration : null);
  const saveConfiguration = useOrderDraft((state) => state.saveConfiguration);
  const { flush } = useOrderDraftPersistence();
  const { control, register, handleSubmit, formState, watch } = useForm<WorkingSeparateArtworkConfiguration, unknown, SeparateArtworkFormValues>({
    resolver: zodResolver(separateArtworkConfigurationSchema) as Resolver<WorkingSeparateArtworkConfiguration, unknown, SeparateArtworkFormValues>,
    defaultValues: working ?? (completed ? toWorkingConfiguration(completed) : defaults),
  });
  const { fields, append, remove } = useFieldArray({ control, name: "designs", keyName: "fieldKey" });
  useWorkingConfiguration("separate-artwork", watch);
  const onSubmit = async (values: SeparateArtworkFormValues) => { saveConfiguration(values); if (await flush()) router.push("/order/review"); };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)}>
      <input type="hidden" {...register("route")} />
      <FormErrorSummary errors={formState.errors} submitCount={formState.submitCount} />
      <div className="space-y-4">
        {fields.map((field, index) => {
          const labelId = `design-${field.id}-label`;
          const widthId = `design-${field.id}-width`;
          const quantityId = `design-${field.id}-quantity`;
          return (
            <fieldset key={field.fieldKey} className="rounded-control border border-border bg-panel p-4 sm:p-5">
              <legend className="px-2 font-display text-xl uppercase text-text-primary">Design {String(index + 1).padStart(2, "0")}</legend>
              <input type="hidden" {...register(`designs.${index}.id`)} />
              <div className="grid gap-4 sm:grid-cols-[1.4fr_0.8fr_0.7fr]">
                <div><label htmlFor={labelId} className={labelClassName}>Internal design label</label><input id={labelId} type="text" aria-describedby={`${labelId}-error`} aria-invalid={Boolean(formState.errors.designs?.[index]?.label)} className={inputClassName} {...register(`designs.${index}.label`)} /><FieldErrorMessage id={`${labelId}-error`} error={formState.errors.designs?.[index]?.label} /></div>
                <div><label htmlFor={widthId} className={labelClassName}>Print width <span className="text-text-muted">(in)</span></label><input id={widthId} type="number" step="any" inputMode="decimal" aria-describedby={`${widthId}-error`} aria-invalid={Boolean(formState.errors.designs?.[index]?.width)} className={inputClassName} {...register(`designs.${index}.width`)} /><FieldErrorMessage id={`${widthId}-error`} error={formState.errors.designs?.[index]?.width} /></div>
                <div><label htmlFor={quantityId} className={labelClassName}>Quantity</label><input id={quantityId} type="number" step="1" inputMode="numeric" aria-describedby={`${quantityId}-error`} aria-invalid={Boolean(formState.errors.designs?.[index]?.quantity)} className={inputClassName} {...register(`designs.${index}.quantity`)} /><FieldErrorMessage id={`${quantityId}-error`} error={formState.errors.designs?.[index]?.quantity} /></div>
              </div>
              {fields.length > 1 && <ActionButton type="button" variant="quiet" className="mt-4 min-h-9 text-error hover:text-text-primary" onClick={() => remove(index)} aria-label={`Remove design ${index + 1}`}><Trash2 aria-hidden="true" size={14} /> Remove design</ActionButton>}
            </fieldset>
          );
        })}
      </div>
      <ActionButton type="button" variant="secondary" className="mt-4" disabled={fields.length >= MAX_DYNAMIC_ROWS} onClick={() => append(newDesign())}><Plus aria-hidden="true" size={15} /> Add another design</ActionButton>
      <div className="mt-6"><label htmlFor="separate-notes" className={labelClassName}>Optional project notes</label><textarea id="separate-notes" rows={5} maxLength={MAX_NOTES_LENGTH} aria-describedby="separate-notes-error" aria-invalid={Boolean(formState.errors.notes)} className={`${inputClassName} resize-y py-3`} {...register("notes")} /><FieldErrorMessage id="separate-notes-error" error={formState.errors.notes} /></div>
      <StepActions backHref="/order/artwork" continueLabel="Review draft" isSubmitting={formState.isSubmitting} />
    </form>
  );
}
