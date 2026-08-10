import { z } from "zod";
import {
  MAX_CHANGE_INSTRUCTIONS_LENGTH,
  MAX_DYNAMIC_ROWS,
  MAX_NOTES_LENGTH,
  MAX_PRINT_DIMENSION_INCHES,
  MAX_PRINT_QUANTITY,
  ORDER_ROUTE_VALUES,
} from "@/lib/order-draft/constants";
import {
  DEFAULT_LAYOUT_MODE,
  DEFAULT_SPACING_INCHES,
  MAX_CUSTOM_SPACING_INCHES,
  MIN_CUSTOM_SPACING_INCHES,
  SPACING_PRESETS,
} from "@/lib/gang-sheet-layout/constants";

const numericInput = (value: unknown) => {
  if (typeof value !== "string") return value;
  if (value.trim() === "") return undefined;
  return Number(value);
};
const positiveNumberSchema = (label: string) => z.number({ error: `${label} is required.` }).finite(`${label} must be a finite number.`).positive(`${label} must be greater than zero.`);
const boundedDimension = (label: string) => z.preprocess(numericInput, positiveNumberSchema(label).max(MAX_PRINT_DIMENSION_INCHES, `${label} must be ${MAX_PRINT_DIMENSION_INCHES} inches or less.`));
const quantity = z.preprocess(numericInput, positiveNumberSchema("Quantity").int("Quantity must be a whole number.").max(MAX_PRINT_QUANTITY, `Quantity must be ${MAX_PRINT_QUANTITY} or less.`));
const notesSchema = z.string().max(MAX_NOTES_LENGTH, `Notes must be ${MAX_NOTES_LENGTH} characters or fewer.`);
const stableIdSchema = z.string().min(1, "Each size needs a stable identifier.").max(100);
const artworkIdSchema = z.uuid("Artwork identifier is invalid.");
const layoutModeSchema = z.enum(["efficient", "grouped"]);
const completedLayoutPreferencesSchema = z.object({
  mode: layoutModeSchema,
  spacing: z.number().finite().min(MIN_CUSTOM_SPACING_INCHES).max(MAX_CUSTOM_SPACING_INCHES),
}).strict().default({ mode: DEFAULT_LAYOUT_MODE, spacing: DEFAULT_SPACING_INCHES });
const workingLayoutPreferencesSchema = z.object({
  mode: layoutModeSchema,
  spacingPreset: z.enum(["tight", "standard", "extra", "custom"]),
  customSpacing: z.string().max(40),
}).strict().default({ mode: DEFAULT_LAYOUT_MODE, spacingPreset: "standard", customSpacing: "" });

export const orderRouteSchema = z.enum(ORDER_ROUTE_VALUES);

const gangSheetFileSchema = z.object({
  artworkId: artworkIdSchema,
  copies: quantity,
  finishedWidth: boundedDimension("Finished width"),
  finishedLength: boundedDimension("Finished length"),
}).strict();

function uniqueArtworkIds<T extends { artworkId: string }>(rows: T[], context: z.RefinementCtx) {
  if (new Set(rows.map((row) => row.artworkId)).size !== rows.length) context.addIssue({ code: "custom", message: "Each artwork file may be configured only once." });
}

export const gangSheetConfigurationSchema = z.object({
  route: z.literal("gang-sheet"),
  sheets: z.array(gangSheetFileSchema).min(1, "Upload and configure at least one gang sheet.").max(MAX_DYNAMIC_ROWS).superRefine(uniqueArtworkIds),
  notes: notesSchema,
}).strict();

const sizeVariantSchema = z.discriminatedUnion("method", [
  z.object({ id: stableIdSchema, method: z.literal("width"), width: boundedDimension("Print width"), quantity }).strict(),
  z.object({ id: stableIdSchema, method: z.literal("height"), height: boundedDimension("Print height"), quantity }).strict(),
  z.object({ id: stableIdSchema, method: z.literal("original"), quantity }).strict(),
]);

function uniqueIds<T extends { id: string }>(rows: T[], context: z.RefinementCtx) {
  if (new Set(rows.map((row) => row.id)).size !== rows.length) context.addIssue({ code: "custom", message: "Every size must have a unique stable identifier." });
}

const individualDesignSchema = z.object({
  artworkId: artworkIdSchema,
  sizes: z.array(sizeVariantSchema).min(1, "Add at least one requested size.").max(MAX_DYNAMIC_ROWS, `Use no more than ${MAX_DYNAMIC_ROWS} sizes per design.`).superRefine(uniqueIds),
  wantsChanges: z.boolean(),
  changeInstructions: z.string().max(MAX_CHANGE_INSTRUCTIONS_LENGTH, `Change instructions must be ${MAX_CHANGE_INSTRUCTIONS_LENGTH} characters or fewer.`),
}).strict().superRefine((design, context) => {
  if (design.wantsChanges && design.changeInstructions.trim().length === 0) {
    context.addIssue({ code: "custom", path: ["changeInstructions"], message: "Describe the changes you want us to review." });
  }
  if (!design.wantsChanges && design.changeInstructions.length > 0) {
    context.addIssue({ code: "custom", path: ["changeInstructions"], message: "Choose Yes before adding change instructions." });
  }
});

export const individualDesignsConfigurationSchema = z.object({
  route: z.literal("individual-designs"),
  designs: z.array(individualDesignSchema).min(1, "Upload and configure at least one design.").max(MAX_DYNAMIC_ROWS).superRefine((designs, context) => {
    uniqueArtworkIds(designs, context);
  }),
  layoutPreferences: completedLayoutPreferencesSchema,
  notes: notesSchema,
}).strict();

export const orderConfigurationSchema = z.discriminatedUnion("route", [gangSheetConfigurationSchema, individualDesignsConfigurationSchema]);

const workingTextSchema = z.string().max(MAX_NOTES_LENGTH);
const workingNumericSchema = z.string().max(40);
const workingSizeSchema = z.object({
  id: stableIdSchema,
  method: z.union([z.literal(""), z.literal("width"), z.literal("height"), z.literal("original")]),
  dimension: workingNumericSchema,
  quantity: workingNumericSchema,
}).strict();
const workingDesignSchema = z.object({
  artworkId: artworkIdSchema,
  sizes: z.array(workingSizeSchema).min(1).max(MAX_DYNAMIC_ROWS).superRefine(uniqueIds),
  wantsChanges: z.union([z.literal(""), z.literal("no"), z.literal("yes")]),
  changeInstructions: z.string().max(MAX_CHANGE_INSTRUCTIONS_LENGTH),
}).strict();

const workingGangSheetFileSchema = z.object({
  artworkId: artworkIdSchema,
  copies: workingNumericSchema,
  finishedWidth: workingNumericSchema,
  finishedLength: workingNumericSchema,
}).strict();

export const gangSheetFormSchema = z.object({
  route: z.literal("gang-sheet"),
  sheets: z.array(workingGangSheetFileSchema).min(1, "Upload and configure at least one gang sheet.").max(MAX_DYNAMIC_ROWS),
  notes: workingTextSchema,
}).strict().superRefine((configuration, context) => {
  uniqueArtworkIds(configuration.sheets, context);
  configuration.sheets.forEach((sheet, index) => {
    const copies = Number(sheet.copies);
    if (!Number.isInteger(copies) || copies < 1 || copies > MAX_PRINT_QUANTITY) {
      context.addIssue({ code: "custom", path: ["sheets", index, "copies"], message: `Enter whole-number copies from 1 to ${MAX_PRINT_QUANTITY}.` });
    }
    for (const [field, label] of [["finishedWidth", "Finished width"], ["finishedLength", "Finished length"]] as const) {
      const dimension = Number(sheet[field]);
      if (!Number.isFinite(dimension) || dimension <= 0 || dimension > MAX_PRINT_DIMENSION_INCHES) {
        context.addIssue({ code: "custom", path: ["sheets", index, field], message: `${label} must be greater than 0 and no more than ${MAX_PRINT_DIMENSION_INCHES} inches.` });
      }
    }
  });
}).transform((configuration) => gangSheetConfigurationSchema.parse({
  route: configuration.route,
  notes: configuration.notes,
  sheets: configuration.sheets.map((sheet) => ({
    artworkId: sheet.artworkId,
    copies: Number(sheet.copies),
    finishedWidth: Number(sheet.finishedWidth),
    finishedLength: Number(sheet.finishedLength),
  })),
}));

export const individualDesignsFormSchema = z.object({
  route: z.literal("individual-designs"),
  designs: z.array(workingDesignSchema).min(1, "Upload and configure at least one design.").max(MAX_DYNAMIC_ROWS),
  layoutPreferences: workingLayoutPreferencesSchema,
  notes: workingTextSchema,
}).strict().superRefine((configuration, context) => {
  if (new Set(configuration.designs.map((design) => design.artworkId)).size !== configuration.designs.length) {
    context.addIssue({ code: "custom", path: ["designs"], message: "Each artwork file may be configured only once." });
  }
  configuration.designs.forEach((design, designIndex) => {
    design.sizes.forEach((size, sizeIndex) => {
      if (!size.method) context.addIssue({ code: "custom", path: ["designs", designIndex, "sizes", sizeIndex, "method"], message: "Choose one sizing method." });
      if (!Number.isInteger(Number(size.quantity)) || Number(size.quantity) < 1 || Number(size.quantity) > MAX_PRINT_QUANTITY) {
        context.addIssue({ code: "custom", path: ["designs", designIndex, "sizes", sizeIndex, "quantity"], message: `Enter a whole-number quantity from 1 to ${MAX_PRINT_QUANTITY}.` });
      }
      if (size.method === "width" || size.method === "height") {
        const dimension = Number(size.dimension);
        if (!Number.isFinite(dimension) || dimension <= 0 || dimension > MAX_PRINT_DIMENSION_INCHES) {
          context.addIssue({ code: "custom", path: ["designs", designIndex, "sizes", sizeIndex, "dimension"], message: `Enter a dimension from greater than 0 to ${MAX_PRINT_DIMENSION_INCHES} inches.` });
        }
      }
      if (size.method === "original" && size.dimension.trim()) {
        context.addIssue({ code: "custom", path: ["designs", designIndex, "sizes", sizeIndex, "dimension"], message: "Original-size requests cannot include an editable dimension." });
      }
    });
    if (!design.wantsChanges) context.addIssue({ code: "custom", path: ["designs", designIndex, "wantsChanges"], message: "Choose whether you want artwork changes." });
    if (design.wantsChanges === "yes" && !design.changeInstructions.trim()) context.addIssue({ code: "custom", path: ["designs", designIndex, "changeInstructions"], message: "Describe the changes you want us to review." });
    if (design.wantsChanges !== "yes" && design.changeInstructions.length > 0) context.addIssue({ code: "custom", path: ["designs", designIndex, "changeInstructions"], message: "Choose Yes before adding change instructions." });
  });
  if (configuration.layoutPreferences.spacingPreset === "custom") {
    const spacing = Number(configuration.layoutPreferences.customSpacing);
    if (!Number.isFinite(spacing) || spacing < MIN_CUSTOM_SPACING_INCHES || spacing > MAX_CUSTOM_SPACING_INCHES) {
      context.addIssue({ code: "custom", path: ["layoutPreferences", "customSpacing"], message: `Enter custom spacing from ${MIN_CUSTOM_SPACING_INCHES} to ${MAX_CUSTOM_SPACING_INCHES} inches.` });
    }
  }
}).transform((configuration) => individualDesignsConfigurationSchema.parse({
  route: configuration.route,
  notes: configuration.notes,
  layoutPreferences: {
    mode: configuration.layoutPreferences.mode,
    spacing: configuration.layoutPreferences.spacingPreset === "custom"
      ? Number(configuration.layoutPreferences.customSpacing)
      : SPACING_PRESETS[configuration.layoutPreferences.spacingPreset],
  },
  designs: configuration.designs.map((design) => ({
    artworkId: design.artworkId,
    wantsChanges: design.wantsChanges === "yes",
    changeInstructions: design.changeInstructions,
    sizes: design.sizes.map((size) => size.method === "width"
      ? { id: size.id, method: "width", width: Number(size.dimension), quantity: Number(size.quantity) }
      : size.method === "height"
        ? { id: size.id, method: "height", height: Number(size.dimension), quantity: Number(size.quantity) }
        : { id: size.id, method: "original", quantity: Number(size.quantity) }),
  })),
}));

export const workingOrderConfigurationSchema = z.discriminatedUnion("route", [
  z.object({ route: z.literal("gang-sheet"), sheets: z.array(workingGangSheetFileSchema).max(MAX_DYNAMIC_ROWS).superRefine(uniqueArtworkIds), notes: workingTextSchema }).strict(),
  z.object({
    route: z.literal("individual-designs"),
    designs: z.array(workingDesignSchema).max(MAX_DYNAMIC_ROWS).superRefine((designs, context) => {
      if (new Set(designs.map((design) => design.artworkId)).size !== designs.length) context.addIssue({ code: "custom", message: "Each artwork file may be configured only once." });
    }),
    layoutPreferences: workingLayoutPreferencesSchema,
    notes: workingTextSchema,
  }).strict(),
]);

export type GangSheetFormValues = z.infer<typeof gangSheetConfigurationSchema>;
export type IndividualDesignsFormValues = z.infer<typeof individualDesignsConfigurationSchema>;
