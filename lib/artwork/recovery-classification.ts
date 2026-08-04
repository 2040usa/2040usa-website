import type { CanonicalArtworkRecord } from "@/lib/artwork/types";

export type ArtworkRecoveryClassification =
  | { kind: "none" }
  | { kind: "resume"; label: "Resume upload" }
  | { kind: "retry"; label: "Retry upload" }
  | { kind: "restart-expired"; label: "Restart expired upload" }
  | { kind: "restart-missing"; label: "Restart missing upload" }
  | { kind: "remove-invalid"; label: "Remove invalid upload" }
  | { kind: "retry-delete"; label: "Retry delete" };

export function classifyArtworkRecovery(
  record: Pick<CanonicalArtworkRecord, "status" | "failureCode" | "attemptExpiresAt">,
  now = Date.now(),
): ArtworkRecoveryClassification {
  if (record.status === "uploaded") return { kind: "none" };
  if (record.status === "deleting" || record.failureCode === "deletion_failed") {
    return { kind: "retry-delete", label: "Retry delete" };
  }

  const unexpired = Date.parse(record.attemptExpiresAt) > now;
  if (record.status === "pending") {
    return unexpired
      ? { kind: "resume", label: "Resume upload" }
      : { kind: "restart-expired", label: "Restart expired upload" };
  }
  if (record.failureCode === "upload_failed") {
    return unexpired
      ? { kind: "retry", label: "Retry upload" }
      : { kind: "restart-expired", label: "Restart expired upload" };
  }
  if (record.failureCode === "upload_expired") {
    return { kind: "restart-expired", label: "Restart expired upload" };
  }
  if (record.failureCode === "object_missing") {
    return { kind: "restart-missing", label: "Restart missing upload" };
  }
  if (["size_mismatch", "mime_mismatch", "verification_failed"].includes(record.failureCode ?? "")) {
    return { kind: "remove-invalid", label: "Remove invalid upload" };
  }
  return { kind: "none" };
}

export function canReuseArtworkTransport(classification: ArtworkRecoveryClassification) {
  return classification.kind === "resume" || classification.kind === "retry";
}
