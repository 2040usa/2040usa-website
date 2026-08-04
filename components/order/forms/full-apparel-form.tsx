"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { useRouter } from "next/navigation";
import { fullApparelConfigurationSchema, type FullApparelFormValues } from "@/lib/order-draft/schemas";
import { garmentSources, printLocations, projectTypes, type WorkingFullApparelConfiguration } from "@/lib/order-draft/types";
import { MAX_NOTES_LENGTH } from "@/lib/order-draft/constants";
import { toWorkingConfiguration } from "@/lib/order-draft/working-configuration";
import { useOrderDraft, useOrderDraftPersistence } from "@/components/order/order-draft-provider";
import { FieldErrorMessage, FormErrorSummary, inputClassName, labelClassName } from "@/components/order/forms/form-feedback";
import { useWorkingConfiguration } from "@/components/order/forms/use-working-configuration";
import { StepActions } from "@/components/order/step-actions";

const garmentSourceLabels = { "customer-supplies": "Customer supplies garments", "2040-supplies": "2040 USA supplies garments", "not-sure": "Not sure yet" } as const;
const projectTypeLabels = { "t-shirts": "T-shirts", "hoodies-sweatshirts": "Hoodies or sweatshirts", caps: "Caps", "mixed-apparel": "Mixed apparel", "other-not-sure": "Other or not sure" } as const;
const locationLabels = { front: "Front", back: "Back", "left-sleeve": "Left sleeve", "right-sleeve": "Right sleeve", "other-not-sure": "Other or not sure" } as const;
const defaults: WorkingFullApparelConfiguration = { route: "full-apparel", garmentSource: "", projectType: "", garmentQuantity: "1", printLocations: [], notes: "" };

export function FullApparelForm() {
  const router = useRouter();
  const working = useOrderDraft((state) => state.workingConfiguration?.route === "full-apparel" ? state.workingConfiguration : null);
  const completed = useOrderDraft((state) => state.configuration?.route === "full-apparel" ? state.configuration : null);
  const saveConfiguration = useOrderDraft((state) => state.saveConfiguration);
  const { flush } = useOrderDraftPersistence();
  const { register, handleSubmit, formState, watch } = useForm<WorkingFullApparelConfiguration, unknown, FullApparelFormValues>({
    resolver: zodResolver(fullApparelConfigurationSchema) as Resolver<WorkingFullApparelConfiguration, unknown, FullApparelFormValues>,
    defaultValues: working ?? (completed ? toWorkingConfiguration(completed) : defaults),
  });
  useWorkingConfiguration("full-apparel", watch);
  const onSubmit = async (values: FullApparelFormValues) => { saveConfiguration(values); if (await flush()) router.push("/order/review"); };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)}>
      <input type="hidden" {...register("route")} />
      <FormErrorSummary errors={formState.errors} submitCount={formState.submitCount} />
      <fieldset aria-describedby="garment-source-error" className="rounded-control border border-border bg-panel p-4 sm:p-5">
        <legend className="px-2 font-display text-xl uppercase text-text-primary">Garment source</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">{garmentSources.map((value) => <label key={value} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-control border border-border bg-background px-3 text-sm text-text-primary has-checked:border-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"><input type="radio" value={value} className="size-4 accent-accent" {...register("garmentSource")} />{garmentSourceLabels[value]}</label>)}</div>
        <FieldErrorMessage id="garment-source-error" error={formState.errors.garmentSource} />
      </fieldset>
      <fieldset aria-describedby="project-type-error" className="mt-5 rounded-control border border-border bg-panel p-4 sm:p-5">
        <legend className="px-2 font-display text-xl uppercase text-text-primary">Project type</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">{projectTypes.map((value) => <label key={value} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-control border border-border bg-background px-3 text-sm text-text-primary has-checked:border-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"><input type="radio" value={value} className="size-4 accent-accent" {...register("projectType")} />{projectTypeLabels[value]}</label>)}</div>
        <FieldErrorMessage id="project-type-error" error={formState.errors.projectType} />
      </fieldset>
      <div className="mt-5 max-w-sm"><label htmlFor="garment-quantity" className={labelClassName}>Estimated garment quantity</label><input id="garment-quantity" type="number" step="1" inputMode="numeric" aria-describedby="garment-quantity-error" aria-invalid={Boolean(formState.errors.garmentQuantity)} className={inputClassName} {...register("garmentQuantity")} /><FieldErrorMessage id="garment-quantity-error" error={formState.errors.garmentQuantity} /></div>
      <fieldset aria-describedby="print-locations-error" className="mt-5 rounded-control border border-border bg-panel p-4 sm:p-5">
        <legend className="px-2 font-display text-xl uppercase text-text-primary">Requested print locations</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">{printLocations.map((value) => <label key={value} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-control border border-border bg-background px-3 text-sm text-text-primary has-checked:border-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"><input type="checkbox" value={value} className="size-4 accent-accent" {...register("printLocations")} />{locationLabels[value]}</label>)}</div>
        <FieldErrorMessage id="print-locations-error" error={formState.errors.printLocations} />
      </fieldset>
      <p className="mt-5 border-l-2 border-accent pl-4 text-xs leading-5 text-text-muted">These categories help describe the project. They do not mean every project is automatically accepted.</p>
      <div className="mt-6"><label htmlFor="apparel-notes" className={labelClassName}>Optional project notes</label><textarea id="apparel-notes" rows={5} maxLength={MAX_NOTES_LENGTH} aria-describedby="apparel-notes-error" aria-invalid={Boolean(formState.errors.notes)} className={`${inputClassName} resize-y py-3`} {...register("notes")} /><FieldErrorMessage id="apparel-notes-error" error={formState.errors.notes} /></div>
      <StepActions backHref="/order/artwork" continueLabel="Review draft" isSubmitting={formState.isSubmitting} />
    </form>
  );
}
