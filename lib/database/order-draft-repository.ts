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
    if (input.selectedRoute === "individual-designs") {
      const artwork = await transaction.artworkFile.findMany({
        where: { draftId: input.id, ownerUserId: input.ownerUserId, route: "individual-designs", purpose: "individual-design", status: "uploaded" },
        select: { id: true },
      });
      const canonicalIds = new Set(artwork.map((record) => record.id));
      const working = input.workingConfiguration && typeof input.workingConfiguration === "object" && "route" in input.workingConfiguration && input.workingConfiguration.route === "individual-designs"
        ? input.workingConfiguration as unknown as { designs: { artworkId: string }[] } : null;
      if (working && working.designs.some((design) => !canonicalIds.has(design.artworkId))) throw new DraftArtworkConfigurationError("Working configuration references unavailable artwork.");
      const completed = input.configuration && typeof input.configuration === "object" && "route" in input.configuration && input.configuration.route === "individual-designs"
        ? input.configuration as unknown as { designs: { artworkId: string }[] } : null;
      if (completed) {
        const configuredIds = new Set(completed.designs.map((design) => design.artworkId));
        if (configuredIds.size !== completed.designs.length || configuredIds.size !== canonicalIds.size || [...canonicalIds].some((id) => !configuredIds.has(id))) {
          throw new DraftArtworkConfigurationError("Completed configuration must match every uploaded design.");
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
