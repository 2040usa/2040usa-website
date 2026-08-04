import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";
import {
  UPLOAD_ATTEMPT_HOURS,
  ARTWORK_BUCKET,
  MAX_ARTWORK_DRAFT_BYTES,
  MAX_ARTWORK_FILES,
  ARTWORK_POLICY_BY_ROUTE,
} from "@/lib/artwork/constants";
import { databaseArtworkToCanonical } from "@/lib/artwork/mapping";
import { calculateArtworkReadiness } from "@/lib/artwork/readiness";
import { canReuseArtworkTransport, classifyArtworkRecovery } from "@/lib/artwork/recovery-classification";
import type { ArtworkFailureCode, CanonicalArtworkRecord } from "@/lib/artwork/types";
import type { ReserveArtworkRequest } from "@/lib/artwork/schemas";
import type { OrderRoute } from "@/lib/order-draft/types";
import { databaseDraftToCanonical } from "@/lib/order-draft/durable";

export class ArtworkConflictError extends Error {}
export class ArtworkQuotaError extends Error {}
export class ArtworkRouteError extends Error {}
export class ArtworkNotFoundError extends Error {}
export class ArtworkIdempotencyConflictError extends Error {}
export class ArtworkRecoveryError extends Error {}
export class ArtworkCleanupIncompleteError extends Error {}

type StorageObject = { name: string; owner_id: string | null; metadata: unknown };

type ArtworkRow = Prisma.ArtworkFileGetPayload<object>;

function reservationMatches(row: ArtworkRow, input: ReserveArtworkRequest & { draftId: string; ownerUserId: string }) {
  const recoveryMatches = row.recoveryOfId === (input.recoverArtworkId ?? null);
  return row.draftId === input.draftId
    && row.ownerUserId === input.ownerUserId
    && row.originalName === input.originalName
    && Number(row.declaredSizeBytes) === input.declaredSizeBytes
    && row.extension === input.extension
    && row.mimeType === input.mimeType
    && (row.clientLastModified === null ? null : Number(row.clientLastModified)) === input.clientLastModified
    && row.clientFingerprint === input.clientFingerprint
    && row.purpose === input.purpose
    && row.replacementForId === (input.replacementForArtworkId ?? null)
    && recoveryMatches;
}

function recoveryMatches(row: ArtworkRow, input: ReserveArtworkRequest & { draftId: string; ownerUserId: string }, route: OrderRoute) {
  return row.ownerUserId === input.ownerUserId
    && row.draftId === input.draftId
    && row.route === route
    && row.purpose === input.purpose
    && row.originalName === input.originalName
    && Number(row.declaredSizeBytes) === input.declaredSizeBytes
    && row.mimeType === input.mimeType
    && row.extension === input.extension
    && (row.clientLastModified === null ? null : Number(row.clientLastModified)) === input.clientLastModified
    && row.clientFingerprint === input.clientFingerprint
    && row.replacementForId === (input.replacementForArtworkId ?? null);
}

export async function listArtworkForOwner(draftId: string, ownerUserId: string) {
  const rows = await prisma.artworkFile.findMany({
    where: { draftId, ownerUserId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(databaseArtworkToCanonical);
}

export async function readArtworkForOwner(id: string, draftId: string, ownerUserId: string) {
  const row = await prisma.artworkFile.findFirst({ where: { id, draftId, ownerUserId } });
  return row ? databaseArtworkToCanonical(row) : null;
}

export async function inspectArtworkObject(storagePath: string) {
  const rows = await prisma.$queryRaw<StorageObject[]>`
    select name, owner_id, metadata
    from storage.objects
    where bucket_id = ${ARTWORK_BUCKET} and name = ${storagePath}
    limit 1
  `;
  return rows[0] ?? null;
}

export function storageObjectMetadata(object: StorageObject) {
  const metadata = object.metadata && typeof object.metadata === "object" ? object.metadata as Record<string, unknown> : {};
  const size = typeof metadata.size === "number" ? metadata.size : Number(metadata.size);
  const mimeType = typeof metadata.mimetype === "string" ? metadata.mimetype : typeof metadata.contentType === "string" ? metadata.contentType : null;
  return { size: Number.isSafeInteger(size) ? size : null, mimeType };
}

export async function reserveArtworkForOwner(input: ReserveArtworkRequest & { draftId: string; ownerUserId: string }) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`select pg_advisory_xact_lock(hashtextextended(${input.draftId}, 0))`;
    const draft = await transaction.orderDraft.findFirst({
      where: { id: input.draftId, ownerUserId: input.ownerUserId, status: "active" },
    });
    if (!draft) return null;
    if (!draft.selectedRoute || !draft.startingPointConfirmed) throw new ArtworkRouteError();
    const route = draft.selectedRoute as OrderRoute;
    const policy = ARTWORK_POLICY_BY_ROUTE[route];
    if (policy.purpose !== input.purpose) throw new ArtworkRouteError();

    const duplicate = await transaction.artworkFile.findUnique({
      where: { draftId_idempotencyKey: { draftId: input.draftId, idempotencyKey: input.idempotencyKey } },
    });
    if (duplicate) {
      if (!reservationMatches(duplicate, input)) throw new ArtworkIdempotencyConflictError();
      const canonicalDuplicate = databaseArtworkToCanonical(duplicate);
      if (duplicate.status === "uploaded") {
        return { record: canonicalDuplicate, storagePath: duplicate.storagePath, uploadRequired: false };
      }
      const duplicateRecovery = classifyArtworkRecovery(canonicalDuplicate);
      if (!canReuseArtworkTransport(duplicateRecovery)) throw new ArtworkRecoveryError();
      const reusableDuplicate = duplicateRecovery.kind === "retry"
        ? await transaction.artworkFile.update({
            where: { id: duplicate.id },
            data: { status: "pending", failureCode: null, version: { increment: 1 } },
          })
        : duplicate;
      return { record: databaseArtworkToCanonical(reusableDuplicate), storagePath: reusableDuplicate.storagePath, uploadRequired: true };
    }

    let recoveryOfId: string | null = null;
    if (input.recoverArtworkId) {
      const recoverable = await transaction.artworkFile.findFirst({
        where: { id: input.recoverArtworkId, draftId: input.draftId, ownerUserId: input.ownerUserId },
      });
      if (!recoverable) throw new ArtworkNotFoundError();
      if (!recoveryMatches(recoverable, input, route)) {
        throw new ArtworkRecoveryError();
      }

      const recovery = classifyArtworkRecovery(databaseArtworkToCanonical(recoverable));
      if (canReuseArtworkTransport(recovery)) {
        const reusable = recovery.kind === "retry"
          ? await transaction.artworkFile.update({
              where: { id: recoverable.id },
              data: { status: "pending", failureCode: null, version: { increment: 1 } },
            })
          : recoverable;
        return { record: databaseArtworkToCanonical(reusable), storagePath: reusable.storagePath, uploadRequired: true };
      }

      if (recovery.kind !== "restart-expired" && recovery.kind !== "restart-missing") {
        throw new ArtworkRecoveryError();
      }

      const objects = await transaction.$queryRaw<StorageObject[]>`
        select name, owner_id, metadata
        from storage.objects
        where bucket_id = ${ARTWORK_BUCKET} and name = ${recoverable.storagePath}
        limit 1
      `;
      const object = objects[0];
      if (object) {
        const metadata = storageObjectMetadata(object);
        if (recovery.kind === "restart-missing" || object.owner_id !== input.ownerUserId || metadata.size !== input.declaredSizeBytes || metadata.mimeType !== input.mimeType) {
          throw new ArtworkRecoveryError();
        }
        const uploaded = await transaction.artworkFile.update({
          where: { id: recoverable.id },
          data: {
            status: "uploaded",
            uploadedAt: new Date(),
            verifiedSizeBytes: BigInt(input.declaredSizeBytes),
            verifiedMimeType: input.mimeType,
            failureCode: null,
            version: { increment: 1 },
          },
        });
        return { record: databaseArtworkToCanonical(uploaded), storagePath: uploaded.storagePath, uploadRequired: false };
      }

      recoveryOfId = recoverable.id;
      await transaction.artworkFile.delete({ where: { id: recoverable.id } });
    }

    const totals = await transaction.artworkFile.aggregate({
      where: { draftId: input.draftId, ownerUserId: input.ownerUserId, status: { not: "deleting" } },
      _count: true,
      _sum: { declaredSizeBytes: true },
    });
    if (totals._count >= MAX_ARTWORK_FILES || Number(totals._sum.declaredSizeBytes ?? BigInt(0)) + input.declaredSizeBytes > MAX_ARTWORK_DRAFT_BYTES) throw new ArtworkQuotaError();
    if (route === "transfers-by-size" && totals._count > 0) {
      if (!input.replacementForArtworkId) throw new ArtworkQuotaError();
      const replacementTarget = await transaction.artworkFile.findFirst({
        where: { id: input.replacementForArtworkId, draftId: input.draftId, ownerUserId: input.ownerUserId, status: "uploaded", route },
      });
      const existingReplacement = await transaction.artworkFile.findFirst({
        where: { draftId: input.draftId, ownerUserId: input.ownerUserId, replacementForId: input.replacementForArtworkId, status: { in: ["pending", "failed"] } },
      });
      if (!replacementTarget || existingReplacement) throw new ArtworkQuotaError();
    }

    const id = crypto.randomUUID();
    const storagePath = `users/${input.ownerUserId}/drafts/${input.draftId}/artwork/${id}/original.${input.extension}`;
    const created = await transaction.artworkFile.create({
      data: {
        id,
        draftId: input.draftId,
        ownerUserId: input.ownerUserId,
        route,
        purpose: input.purpose,
        originalName: input.originalName,
        extension: input.extension,
        mimeType: input.mimeType,
        declaredSizeBytes: BigInt(input.declaredSizeBytes),
        clientLastModified: input.clientLastModified === null ? null : BigInt(input.clientLastModified),
        clientFingerprint: input.clientFingerprint,
        idempotencyKey: input.idempotencyKey,
        recoveryOfId,
        storagePath,
        attemptExpiresAt: new Date(Date.now() + UPLOAD_ATTEMPT_HOURS * 60 * 60 * 1000),
        replacementForId: input.replacementForArtworkId,
      },
    });
    return { record: databaseArtworkToCanonical(created), storagePath: created.storagePath, uploadRequired: true };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2002");
      if (!retryable || attempt === 2) throw error;
    }
  }
  throw new Error("Artwork reservation retry limit reached.");
}

export async function acknowledgeReadyArtwork(input: { draftId: string; ownerUserId: string; expectedVersion: number }) {
  return prisma.$transaction(async (transaction) => {
    const artworkRows = await transaction.artworkFile.findMany({ where: { draftId: input.draftId, ownerUserId: input.ownerUserId } });
    const draft = await transaction.orderDraft.findFirst({ where: { id: input.draftId, ownerUserId: input.ownerUserId, status: "active" } });
    if (!draft) return null;
    const canonical = artworkRows.map(databaseArtworkToCanonical);
    if (!calculateArtworkReadiness(draft.selectedRoute as OrderRoute | null, canonical).ready) throw new ArtworkRouteError();
    const updated = await transaction.orderDraft.updateManyAndReturn({
      where: { id: input.draftId, ownerUserId: input.ownerUserId, status: "active", version: input.expectedVersion },
      data: { artworkAcknowledged: true, version: { increment: 1 } },
    });
    if (updated[0]) return { draft: updated[0], artwork: canonical, readiness: calculateArtworkReadiness(draft.selectedRoute as OrderRoute, canonical) };
    throw new ArtworkConflictError();
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function markArtworkUploaded(input: { id: string; draftId: string; ownerUserId: string; expectedVersion: number; size: number; mimeType: string }) {
  const rows = await prisma.artworkFile.updateManyAndReturn({
    where: { id: input.id, draftId: input.draftId, ownerUserId: input.ownerUserId, version: input.expectedVersion, status: { in: ["pending", "failed"] } },
    data: {
      status: "uploaded", uploadedAt: new Date(), verifiedSizeBytes: BigInt(input.size), verifiedMimeType: input.mimeType,
      failureCode: null, version: { increment: 1 },
    },
  });
  if (rows[0]) return databaseArtworkToCanonical(rows[0]);
  const current = await readArtworkForOwner(input.id, input.draftId, input.ownerUserId);
  if (current?.status === "uploaded") return current;
  if (current) throw new ArtworkConflictError();
  return null;
}

export async function markArtworkFailed(input: { id: string; draftId: string; ownerUserId: string; expectedVersion?: number; failureCode: ArtworkFailureCode; allowUploaded?: boolean }) {
  const rows = await prisma.artworkFile.updateManyAndReturn({
    where: {
      id: input.id,
      draftId: input.draftId,
      ownerUserId: input.ownerUserId,
      status: { in: input.allowUploaded ? ["pending", "failed", "uploaded"] : ["pending", "failed"] },
      ...(input.expectedVersion ? { version: input.expectedVersion } : {}),
    },
    data: { status: "failed", failureCode: input.failureCode, uploadedAt: null, verifiedSizeBytes: null, verifiedMimeType: null, version: { increment: 1 } },
  });
  return rows[0] ? databaseArtworkToCanonical(rows[0]) : null;
}

export async function markArtworkDeleting(input: { id: string; draftId: string; ownerUserId: string; expectedVersion: number }) {
  const rows = await prisma.artworkFile.updateManyAndReturn({
    where: { id: input.id, draftId: input.draftId, ownerUserId: input.ownerUserId, version: input.expectedVersion },
    data: { status: "deleting", failureCode: null, uploadedAt: null, verifiedSizeBytes: null, verifiedMimeType: null, version: { increment: 1 } },
  });
  if (rows[0]) return { canonical: databaseArtworkToCanonical(rows[0]), storagePath: rows[0].storagePath };
  if (await readArtworkForOwner(input.id, input.draftId, input.ownerUserId)) throw new ArtworkConflictError();
  return null;
}

export async function deleteArtworkRowForOwner(id: string, draftId: string, ownerUserId: string) {
  const result = await prisma.artworkFile.deleteMany({ where: { id, draftId, ownerUserId, status: "deleting" } });
  return result.count === 1;
}

export async function countArtworkRowsForOwner(draftId: string, ownerUserId: string) {
  return prisma.artworkFile.count({ where: { draftId, ownerUserId } });
}

export async function artworkSnapshotForOwner(draftId: string, ownerUserId: string) {
  const artwork = await listArtworkForOwner(draftId, ownerUserId);
  const draft = await prisma.orderDraft.findFirst({ where: { id: draftId, ownerUserId, status: "active" }, select: { selectedRoute: true } });
  return { artwork, readiness: calculateArtworkReadiness(draft?.selectedRoute as OrderRoute | null ?? null, artwork) };
}

export type PreparedArtworkCleanupRecord = {
  id: string;
  version: number;
  storageBucket: string;
  storagePath: string;
};

export async function prepareDraftArtworkCleanup(input: { draftId: string; ownerUserId: string; expectedDraftVersion: number }) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`select pg_advisory_xact_lock(hashtextextended(${input.draftId}, 0))`;
    const draft = await transaction.orderDraft.findFirst({
      where: { id: input.draftId, ownerUserId: input.ownerUserId, status: "active" },
    });
    if (!draft) return null;
    if (draft.version !== input.expectedDraftVersion) throw new ArtworkConflictError();

    await transaction.artworkFile.updateMany({
      where: { draftId: input.draftId, ownerUserId: input.ownerUserId, status: { not: "deleting" } },
      data: {
        status: "deleting",
        failureCode: null,
        uploadedAt: null,
        verifiedSizeBytes: null,
        verifiedMimeType: null,
        version: { increment: 1 },
      },
    });

    const progressChanges = draft.artworkAcknowledged || draft.configuration !== null;
    const preparedDraft = progressChanges
      ? await transaction.orderDraft.update({
          where: { id: draft.id },
          data: { artworkAcknowledged: false, configuration: Prisma.DbNull, version: { increment: 1 } },
        })
      : draft;
    const rows = await transaction.artworkFile.findMany({
      where: { draftId: input.draftId, ownerUserId: input.ownerUserId, status: "deleting" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return {
      draft: databaseDraftToCanonical(preparedDraft),
      cleanup: rows.map((row) => ({ id: row.id, version: row.version, storageBucket: row.storageBucket, storagePath: row.storagePath })),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function prepareArtworkDeletion(input: {
  id: string;
  draftId: string;
  ownerUserId: string;
  expectedArtworkVersion: number;
  expectedDraftVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`select pg_advisory_xact_lock(hashtextextended(${input.draftId}, 0))`;
    const draft = await transaction.orderDraft.findFirst({
      where: { id: input.draftId, ownerUserId: input.ownerUserId, status: "active" },
    });
    if (!draft) return null;
    if (draft.version !== input.expectedDraftVersion) throw new ArtworkConflictError();
    const artwork = await transaction.artworkFile.findFirst({
      where: { id: input.id, draftId: input.draftId, ownerUserId: input.ownerUserId },
    });
    if (!artwork) return null;
    if (artwork.version !== input.expectedArtworkVersion && artwork.status !== "deleting") throw new ArtworkConflictError();
    const deleting = artwork.status === "deleting" ? artwork : await transaction.artworkFile.update({
      where: { id: artwork.id },
      data: {
        status: "deleting",
        failureCode: null,
        uploadedAt: null,
        verifiedSizeBytes: null,
        verifiedMimeType: null,
        version: { increment: 1 },
      },
    });
    const remaining = await transaction.artworkFile.findMany({
      where: { draftId: input.draftId, ownerUserId: input.ownerUserId },
    });
    const readiness = calculateArtworkReadiness(draft.selectedRoute as OrderRoute | null, remaining.map(databaseArtworkToCanonical));
    const revokeProgress = !readiness.ready && (draft.artworkAcknowledged || draft.configuration !== null);
    const preparedDraft = revokeProgress
      ? await transaction.orderDraft.update({
          where: { id: draft.id },
          data: { artworkAcknowledged: false, configuration: Prisma.DbNull, version: { increment: 1 } },
        })
      : draft;
    return {
      draft: databaseDraftToCanonical(preparedDraft),
      cleanup: { id: deleting.id, version: deleting.version, storageBucket: deleting.storageBucket, storagePath: deleting.storagePath },
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function revokeArtworkProgressForOwner(input: { draftId: string; ownerUserId: string; expectedDraftVersion: number }) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`select pg_advisory_xact_lock(hashtextextended(${input.draftId}, 0))`;
    const draft = await transaction.orderDraft.findFirst({ where: { id: input.draftId, ownerUserId: input.ownerUserId, status: "active" } });
    if (!draft) return null;
    if (draft.version !== input.expectedDraftVersion) throw new ArtworkConflictError();
    if (!draft.artworkAcknowledged && draft.configuration === null) return databaseDraftToCanonical(draft);
    const updated = await transaction.orderDraft.updateManyAndReturn({
      where: { id: draft.id, ownerUserId: input.ownerUserId, status: "active", version: input.expectedDraftVersion },
      data: { artworkAcknowledged: false, configuration: Prisma.DbNull, version: { increment: 1 } },
    });
    if (!updated[0]) throw new ArtworkConflictError();
    return databaseDraftToCanonical(updated[0]);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function finalizeRouteChangeAfterArtworkCleanup(input: {
  draftId: string;
  ownerUserId: string;
  expectedDraftVersion: number;
  selectedRoute: OrderRoute;
}) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`select pg_advisory_xact_lock(hashtextextended(${input.draftId}, 0))`;
    const draft = await transaction.orderDraft.findFirst({
      where: { id: input.draftId, ownerUserId: input.ownerUserId, status: "active" },
    });
    if (!draft) return null;
    if (draft.version !== input.expectedDraftVersion) throw new ArtworkConflictError();
    if (await transaction.artworkFile.count({ where: { draftId: input.draftId, ownerUserId: input.ownerUserId } }) !== 0) {
      throw new ArtworkCleanupIncompleteError();
    }
    const updated = await transaction.orderDraft.updateManyAndReturn({
      where: { id: input.draftId, ownerUserId: input.ownerUserId, status: "active", version: input.expectedDraftVersion },
      data: {
        selectedRoute: input.selectedRoute,
        startingPointConfirmed: true,
        artworkAcknowledged: false,
        workingConfiguration: Prisma.DbNull,
        configuration: Prisma.DbNull,
        version: { increment: 1 },
      },
    });
    if (!updated[0]) throw new ArtworkConflictError();
    return databaseDraftToCanonical(updated[0]);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function finalizeDraftResetAfterArtworkCleanup(input: {
  draftId: string;
  ownerUserId: string;
  expectedDraftVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`select pg_advisory_xact_lock(hashtextextended(${input.draftId}, 0))`;
    const draft = await transaction.orderDraft.findFirst({
      where: { id: input.draftId, ownerUserId: input.ownerUserId, status: "active" },
    });
    if (!draft) return null;
    if (draft.version !== input.expectedDraftVersion) throw new ArtworkConflictError();
    if (await transaction.artworkFile.count({ where: { draftId: input.draftId, ownerUserId: input.ownerUserId } }) !== 0) {
      throw new ArtworkCleanupIncompleteError();
    }
    const updated = await transaction.orderDraft.updateManyAndReturn({
      where: { id: input.draftId, ownerUserId: input.ownerUserId, status: "active", version: input.expectedDraftVersion },
      data: {
        selectedRoute: null,
        startingPointConfirmed: false,
        artworkAcknowledged: false,
        workingConfiguration: Prisma.DbNull,
        configuration: Prisma.DbNull,
        version: { increment: 1 },
      },
    });
    if (!updated[0]) throw new ArtworkConflictError();
    return databaseDraftToCanonical(updated[0]);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function clearDraftArtworkProgress(input: { draftId: string; ownerUserId: string; expectedVersion?: number }) {
  const rows = await prisma.orderDraft.updateManyAndReturn({
    where: { id: input.draftId, ownerUserId: input.ownerUserId, status: "active", ...(input.expectedVersion ? { version: input.expectedVersion } : {}) },
    data: { artworkAcknowledged: false, configuration: Prisma.DbNull, version: { increment: 1 } },
  });
  return rows[0] ?? null;
}

export async function deleteAllArtworkRowsForOwner(draftId: string, ownerUserId: string) {
  return prisma.artworkFile.deleteMany({ where: { draftId, ownerUserId, status: "deleting" } });
}

export type ArtworkWithStorageIdentity = CanonicalArtworkRecord & { storagePath: string; storageBucket: string };
export async function readArtworkWithStorageIdentity(id: string, draftId: string, ownerUserId: string): Promise<ArtworkWithStorageIdentity | null> {
  const row = await prisma.artworkFile.findFirst({ where: { id, draftId, ownerUserId } });
  return row ? { ...databaseArtworkToCanonical(row), storagePath: row.storagePath, storageBucket: row.storageBucket } : null;
}
