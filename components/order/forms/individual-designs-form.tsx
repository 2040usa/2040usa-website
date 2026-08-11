"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { Controller, useFieldArray, useForm, useWatch, type Control, type Resolver, type UseFormRegister, type UseFormSetValue, type FieldErrors } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { individualDesignsFormSchema, workingOrderConfigurationSchema, type IndividualDesignsFormValues } from "@/lib/order-draft/schemas";
import { MAX_CHANGE_INSTRUCTIONS_LENGTH, MAX_DYNAMIC_ROWS, MAX_NOTES_LENGTH } from "@/lib/order-draft/constants";
import type { CanonicalArtworkRecord } from "@/lib/artwork/types";
import type { WorkingIndividualDesignConfiguration, WorkingIndividualDesignsConfiguration } from "@/lib/order-draft/types";
import { createDraftRowId } from "@/lib/order-draft/summary";
import { toWorkingConfiguration } from "@/lib/order-draft/working-configuration";
import { useOrderDraft, useOrderDraftPersistence } from "@/components/order/order-draft-provider";
import { useArtwork } from "@/components/artwork/artwork-provider";
import { ActionButton } from "@/components/ui/button";
import { FieldErrorMessage, FormErrorSummary, inputClassName, labelClassName } from "@/components/order/forms/form-feedback";
import { useWorkingConfiguration } from "@/components/order/forms/use-working-configuration";
import { StepActions } from "@/components/order/step-actions";
import { ArtworkIdentity } from "@/components/artwork/artwork-preview";
import { ArtworkRecordActions } from "@/components/artwork/artwork-file-list";
import { IndividualDesignsLayoutPreview } from "@/components/order/layout-preview";
import type { WorkingLayoutPreferences } from "@/lib/gang-sheet-layout/types";
import { DEFAULT_LAYOUT_MODE } from "@/lib/gang-sheet-layout/constants";

type IndividualDesignsControl = Control<WorkingIndividualDesignsConfiguration, unknown, IndividualDesignsFormValues>;

const newSize = () => ({ id: createDraftRowId(), method: "" as const, dimension: "", quantity: "1" });
const newDesign = (artworkId: string): WorkingIndividualDesignConfiguration => ({
  artworkId,
  sizes: [newSize()],
  wantsChanges: "",
  changeInstructions: "",
});
const defaultLayoutPreferences = (): WorkingLayoutPreferences => ({ mode: DEFAULT_LAYOUT_MODE, spacingPreset: "standard", customSpacing: "" });

function SizeVariants({ designIndex, control, register, setValue, errors }: {
  designIndex: number;
  control: IndividualDesignsControl;
  register: UseFormRegister<WorkingIndividualDesignsConfiguration>;
  setValue: UseFormSetValue<WorkingIndividualDesignsConfiguration>;
  errors: FieldErrors<WorkingIndividualDesignsConfiguration>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: `designs.${designIndex}.sizes`, keyName: "fieldKey" });
  const sizes = useWatch({ control, name: `designs.${designIndex}.sizes` });
  return <div className="mt-6 space-y-4">
    {fields.map((field, sizeIndex) => {
      const method = sizes?.[sizeIndex]?.method ?? "";
      const prefix = `designs.${designIndex}.sizes.${sizeIndex}` as const;
      const error = errors.designs?.[designIndex]?.sizes?.[sizeIndex];
      return <fieldset key={field.fieldKey} className="border-t border-border pt-4">
        <legend className="pr-3 text-sm font-semibold text-text-primary">Size {sizeIndex + 1}</legend>
        <input type="hidden" {...register(`${prefix}.id`)} />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_0.7fr_auto] lg:items-end">
          <div>
            <label htmlFor={`${prefix}-method`} className={labelClassName}>Sizing method</label>
            <Controller control={control} name={`${prefix}.method`} render={({ field: methodField }) => <select id={`${prefix}-method`} className={inputClassName} aria-invalid={Boolean(error?.method)} aria-describedby={`${prefix}-method-error`} {...methodField} onChange={(event) => { methodField.onChange(event); if (event.target.value === "original") setValue(`${prefix}.dimension`, "", { shouldDirty: true }); }}>
              <option value="">Choose one</option><option value="width">Set by width</option><option value="height">Set by height</option><option value="original">Use original artwork size</option>
            </select>} />
            <FieldErrorMessage id={`${prefix}-method-error`} error={error?.method} />
          </div>
          {method !== "original" ? <div>
            <label htmlFor={`${prefix}-dimension`} className={labelClassName}>{method === "height" ? "Finished height" : "Finished width"} <span className="text-text-muted">(in)</span></label>
            <input id={`${prefix}-dimension`} type="number" step="any" inputMode="decimal" className={inputClassName} disabled={!method} aria-invalid={Boolean(error?.dimension)} aria-describedby={`${prefix}-dimension-error`} {...register(`${prefix}.dimension`)} />
            <FieldErrorMessage id={`${prefix}-dimension-error`} error={error?.dimension} />
          </div> : <p className="text-xs leading-5 text-text-muted">We’ll confirm the original physical size during artwork review.</p>}
          <div>
            <label htmlFor={`${prefix}-quantity`} className={labelClassName}>Quantity</label>
            <input id={`${prefix}-quantity`} type="number" min="1" step="1" inputMode="numeric" className={inputClassName} aria-invalid={Boolean(error?.quantity)} aria-describedby={`${prefix}-quantity-error`} {...register(`${prefix}.quantity`)} />
            <FieldErrorMessage id={`${prefix}-quantity-error`} error={error?.quantity} />
          </div>
          {fields.length > 1 && <ActionButton type="button" variant="quiet" className="text-error" onClick={() => remove(sizeIndex)} aria-label={`Remove requested size ${sizeIndex + 1}`}><Trash2 aria-hidden size={14} /> Remove</ActionButton>}
        </div>
        {(method === "width" || method === "height") && <p className="mt-3 text-xs text-text-muted">We’ll keep your artwork proportional.</p>}
      </fieldset>;
    })}
    <ActionButton type="button" variant="secondary" disabled={fields.length >= MAX_DYNAMIC_ROWS} onClick={() => append(newSize())}><Plus aria-hidden size={15} /> Add another size</ActionButton>
  </div>;
}

export function IndividualDesignsForm({ continueBlocked, blockedReason, addArtworkAction }: { continueBlocked: boolean; blockedReason: string; addArtworkAction?: ReactNode }) {
  const router = useRouter();
  const { records, acknowledge } = useArtwork();
  const artwork = useMemo(() => {
    const uploaded = records.filter((record) => record.status === "uploaded" && record.route === "individual-designs" && record.purpose === "individual-design");
    const supersededIds = new Set(uploaded.flatMap((record) => record.replacementForId ? [record.replacementForId] : []));
    return uploaded.filter((record) => !supersededIds.has(record.id));
  }, [records]);
  const working = useOrderDraft((state) => state.workingConfiguration?.route === "individual-designs" ? state.workingConfiguration : null);
  const completed = useOrderDraft((state) => state.configuration?.route === "individual-designs" ? state.configuration : null);
  const artworkAcknowledged = useOrderDraft((state) => state.artworkAcknowledged);
  const saveConfiguration = useOrderDraft((state) => state.saveConfiguration);
  const { flush } = useOrderDraftPersistence();
  const initial = working ?? (completed ? toWorkingConfiguration(completed) : { route: "individual-designs" as const, designs: artwork.map((record) => newDesign(record.id)), layoutPreferences: defaultLayoutPreferences(), notes: "" });
  const { control, register, handleSubmit, formState, watch, getValues, setValue } = useForm<WorkingIndividualDesignsConfiguration, unknown, IndividualDesignsFormValues>({
    resolver: zodResolver(individualDesignsFormSchema) as Resolver<WorkingIndividualDesignsConfiguration, unknown, IndividualDesignsFormValues>,
    defaultValues: initial,
  });
  const { fields: designFields, replace: replaceDesigns } = useFieldArray({ control, name: "designs", keyName: "fieldKey" });
  const artworkById = useMemo(() => new Map(artwork.map((record) => [record.id, record])), [artwork]);
  const acceptsWorkingSnapshot = useCallback((values: unknown) => {
    const parsed = workingOrderConfigurationSchema.safeParse(values);
    return parsed.success
      && parsed.data.route === "individual-designs"
      && parsed.data.designs.length === artwork.length
      && parsed.data.designs.every((design, index) => design.artworkId === artwork[index]?.id);
  }, [artwork]);
  useWorkingConfiguration("individual-designs", watch, acceptsWorkingSnapshot);

  useEffect(() => {
    const current = getValues();
    const byId = new Map((current.designs ?? []).map((design) => [design.artworkId, design]));
    const next = artwork.map((record) => {
      const existing = byId.get(record.id);
      if (existing) return existing;
      const replaced = record.replacementForId ? byId.get(record.replacementForId) : null;
      return replaced ? { ...replaced, artworkId: record.id } : newDesign(record.id);
    });
    if (next.length !== current.designs?.length || next.some((design, index) => design.artworkId !== current.designs?.[index]?.artworkId)) {
      replaceDesigns(next);
    }
  }, [artwork, getValues, replaceDesigns]);

  const previewConfiguration = useWatch({ control }) as WorkingIndividualDesignsConfiguration;
  const onSubmit = async (values: IndividualDesignsFormValues) => {
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
          {designFields.map((field, designIndex) => {
            const record = artworkById.get(field.artworkId);
            return record ? <DesignCard key={field.fieldKey} record={record} designIndex={designIndex} control={control} register={register} setValue={setValue} errors={formState.errors} /> : null;
          })}
        </div>
        {addArtworkAction}
      </div>
      <IndividualDesignsLayoutPreview
        artwork={artwork}
        configuration={previewConfiguration}
        customSpacingError={formState.errors.layoutPreferences?.customSpacing?.message}
        onPreferencesChange={(preferences) => setValue("layoutPreferences", preferences, { shouldDirty: true, shouldValidate: true })}
      />
    </div>
    <div className="mt-8 border-t border-border pt-7"><label htmlFor="individual-notes" className={labelClassName}>Optional project notes</label><textarea id="individual-notes" rows={4} maxLength={MAX_NOTES_LENGTH} className={`${inputClassName} resize-y py-3`} {...register("notes")} /></div>
    {continueBlocked && <p className="mt-6 text-sm text-text-muted" aria-live="polite">{blockedReason}</p>}
    <StepActions backHref="/order/start" continueLabel="Continue to Review" isSubmitting={formState.isSubmitting || continueBlocked} />
  </form>;
}

function DesignCard({ record, designIndex, control, register, setValue, errors }: {
  record: CanonicalArtworkRecord; designIndex: number; control: IndividualDesignsControl;
  register: UseFormRegister<WorkingIndividualDesignsConfiguration>; setValue: UseFormSetValue<WorkingIndividualDesignsConfiguration>; errors: FieldErrors<WorkingIndividualDesignsConfiguration>;
}) {
  const wantsChanges = useWatch({ control, name: `designs.${designIndex}.wantsChanges` });
  const designError = errors.designs?.[designIndex];
  return <section role="group" aria-labelledby={`design-title-${record.id}`} className="min-w-0 border-t border-border bg-panel pt-7 first:border-t-0 first:pt-0">
    <input type="hidden" {...register(`designs.${designIndex}.artworkId`)} />
    <ArtworkIdentity record={record} previewSize="hero" hideName showMetadata={false} className="flex-col items-stretch" />
    <div className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 id={`design-title-${record.id}`} className="break-words font-display text-xl font-semibold text-text-primary">{record.originalName}</h2><ArtworkRecordActions record={record} /></div>
    <SizeVariants designIndex={designIndex} control={control} register={register} setValue={setValue} errors={errors} />
    <fieldset className="mt-6 border-t border-border pt-5">
      <legend className="text-sm font-semibold text-text-primary">Artwork changes</legend>
      <Controller control={control} name={`designs.${designIndex}.wantsChanges`} render={({ field }) => <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-6">
        {[["no", "Print as uploaded"], ["yes", "I need artwork changes"]].map(([value, label]) => <label key={value} className="flex min-h-11 items-center gap-3 text-sm text-text-primary"><input type="radio" value={value} checked={field.value === value} onChange={() => { field.onChange(value); if (value === "no") setValue(`designs.${designIndex}.changeInstructions`, "", { shouldDirty: true }); }} className="size-4 accent-primary-action" />{label}</label>)}
      </div>} />
      <FieldErrorMessage id={`design-${designIndex}-changes-error`} error={designError?.wantsChanges} />
      {wantsChanges === "yes" && <div className="mt-4"><label htmlFor={`design-${designIndex}-instructions`} className={labelClassName}>Requested changes</label><textarea id={`design-${designIndex}-instructions`} rows={4} maxLength={MAX_CHANGE_INSTRUCTIONS_LENGTH} className={`${inputClassName} resize-y py-3`} placeholder="Describe the change for our review. This does not promise feasibility or calculate a fee." aria-invalid={Boolean(designError?.changeInstructions)} aria-describedby={`design-${designIndex}-instructions-error`} {...register(`designs.${designIndex}.changeInstructions`)} /><FieldErrorMessage id={`design-${designIndex}-instructions-error`} error={designError?.changeInstructions} /></div>}
    </fieldset>
  </section>;
}
