import { describe, expect, it } from "vitest";
import { isPreviewableArtwork, validateSelectedArtworkFile } from "@/lib/artwork/file-validation";
import { calculateArtworkReadiness } from "@/lib/artwork/readiness";
import { ARTWORK_POLICY_BY_ROUTE, formatBytes, purposeForRoute } from "@/lib/artwork/constants";
import { createArtworkClientFingerprint } from "@/lib/artwork/fingerprint";
import { reserveArtworkRequestSchema } from "@/lib/artwork/schemas";
import type { CanonicalArtworkRecord } from "@/lib/artwork/types";
import { classifyArtworkRecovery } from "@/lib/artwork/recovery-classification";
import { createArtworkTransportFileId, createArtworkTusFingerprint } from "@/lib/artwork/transport-identity";
import { applyCanonicalArtworkRecord, applyCanonicalArtworkSnapshot, EMPTY_ARTWORK_ORDERING_STATE } from "@/lib/artwork/canonical-ordering";

const base: CanonicalArtworkRecord = {
  id: "00000000-0000-4000-8000-000000000001",
  draftId: "00000000-0000-4000-8000-000000000002",
  route: "gang-sheet",
  purpose: "gang-sheet-file",
  status: "uploaded",
  originalName: "art.png",
  extension: "png",
  mimeType: "image/png",
  declaredSizeBytes: 100,
  clientLastModified: 1,
  clientFingerprint: `fp1:${"a".repeat(64)}`,
  failureCode: null,
  attemptExpiresAt: "2026-08-05T00:00:00.000Z",
  uploadedAt: "2026-08-04T00:00:00.000Z",
  verifiedSizeBytes: 100,
  verifiedMimeType: "image/png",
  version: 2,
  replacementForId: null,
  createdAt: "2026-08-04T00:00:00.000Z",
  updatedAt: "2026-08-04T00:00:00.000Z",
};

describe("artwork file validation", () => {
  it("normalizes extension to the canonical MIME instead of trusting the browser type", () => {
    expect(validateSelectedArtworkFile({ name: "Print.JPEG", size: 24, lastModified: 10 })).toMatchObject({ extension: "jpeg", mimeType: "image/jpeg" });
  });

  it.each(["art.svg", "../art.png", "art.exe", "art"])('rejects unsupported or unsafe name "%s"', (name) => {
    expect(() => validateSelectedArtworkFile({ name, size: 24, lastModified: 10 })).toThrow();
  });

  it("rejects zero-byte and greater-than-50-MiB selections", () => {
    expect(() => validateSelectedArtworkFile({ name: "art.png", size: 0, lastModified: 0 })).toThrow();
    expect(() => validateSelectedArtworkFile({ name: "art.png", size: 50 * 1024 * 1024 + 1, lastModified: 0 })).toThrow();
  });

  it.each(["art\\work.png", "art/work.png", "art\u0000work.png", "   "])('rejects unsafe display name "%s"', (name) => {
    expect(() => validateSelectedArtworkFile({ name, size: 24, lastModified: 0 })).toThrow();
  });

  it("limits browser and signed previews to supported raster formats", () => {
    for (const extension of ["png", "jpg", "jpeg", "webp"] as const) expect(isPreviewableArtwork(extension)).toBe(true);
    for (const extension of ["pdf", "ai", "psd"] as const) expect(isPreviewableArtwork(extension)).toBe(false);
  });
});

describe("artwork reservation schema", () => {
  const valid = { originalName: "art.png", declaredSizeBytes: 100, extension: "png", mimeType: "image/png", clientLastModified: null, clientFingerprint: `fp1:${"b".repeat(64)}`, purpose: "gang-sheet-file", idempotencyKey: "00000000-0000-4000-8000-000000000003", recoverArtworkId: null, replacementForArtworkId: null };
  it("accepts the bounded canonical reservation payload", () => expect(reserveArtworkRequestSchema.parse(valid)).toEqual(valid));
  it("rejects extension and MIME disagreement", () => expect(reserveArtworkRequestSchema.safeParse({ ...valid, mimeType: "application/pdf" }).success).toBe(false));
  it("does not accept a browser-provided storage path or owner", () => expect(reserveArtworkRequestSchema.safeParse({ ...valid, ownerUserId: "x", storagePath: "x" }).success).toBe(false));
  it("accepts only a UUID as the explicit recovery identity", () => {
    expect(reserveArtworkRequestSchema.safeParse({ ...valid, recoverArtworkId: "00000000-0000-4000-8000-000000000004" }).success).toBe(true);
    expect(reserveArtworkRequestSchema.safeParse({ ...valid, recoverArtworkId: "same-metadata" }).success).toBe(false);
  });
});

describe("canonical readiness", () => {
  it("requires one uploaded compatible record for the ordinary routes", () => {
    expect(calculateArtworkReadiness("gang-sheet", [base]).ready).toBe(true);
    expect(calculateArtworkReadiness("gang-sheet", [{ ...base, status: "pending", uploadedAt: null, verifiedSizeBytes: null, verifiedMimeType: null }]).ready).toBe(false);
  });

  it("supports multiple uploaded individual designs", () => {
    const design = { ...base, route: "individual-designs" as const, purpose: "individual-design" as const };
    expect(calculateArtworkReadiness("individual-designs", [design]).ready).toBe(true);
    expect(calculateArtworkReadiness("individual-designs", [design, { ...design, id: "00000000-0000-4000-8000-000000000004" }]).ready).toBe(true);
  });

  it.each([
    ["gang-sheet", "gang-sheet-file"],
    ["individual-designs", "individual-design"],
  ] as const)("maps %s to its only compatible purpose", (route, purpose) => {
    expect(purposeForRoute(route)).toBe(purpose);
    expect(ARTWORK_POLICY_BY_ROUTE[route].purpose).toBe(purpose);
  });

  it.each(["pending", "failed", "deleting"] as const)("does not treat %s records as ready", (status) => {
    expect(calculateArtworkReadiness("gang-sheet", [{ ...base, status, uploadedAt: null, verifiedSizeBytes: null, verifiedMimeType: null, failureCode: status === "failed" ? "upload_failed" : null }]).ready).toBe(false);
  });
});

describe("artwork recovery metadata", () => {
  it("creates a deterministic fixed-format fingerprint without file contents", async () => {
    const input = { draftId: base.draftId, originalName: "art.png", declaredSizeBytes: 100, mimeType: "image/png", clientLastModified: 1 };
    const first = await createArtworkClientFingerprint(input);
    expect(first).toMatch(/^fp1:[0-9a-f]{64}$/);
    expect(await createArtworkClientFingerprint(input)).toBe(first);
    expect(await createArtworkClientFingerprint({ ...input, declaredSizeBytes: 101 })).not.toBe(first);
  });

  it("formats safe byte totals without implying pricing or dimensions", () => {
    expect(formatBytes(8)).toBe("8 B");
    expect(formatBytes(1536)).toBe("1.5 KiB");
    expect(formatBytes(7 * 1024 * 1024)).toBe("7.0 MiB");
  });
});

describe("reservation-specific TUS transport identity", () => {
  const endpoint = "https://example.supabase.co/storage/v1/upload/resumable";
  const firstId = "00000000-0000-4000-8000-000000000011";
  const secondId = "00000000-0000-4000-8000-000000000012";

  it("contains the canonical artwork ID", () => {
    expect(createArtworkTransportFileId(firstId)).toContain(firstId);
    expect(createArtworkTusFingerprint(firstId, endpoint)).toContain(firstId);
  });

  it("separates identical files, expired restarts, and replacements by artwork ID", () => {
    expect(createArtworkTusFingerprint(firstId, endpoint)).not.toBe(createArtworkTusFingerprint(secondId, endpoint));
  });

  it("keeps explicit same-record recovery on the same transport identity", () => {
    expect(createArtworkTusFingerprint(firstId, endpoint)).toBe(createArtworkTusFingerprint(firstId, endpoint));
  });

  it("does not use the original display name as transport identity", () => {
    expect(createArtworkTransportFileId(firstId)).not.toContain(base.originalName);
  });
});

describe("artwork recovery classification", () => {
  const now = Date.parse("2026-08-04T12:00:00.000Z");
  const record = (status: CanonicalArtworkRecord["status"], failureCode: CanonicalArtworkRecord["failureCode"], expires = "2026-08-04T13:00:00.000Z") => ({ status, failureCode, attemptExpiresAt: expires });

  it("allows same-record transport only for unexpired pending and upload_failed", () => {
    expect(classifyArtworkRecovery(record("pending", null), now).kind).toBe("resume");
    expect(classifyArtworkRecovery(record("failed", "upload_failed"), now).kind).toBe("retry");
  });

  it("uses a new record after pending or upload_failed expiry and upload_expired", () => {
    expect(classifyArtworkRecovery(record("pending", null, "2026-08-04T11:00:00.000Z"), now).kind).toBe("restart-expired");
    expect(classifyArtworkRecovery(record("failed", "upload_failed", "2026-08-04T11:00:00.000Z"), now).kind).toBe("restart-expired");
    expect(classifyArtworkRecovery(record("failed", "upload_expired"), now).kind).toBe("restart-expired");
  });

  it("restarts missing objects with a new record", () => {
    expect(classifyArtworkRecovery(record("failed", "object_missing"), now).kind).toBe("restart-missing");
  });

  it.each(["size_mismatch", "mime_mismatch", "verification_failed"] as const)("requires removal for %s", (failureCode) => {
    expect(classifyArtworkRecovery(record("failed", failureCode), now).kind).toBe("remove-invalid");
  });

  it("offers only deletion recovery for deleting and deletion_failed", () => {
    expect(classifyArtworkRecovery(record("deleting", null), now).kind).toBe("retry-delete");
    expect(classifyArtworkRecovery(record("failed", "deletion_failed"), now).kind).toBe("retry-delete");
  });
});

describe("canonical artwork snapshot ordering", () => {
  it("does not regress a newer record version when an older response arrives last", () => {
    const pending = { ...base, status: "pending" as const, version: 1, uploadedAt: null, verifiedSizeBytes: null, verifiedMimeType: null };
    const uploaded = { ...base, version: 2 };
    let state = applyCanonicalArtworkRecord(EMPTY_ARTWORK_ORDERING_STATE, pending, 1);
    state = applyCanonicalArtworkRecord(state, uploaded, 3);
    state = applyCanonicalArtworkSnapshot(state, [pending], 2);
    expect(state.records).toEqual([uploaded]);
  });

  it("does not resurrect a deleted record from an older full snapshot", () => {
    let state = applyCanonicalArtworkRecord(EMPTY_ARTWORK_ORDERING_STATE, base, 2);
    state = applyCanonicalArtworkSnapshot(state, [], 4);
    state = applyCanonicalArtworkSnapshot(state, [{ ...base, version: 3 }], 3);
    expect(state.records).toEqual([]);
  });

  it("keeps a completion authoritative over a stale refresh response", () => {
    const pending = { ...base, status: "pending" as const, version: 1, uploadedAt: null, verifiedSizeBytes: null, verifiedMimeType: null };
    let state = applyCanonicalArtworkRecord(EMPTY_ARTWORK_ORDERING_STATE, pending, 1);
    state = applyCanonicalArtworkRecord(state, base, 2);
    state = applyCanonicalArtworkSnapshot(state, [pending], 3);
    expect(state.records[0]?.status).toBe("uploaded");
  });
});
