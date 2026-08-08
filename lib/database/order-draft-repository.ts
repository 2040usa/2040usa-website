import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";
import { databaseDraftToCanonical } from "@/lib/order-draft/durable";
import type { CanonicalOrderDraft, OrderRoute } from "@/lib/order-draft/types";

export class DraftConflictError extends Error {}
export class DraftArtworkConfigurationError extends Error {}

const jsonValue = (value: unknown) => value === null ? Prisma.DbNull : value as Prisma.InputJsonValue;

export async function findActiveDraftForOwner(ownerUserId: string) {
  const draft = await prisma.orderDraft.findFirst({ where: { ownerUserId, status: "active" } });
  return draft ? databaseDraftToCanonical(draft) : null;
}

export async function readDraftForOwner(id: string, ownerUserId: string) {
  const draft = await prisma.orderDraft.findFirst({ where: { id, ownerUserId, status: "active" } });
  return draft ? databaseDraftToCanonical(draft) : null;
}

export async function bootstrapActiveDraft(ownerUserId: string, selectedRoute: OrderRoute, expectedVersion?: number): Promise<CanonicalOrderDraft> {
  let draft = await prisma.orderDraft.findUnique({ where: { ownerUserId } });
  if (!draft) {
    try {
      draft = await prisma.orderDraft.create({ data: { ownerUserId, selectedRoute, startingPointConfirmed: true } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      draft = await prisma.orderDraft.findUniqueOrThrow({ where: { ownerUserId } });
    }
  }
  if (draft.selectedRoute === selectedRoute && draft.startingPointConfirmed) return databaseDraftToCanonical(draft);
  if (expectedVersion === undefined) throw new DraftConflictError("An existing draft requires its current version.");
  const updated = await prisma.orderDraft.updateManyAndReturn({
    where: { id: draft.id, ownerUserId, status: "active", version: expectedVersion },
    data: {
      selectedRoute,
      startingPointConfirmed: true,
      artworkAcknowledged: false,
      workingConfiguration: Prisma.DbNull,
      configuration: Prisma.DbNull,
      version: { increment: 1 },
    },
  });
  if (updated.length === 1) return databaseDraftToCanonical(updated[0]);
  if (await readDraftForOwner(draft.id, ownerUserId)) throw new DraftConflictError("Draft version conflict.");
  throw new Error("Draft not found.");
}

export async function updateDraftForOwner(input: {
  id: string;
  ownerUserId: string;
  expectedVersion: number;
  selectedRoute: OrderRoute | null;
  startingPointConfirmed: boolean;
  artworkAcknowledged: boolean;
  workingConfiguration: unknown;
  configuration: unknown;
}) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`select pg_advisory_xact_lock(hashtextextended(${input.id}, 0))`;
    const existing = await transaction.orderDraft.findFirst({ where: { id: input.id, ownerUserId: input.ownerUserId, status: "active" } });
    if (!existing) return null;
    if (existing.version !== input.expectedVersion) throw new DraftConflictError("Draft version conflict.");
    if (input.selectedRoute) {
      const purpose = input.selectedRoute === "gang-sheet" ? "gang-sheet-file" : "individual-design";
      const artwork = await transaction.artworkFile.findMany({
        where: { draftId: input.id, ownerUserId: input.ownerUserId, route: input.selectedRoute, purpose, status: "uploaded" },
        select: { id: true },
      });
      const canonicalIds = new Set(artwork.map((record) => record.id));
      const entryKey = input.selectedRoute === "gang-sheet" ? "sheets" : "designs";
      const working = configurationEntries(input.workingConfiguration, input.selectedRoute, entryKey);
      if (working && working.some((entry) => !canonicalIds.has(entry.artworkId))) throw new DraftArtworkConfigurationError("Working configuration references unavailable artwork.");
      const completed = configurationEntries(input.configuration, input.selectedRoute, entryKey);
      if (completed) {
        const configuredIds = new Set(completed.map((entry) => entry.artworkId));
        if (configuredIds.size !== completed.length || configuredIds.size !== canonicalIds.size || [...canonicalIds].some((id) => !configuredIds.has(id))) {
          throw new DraftArtworkConfigurationError("Completed configuration must match every uploaded artwork file.");
        }
      }
    }
    const result = await transaction.orderDraft.update({
      where: { id: existing.id },
      data: {
        selectedRoute: input.selectedRoute,
        startingPointConfirmed: input.startingPointConfirmed,
        artworkAcknowledged: input.artworkAcknowledged,
        workingConfiguration: jsonValue(input.workingConfiguration),
        configuration: jsonValue(input.configuration),
        version: { increment: 1 },
      },
    });
    return databaseDraftToCanonical(result);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

function configurationEntries(value: unknown, route: OrderRoute, entryKey: "sheets" | "designs") {
  if (!value || typeof value !== "object") return null;
  const object = value as Record<string, unknown>;
  if (object.route !== route || !Array.isArray(object[entryKey])) return null;
  return object[entryKey].flatMap((entry) => entry && typeof entry === "object" && "artworkId" in entry && typeof entry.artworkId === "string" ? [{ artworkId: entry.artworkId }] : []);
}

export async function resetDraftForOwner(id: string, ownerUserId: string, expectedVersion: number) {
  const result = await prisma.orderDraft.updateManyAndReturn({
    where: { id, ownerUserId, status: "active", version: expectedVersion },
    data: {
      selectedRoute: null,
      startingPointConfirmed: false,
      artworkAcknowledged: false,
      workingConfiguration: Prisma.DbNull,
      configuration: Prisma.DbNull,
      version: { increment: 1 },
    },
  });
  if (result.length === 0) {
    if (await readDraftForOwner(id, ownerUserId)) throw new DraftConflictError("Draft version conflict.");
    return null;
  }
  return databaseDraftToCanonical(result[0]);
}
