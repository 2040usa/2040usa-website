import { z } from "zod";
import { orderConfigurationSchema, orderRouteSchema, workingOrderConfigurationSchema } from "@/lib/order-draft/schemas";
import type { CanonicalOrderDraft, CompletedStep, OrderDraftSnapshot } from "@/lib/order-draft/types";

export const uuidSchema = z.uuid();

export const bootstrapDraftRequestSchema = z.object({
  selectedRoute: orderRouteSchema,
  expectedVersion: z.number().int().positive().optional(),
}).strict();

const draftSnapshotShape = {
  selectedRoute: orderRouteSchema.nullable(),
  startingPointConfirmed: z.boolean(),
  artworkAcknowledged: z.boolean(),
  workingConfiguration: workingOrderConfigurationSchema.nullable(),
  configuration: orderConfigurationSchema.nullable(),
};

function validateLifecycle(draft: z.infer<z.ZodObject<typeof draftSnapshotShape>>, context: z.RefinementCtx) {
  if (!draft.selectedRoute) {
    if (draft.startingPointConfirmed || draft.artworkAcknowledged || draft.workingConfiguration || draft.configuration) {
      context.addIssue({ code: "custom", message: "An empty draft cannot contain progress or configuration." });
    }
    return;
  }
  if (draft.artworkAcknowledged && !draft.startingPointConfirmed) {
    context.addIssue({ code: "custom", message: "Artwork cannot be acknowledged before the starting point." });
  }
  if (draft.workingConfiguration && draft.workingConfiguration.route !== draft.selectedRoute) {
    context.addIssue({ code: "custom", message: "Working configuration route must match the selected route." });
  }
  if (draft.configuration) {
    if (!draft.startingPointConfirmed || !draft.artworkAcknowledged || draft.configuration.route !== draft.selectedRoute) {
      context.addIssue({ code: "custom", message: "Completed configuration does not match the draft lifecycle." });
    }
  }
}

export const draftSnapshotSchema = z.object(draftSnapshotShape).strict().superRefine(validateLifecycle);

export const draftSnapshotRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  ...draftSnapshotShape,
}).strict().superRefine(validateLifecycle);

export const resetDraftRequestSchema = z.object({ expectedVersion: z.number().int().positive() }).strict();

export function deriveCompletedStep(draft: Pick<OrderDraftSnapshot, "selectedRoute" | "startingPointConfirmed" | "artworkAcknowledged" | "configuration">): CompletedStep {
  if (!draft.selectedRoute || !draft.startingPointConfirmed) return 0;
  if (!draft.artworkAcknowledged) return 1;
  if (!draft.configuration || draft.configuration.route !== draft.selectedRoute) return 2;
  return 3;
}

type DatabaseDraft = {
  id: string;
  status: string;
  selectedRoute: string | null;
  startingPointConfirmed: boolean;
  artworkAcknowledged: boolean;
  workingConfiguration: unknown;
  configuration: unknown;
  version: number;
  updatedAt: Date;
};

export const canonicalOrderDraftSchema = z.object({
  ...draftSnapshotShape,
  id: uuidSchema,
  version: z.number().int().positive(),
  status: z.literal("active"),
  updatedAt: z.iso.datetime(),
  lastCompletedStep: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
}).strict().superRefine(validateLifecycle);

const currentDraftSuccessSchema = z.object({ draft: canonicalOrderDraftSchema.nullable() }).strict();
const apiErrorResponseSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }).strict() }).strict();

export class DraftResponseError extends Error {
  constructor(public readonly kind: "authentication" | "backend" | "malformed", message: string, public readonly status?: number) {
    super(message);
  }
}

export function parseCurrentDraftResponse(status: number, body: unknown) {
  if (status >= 200 && status < 300) {
    const result = currentDraftSuccessSchema.safeParse(body);
    if (!result.success) throw new DraftResponseError("malformed", "The draft service returned an invalid response.", status);
    return result.data.draft === null ? { kind: "empty" as const } : { kind: "draft" as const, draft: result.data.draft };
  }
  const error = apiErrorResponseSchema.safeParse(body);
  const message = error.success ? error.data.error.message : "The draft service returned an invalid error response.";
  if (status === 401 || status === 503) throw new DraftResponseError("authentication", message, status);
  throw new DraftResponseError(error.success ? "backend" : "malformed", message, status);
}

export function databaseDraftToCanonical(draft: DatabaseDraft): CanonicalOrderDraft {
  const selectedRoute = draft.selectedRoute === null ? null : orderRouteSchema.parse(draft.selectedRoute);
  const workingConfiguration = draft.workingConfiguration === null ? null : workingOrderConfigurationSchema.parse(draft.workingConfiguration);
  const configuration = draft.configuration === null ? null : orderConfigurationSchema.parse(draft.configuration);
  const snapshot = draftSnapshotSchema.parse({
    selectedRoute,
    startingPointConfirmed: draft.startingPointConfirmed,
    artworkAcknowledged: draft.artworkAcknowledged,
    workingConfiguration,
    configuration,
  });
  return {
    id: uuidSchema.parse(draft.id),
    status: z.literal("active").parse(draft.status),
    version: z.number().int().positive().parse(draft.version),
    updatedAt: draft.updatedAt.toISOString(),
    ...snapshot,
    lastCompletedStep: deriveCompletedStep(snapshot),
  };
}

export function clientSnapshotForServer(draft: OrderDraftSnapshot, expectedVersion: number) {
  return draftSnapshotRequestSchema.parse({
    expectedVersion,
    selectedRoute: draft.selectedRoute,
    startingPointConfirmed: draft.startingPointConfirmed,
    artworkAcknowledged: draft.artworkAcknowledged,
    workingConfiguration: draft.workingConfiguration,
    configuration: draft.configuration,
  });
}
