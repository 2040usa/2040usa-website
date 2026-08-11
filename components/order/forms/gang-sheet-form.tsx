"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, type ReactNode } from "react";
import { useForm, useWatch, type FieldErrors, type Resolver, type UseFormRegister } from "react-hook-form";
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
import { ArtworkRecordActions } from "@/components/artwork/artwork-file-list";
import { FieldErrorMessage, FormErrorSummary, inputClassName, labelClassName } from "@/components/order/forms/form-feedback";
import { useWorkingConfiguration } from "@/components/order/forms/use-working-configuration";
import { StepActions } from "@/components/order/step-actions";
import { GangSheetLayoutPreview } from "@/components/order/layout-preview";

export function GangSheetForm({ continueBlocked, blockedReason, addArtworkAction }: { continueBlocked: boolean; blockedReason: string; addArtworkAction?: ReactNode }) {
  const router = useRouter();
  const { records, acknowledge } = useArtwork();
  const artwork = useMemo(() => {
    const uploaded = records.filter((record) => record.status === "uploaded" && record.route === "gang-sheet" && record.purpose === "gang-sheet-file");
    const supersededIds = new Set(uploaded.flatMap((record) => record.replacementForId ? [record.replacementForId] : []));
    return uploaded.filter((record) => !supersededIds.has(record.id));
  }, [records]);
  const working = useOrderDraft((state) => state.workingConfiguration?.route === "gang-sheet" ? state.workingConfiguration : null);
  const completed = useOrderDraft((state) => state.configuration?.route === "gang-sheet" ? state.configuration : null);
  const artworkAcknowledged = useOrderDraft((state) => state.artworkAcknowledged);
  const saveConfiguration = useOrderDraft((state) => state.saveConfiguration);
  const { flush } = useOrderDraftPersistence();
  const initial = working ?? (completed ? toWorkingConfiguration(completed) : { route: "gang-sheet" as const, sheets: artwork.map((record) => createWorkingGangSheet(record.id)), notes: "" });
  const { control, register, handleSubmit, formState, watch, reset, getValues } = useForm<WorkingGangSheetConfiguration, unknown, GangSheetFormValues>({
    resolver: zodResolver(gangSheetFormSchema) as Resolver<WorkingGangSheetConfiguration, unknown, GangSheetFormValues>,
    defaultValues: initial,
  });
  useWorkingConfiguration("gang-sheet", watch);

  useEffect(() => {
    const current = getValues();
    const byId = new Map((current.sheets ?? []).map((sheet) => [sheet.artworkId, sheet]));
    const sheets = artwork.map((record) => {
      const existing = byId.get(record.id);
      if (existing) return existing;
      const replaced = record.replacementForId ? byId.get(record.replacementForId) : null;
      return replaced ? { ...replaced, artworkId: record.id } : createWorkingGangSheet(record.id);
    });
    if (sheets.length !== current.sheets?.length || sheets.some((sheet, index) => sheet.artworkId !== current.sheets?.[index]?.artworkId)) {
      reset({ route: "gang-sheet", sheets, notes: current.notes ?? "" }, { keepDirtyValues: true });
    }
  }, [artwork, getValues, reset]);

  const previewConfiguration = useWatch({ control }) as WorkingGangSheetConfiguration;
  const onSubmit = async (values: GangSheetFormValues) => {
    if (continueBlocked) return;
    if (!artworkAcknowledged && !await acknowledge()) return;
    saveConfiguration(values);
    if (await flush()) router.push("/order/review");
  };
  return <form noValidate onSubmit={handleSubmit(onSubmit)}>
    <input type="hidden" {...register("route")} />
    <FormErrorSummary errors={formState.errors} submitCount={formState.submitCount} />
    <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(22rem,2fr)] xl:items-start">
      <div className="min-w-0">
        <div className="space-y-8">
          {artwork.map((record, index) => <GangSheetCard key={record.id} record={record} index={index} register={register} errors={formState.errors} />)}
        </div>
        {addArtworkAction}
      </div>
      <GangSheetLayoutPreview artwork={artwork} configuration={previewConfiguration} />
    </div>
    <div className="mt-8 border-t border-border pt-7"><label htmlFor="gang-notes" className={labelClassName}>Optional project notes</label><textarea id="gang-notes" rows={4} maxLength={MAX_NOTES_LENGTH} aria-describedby="gang-notes-hint gang-notes-error" aria-invalid={Boolean(formState.errors.notes)} className={`${inputClassName} resize-y py-3`} {...register("notes")} /><span id="gang-notes-hint" className="mt-2 block text-xs text-text-muted">Up to {MAX_NOTES_LENGTH} characters. Do not include payment details.</span><FieldErrorMessage id="gang-notes-error" error={formState.errors.notes} /></div>
    {continueBlocked && <p className="mt-6 text-sm text-text-muted" aria-live="polite">{blockedReason}</p>}
    <StepActions backHref="/order/start" continueLabel="Continue to Review" isSubmitting={formState.isSubmitting || continueBlocked} />
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
  return <section role="group" aria-labelledby={`gang-sheet-title-${record.id}`} className="min-w-0 border-t border-border bg-panel pt-7 first:border-t-0 first:pt-0">
    <input type="hidden" {...register(`${prefix}.artworkId`)} />
    <ArtworkIdentity record={record} previewSize="hero" hideName showMetadata={false} className="flex-col items-stretch" />
    <div className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 id={`gang-sheet-title-${record.id}`} className="break-words font-display text-xl font-semibold text-text-primary">{record.originalName}</h2><ArtworkRecordActions record={record} /></div>
    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      <div><label htmlFor={`${prefix}-width`} className={labelClassName}>Finished width <span className="text-text-muted">(in)</span></label><input id={`${prefix}-width`} type="number" step="any" inputMode="decimal" aria-describedby={`${prefix}-width-error`} aria-invalid={Boolean(error?.finishedWidth)} className={inputClassName} {...register(`${prefix}.finishedWidth`)} /><FieldErrorMessage id={`${prefix}-width-error`} error={error?.finishedWidth} /></div>
      <div><label htmlFor={`${prefix}-length`} className={labelClassName}>Finished length <span className="text-text-muted">(in)</span></label><input id={`${prefix}-length`} type="number" step="any" inputMode="decimal" aria-describedby={`${prefix}-length-error`} aria-invalid={Boolean(error?.finishedLength)} className={inputClassName} {...register(`${prefix}.finishedLength`)} /><FieldErrorMessage id={`${prefix}-length-error`} error={error?.finishedLength} /></div>
      <div><label htmlFor={`${prefix}-copies`} className={labelClassName}>Copies</label><input id={`${prefix}-copies`} type="number" min="1" step="1" inputMode="numeric" aria-describedby={`${prefix}-copies-error`} aria-invalid={Boolean(error?.copies)} className={inputClassName} {...register(`${prefix}.copies`)} /><FieldErrorMessage id={`${prefix}-copies-error`} error={error?.copies} /></div>
    </div>
  </section>;
}
