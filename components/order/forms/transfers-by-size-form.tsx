"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, type Resolver } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { transfersBySizeConfigurationSchema, type TransfersBySizeFormValues } from "@/lib/order-draft/schemas";
import { MAX_DYNAMIC_ROWS, MAX_NOTES_LENGTH } from "@/lib/order-draft/constants";
import type { WorkingTransfersBySizeConfiguration } from "@/lib/order-draft/types";
import { createDraftRowId } from "@/lib/order-draft/summary";
import { toWorkingConfiguration } from "@/lib/order-draft/working-configuration";
import { useOrderDraft, useOrderDraftPersistence } from "@/components/order/order-draft-provider";
import { ActionButton } from "@/components/ui/button";
import { FieldErrorMessage, FormErrorSummary, inputClassName, labelClassName } from "@/components/order/forms/form-feedback";
import { useWorkingConfiguration } from "@/components/order/forms/use-working-configuration";
import { StepActions } from "@/components/order/step-actions";

const newSize = () => ({ id: createDraftRowId(), width: "1", quantity: "1" });
const defaults: WorkingTransfersBySizeConfiguration = { route: "transfers-by-size", designLabel: "", sizes: [{ id: "size-1", width: "1", quantity: "1" }], notes: "" };

export function TransfersBySizeForm() {
  const router = useRouter();
  const working = useOrderDraft((state) => state.workingConfiguration?.route === "transfers-by-size" ? state.workingConfiguration : null);
  const completed = useOrderDraft((state) => state.configuration?.route === "transfers-by-size" ? state.configuration : null);
  const saveConfiguration = useOrderDraft((state) => state.saveConfiguration);
  const { flush } = useOrderDraftPersistence();
  const { control, register, handleSubmit, formState, watch } = useForm<WorkingTransfersBySizeConfiguration, unknown, TransfersBySizeFormValues>({
    resolver: zodResolver(transfersBySizeConfigurationSchema) as Resolver<WorkingTransfersBySizeConfiguration, unknown, TransfersBySizeFormValues>,
    defaultValues: working ?? (completed ? toWorkingConfiguration(completed) : defaults),
  });
  const { fields, append, remove } = useFieldArray({ control, name: "sizes", keyName: "fieldKey" });
  useWorkingConfiguration("transfers-by-size", watch);
  const onSubmit = async (values: TransfersBySizeFormValues) => { saveConfiguration(values); if (await flush()) router.push("/order/review"); };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)}>
      <input type="hidden" {...register("route")} />
      <FormErrorSummary errors={formState.errors} submitCount={formState.submitCount} />
      <div><label htmlFor="size-design-label" className={labelClassName}>Internal design label</label><input id="size-design-label" type="text" aria-describedby="size-design-label-error" aria-invalid={Boolean(formState.errors.designLabel)} className={inputClassName} {...register("designLabel")} /><FieldErrorMessage id="size-design-label-error" error={formState.errors.designLabel} /></div>
      <div className="mt-6 space-y-3">
        {fields.map((field, index) => {
          const widthId = `size-${field.id}-width`;
          const quantityId = `size-${field.id}-quantity`;
          return (
            <fieldset key={field.fieldKey} className="rounded-control border border-border bg-panel p-4 shadow-[var(--card-shadow)]">
              <legend className="px-2 font-display text-lg font-semibold text-text-primary">Size {String(index + 1).padStart(2, "0")}</legend>
              <input type="hidden" {...register(`sizes.${index}.id`)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label htmlFor={widthId} className={labelClassName}>Width <span className="text-text-muted">(in)</span></label><input id={widthId} type="number" step="any" inputMode="decimal" aria-describedby={`${widthId}-error`} aria-invalid={Boolean(formState.errors.sizes?.[index]?.width)} className={inputClassName} {...register(`sizes.${index}.width`)} /><FieldErrorMessage id={`${widthId}-error`} error={formState.errors.sizes?.[index]?.width} /></div>
                <div><label htmlFor={quantityId} className={labelClassName}>Quantity</label><input id={quantityId} type="number" step="1" inputMode="numeric" aria-describedby={`${quantityId}-error`} aria-invalid={Boolean(formState.errors.sizes?.[index]?.quantity)} className={inputClassName} {...register(`sizes.${index}.quantity`)} /><FieldErrorMessage id={`${quantityId}-error`} error={formState.errors.sizes?.[index]?.quantity} /></div>
              </div>
              {fields.length > 1 && <ActionButton type="button" variant="quiet" className="mt-4 min-h-9 text-error hover:text-text-primary" onClick={() => remove(index)} aria-label={`Remove size ${index + 1}`}><Trash2 aria-hidden="true" size={14} /> Remove size</ActionButton>}
            </fieldset>
          );
        })}
      </div>
      <ActionButton type="button" variant="secondary" className="mt-4" disabled={fields.length >= MAX_DYNAMIC_ROWS} onClick={() => append(newSize())}><Plus aria-hidden="true" size={15} /> Add another size</ActionButton>
      <div className="mt-6"><label htmlFor="sizes-notes" className={labelClassName}>Optional project notes</label><textarea id="sizes-notes" rows={5} maxLength={MAX_NOTES_LENGTH} aria-describedby="sizes-notes-error" aria-invalid={Boolean(formState.errors.notes)} className={`${inputClassName} resize-y py-3`} {...register("notes")} /><FieldErrorMessage id="sizes-notes-error" error={formState.errors.notes} /></div>
      <StepActions backHref="/order/artwork" continueLabel="Review draft" isSubmitting={formState.isSubmitting} />
    </form>
  );
}
