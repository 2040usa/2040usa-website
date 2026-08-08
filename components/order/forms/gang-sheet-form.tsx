"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm, type FieldErrors, type Resolver, type UseFormRegister } from "react-hook-form";
import { useRouter } from "next/navigation";
import { gangSheetFormSchema, type GangSheetFormValues } from "@/lib/order-draft/schemas";
import { MAX_NOTES_LENGTH } from "@/lib/order-draft/constants";
import type { CanonicalArtworkRecord } from "@/lib/artwork/types";
import type { WorkingGangSheetConfiguration } from "@/lib/order-draft/types";
import { createWorkingGangSheet } from "@/lib/order-draft/artwork-configuration";
import { toWorkingConfiguration } from "@/lib/order-draft/working-configuration";
import { useOrderDraft, useOrderDraftPersistence } from "@/components/order/order-draft-provider";
import { useArtwork } from "@/components/artwork/artwork-provider";
import { ArtworkIdentity } from "@/components/artwork/artwork-preview";
import { FieldErrorMessage, FormErrorSummary, inputClassName, labelClassName } from "@/components/order/forms/form-feedback";
import { useWorkingConfiguration } from "@/components/order/forms/use-working-configuration";
import { StepActions } from "@/components/order/step-actions";

export function GangSheetForm() {
  const router = useRouter();
  const { records } = useArtwork();
  const artwork = useMemo(() => records.filter((record) => record.status === "uploaded" && record.route === "gang-sheet" && record.purpose === "gang-sheet-file"), [records]);
  const working = useOrderDraft((state) => state.workingConfiguration?.route === "gang-sheet" ? state.workingConfiguration : null);
  const completed = useOrderDraft((state) => state.configuration?.route === "gang-sheet" ? state.configuration : null);
  const saveConfiguration = useOrderDraft((state) => state.saveConfiguration);
  const { flush } = useOrderDraftPersistence();
  const initial = working ?? (completed ? toWorkingConfiguration(completed) : { route: "gang-sheet" as const, sheets: artwork.map((record) => createWorkingGangSheet(record.id)), notes: "" });
  const { register, handleSubmit, formState, watch, reset, getValues } = useForm<WorkingGangSheetConfiguration, unknown, GangSheetFormValues>({
    resolver: zodResolver(gangSheetFormSchema) as Resolver<WorkingGangSheetConfiguration, unknown, GangSheetFormValues>,
    defaultValues: initial,
  });
  useWorkingConfiguration("gang-sheet", watch);

  useEffect(() => {
    const current = getValues();
    const byId = new Map((current.sheets ?? []).map((sheet) => [sheet.artworkId, sheet]));
    const sheets = artwork.map((record) => byId.get(record.id) ?? createWorkingGangSheet(record.id));
    if (sheets.length !== current.sheets?.length || sheets.some((sheet, index) => sheet.artworkId !== current.sheets?.[index]?.artworkId)) {
      reset({ route: "gang-sheet", sheets, notes: current.notes ?? "" }, { keepDirtyValues: true });
    }
  }, [artwork, getValues, reset]);

  const onSubmit = async (values: GangSheetFormValues) => { saveConfiguration(values); if (await flush()) router.push("/order/review"); };
  return <form noValidate onSubmit={handleSubmit(onSubmit)}>
    <input type="hidden" {...register("route")} />
    <FormErrorSummary errors={formState.errors} submitCount={formState.submitCount} />
    <div className="space-y-5">
      {artwork.map((record, index) => <GangSheetCard key={record.id} record={record} index={index} register={register} errors={formState.errors} />)}
    </div>
    <div className="mt-6"><label htmlFor="gang-notes" className={labelClassName}>Optional project notes</label><textarea id="gang-notes" rows={5} maxLength={MAX_NOTES_LENGTH} aria-describedby="gang-notes-hint gang-notes-error" aria-invalid={Boolean(formState.errors.notes)} className={`${inputClassName} resize-y py-3`} {...register("notes")} /><span id="gang-notes-hint" className="mt-2 block text-xs text-text-muted">Up to {MAX_NOTES_LENGTH} characters. Do not include payment details.</span><FieldErrorMessage id="gang-notes-error" error={formState.errors.notes} /></div>
    <StepActions backHref="/order/artwork" continueLabel="Review draft" isSubmitting={formState.isSubmitting} />
  </form>;
}

function GangSheetCard({ record, index, register, errors }: {
  record: CanonicalArtworkRecord;
  index: number;
  register: UseFormRegister<WorkingGangSheetConfiguration>;
  errors: FieldErrors<WorkingGangSheetConfiguration>;
}) {
  const error = errors.sheets?.[index];
  const prefix = `sheets.${index}` as const;
  return <fieldset className="min-w-0 rounded-control border border-border bg-panel p-4 shadow-[var(--card-shadow)] sm:p-5">
    <legend className="max-w-full break-words px-2 font-display text-xl font-semibold text-text-primary">{record.originalName}</legend>
    <input type="hidden" {...register(`${prefix}.artworkId`)} />
    <ArtworkIdentity record={record} className="mb-5" />
    <div className="grid gap-4 sm:grid-cols-3">
      <div><label htmlFor={`${prefix}-width`} className={labelClassName}>Finished width <span className="text-text-muted">(in)</span></label><input id={`${prefix}-width`} type="number" step="any" inputMode="decimal" aria-describedby={`${prefix}-width-error`} aria-invalid={Boolean(error?.finishedWidth)} className={inputClassName} {...register(`${prefix}.finishedWidth`)} /><FieldErrorMessage id={`${prefix}-width-error`} error={error?.finishedWidth} /></div>
      <div><label htmlFor={`${prefix}-length`} className={labelClassName}>Finished length <span className="text-text-muted">(in)</span></label><input id={`${prefix}-length`} type="number" step="any" inputMode="decimal" aria-describedby={`${prefix}-length-error`} aria-invalid={Boolean(error?.finishedLength)} className={inputClassName} {...register(`${prefix}.finishedLength`)} /><FieldErrorMessage id={`${prefix}-length-error`} error={error?.finishedLength} /></div>
      <div><label htmlFor={`${prefix}-copies`} className={labelClassName}>Copies</label><input id={`${prefix}-copies`} type="number" min="1" step="1" inputMode="numeric" aria-describedby={`${prefix}-copies-error`} aria-invalid={Boolean(error?.copies)} className={inputClassName} {...register(`${prefix}.copies`)} /><FieldErrorMessage id={`${prefix}-copies-error`} error={error?.copies} /></div>
    </div>
  </fieldset>;
}
