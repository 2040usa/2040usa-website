import { z } from "zod";
import { MAX_DYNAMIC_ROWS, MAX_NOTES_LENGTH, ORDER_ROUTE_VALUES } from "@/lib/order-draft/constants";
import { garmentSources, printLocations, projectTypes } from "@/lib/order-draft/types";

const numericInput = (value: unknown) => {
  if (typeof value !== "string") return value;
  if (value.trim() === "") return undefined;
  return Number(value);
};
const positiveNumberSchema = (label: string) => z.number({ error: `${label} is required.` }).finite(`${label} must be a finite number.`).positive(`${label} must be greater than zero.`);
const positiveNumber = (label: string) => z.preprocess(numericInput, positiveNumberSchema(label));
const positiveWholeNumber = (label: string) => z.preprocess(numericInput, positiveNumberSchema(label).int(`${label} must be a whole number.`));
const notesSchema = z.string().max(MAX_NOTES_LENGTH, `Notes must be ${MAX_NOTES_LENGTH} characters or fewer.`);
const rowIdSchema = z.string().min(1, "Each row needs a stable identifier.");

export const orderRouteSchema = z.enum(ORDER_ROUTE_VALUES);

export const gangSheetConfigurationSchema = z.object({
  route: z.literal("gang-sheet"),
  sheetCount: positiveWholeNumber("Number of sheets"),
  finishedWidth: positiveNumber("Finished width"),
  finishedLength: positiveNumber("Finished length"),
  notes: notesSchema,
});

const designRowSchema = z.object({
  id: rowIdSchema,
  label: z.string().trim().min(1, "Design label is required.").max(100, "Design label must be 100 characters or fewer."),
  width: positiveNumber("Print width"),
  quantity: positiveWholeNumber("Quantity"),
});

const sizeRowSchema = z.object({
  id: rowIdSchema,
  width: positiveNumber("Print width"),
  quantity: positiveWholeNumber("Quantity"),
});

function uniqueRowIds<T extends { id: string }>(rows: T[], context: z.RefinementCtx) {
  if (new Set(rows.map((row) => row.id)).size !== rows.length) {
    context.addIssue({ code: "custom", message: "Every row must have a unique stable identifier." });
  }
}

export const separateArtworkConfigurationSchema = z.object({
  route: z.literal("separate-artwork"),
  designs: z.array(designRowSchema)
    .min(1, "Add at least one design.")
    .max(MAX_DYNAMIC_ROWS, `Use no more than ${MAX_DYNAMIC_ROWS} designs in this prototype.`)
    .superRefine(uniqueRowIds),
  notes: notesSchema,
});

export const transfersBySizeConfigurationSchema = z.object({
  route: z.literal("transfers-by-size"),
  designLabel: z.string().trim().min(1, "Design label is required.").max(100, "Design label must be 100 characters or fewer."),
  sizes: z.array(sizeRowSchema)
    .min(1, "Add at least one size.")
    .max(MAX_DYNAMIC_ROWS, `Use no more than ${MAX_DYNAMIC_ROWS} sizes in this prototype.`)
    .superRefine(uniqueRowIds),
  notes: notesSchema,
});

export const fullApparelConfigurationSchema = z.object({
  route: z.literal("full-apparel"),
  garmentSource: z.preprocess((value) => value === "" ? undefined : value, z.enum(garmentSources, { error: "Choose a garment source." })),
  projectType: z.preprocess((value) => value === "" ? undefined : value, z.enum(projectTypes, { error: "Choose a project type." })),
  garmentQuantity: positiveWholeNumber("Estimated garment quantity"),
  printLocations: z.array(z.enum(printLocations)).min(1, "Choose at least one print location."),
  notes: notesSchema,
});

export const orderConfigurationSchema = z.discriminatedUnion("route", [
  gangSheetConfigurationSchema,
  separateArtworkConfigurationSchema,
  transfersBySizeConfigurationSchema,
  fullApparelConfigurationSchema,
]);

const workingRowIdSchema = z.string().min(1).max(100);
const workingTextSchema = z.string().max(MAX_NOTES_LENGTH);
const workingNumericSchema = z.string().max(40);

export const workingOrderConfigurationSchema = z.discriminatedUnion("route", [
  z.object({
    route: z.literal("gang-sheet"),
    sheetCount: workingNumericSchema,
    finishedWidth: workingNumericSchema,
    finishedLength: workingNumericSchema,
    notes: workingTextSchema,
  }),
  z.object({
    route: z.literal("separate-artwork"),
    designs: z.array(z.object({ id: workingRowIdSchema, label: z.string().max(100), width: workingNumericSchema, quantity: workingNumericSchema })).min(1).max(MAX_DYNAMIC_ROWS).superRefine(uniqueRowIds),
    notes: workingTextSchema,
  }),
  z.object({
    route: z.literal("transfers-by-size"),
    designLabel: z.string().max(100),
    sizes: z.array(z.object({ id: workingRowIdSchema, width: workingNumericSchema, quantity: workingNumericSchema })).min(1).max(MAX_DYNAMIC_ROWS).superRefine(uniqueRowIds),
    notes: workingTextSchema,
  }),
  z.object({
    route: z.literal("full-apparel"),
    garmentSource: z.union([z.literal(""), z.enum(garmentSources)]),
    projectType: z.union([z.literal(""), z.enum(projectTypes)]),
    garmentQuantity: workingNumericSchema,
    printLocations: z.array(z.enum(printLocations)).max(printLocations.length),
    notes: workingTextSchema,
  }),
]);

export type GangSheetFormValues = z.infer<typeof gangSheetConfigurationSchema>;
export type SeparateArtworkFormValues = z.infer<typeof separateArtworkConfigurationSchema>;
export type TransfersBySizeFormValues = z.infer<typeof transfersBySizeConfigurationSchema>;
export type FullApparelFormValues = z.infer<typeof fullApparelConfigurationSchema>;
