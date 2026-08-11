"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useArtwork } from "@/components/artwork/artwork-provider";
import { ArtworkIdentity } from "@/components/artwork/artwork-preview";
import { ActionButton } from "@/components/ui/button";
import { classifyArtworkRecovery } from "@/lib/artwork/recovery-classification";
import type { CanonicalArtworkRecord } from "@/lib/artwork/types";

export function ArtworkFileList({ includeUploaded = true }: { includeUploaded?: boolean }) {
  const { records } = useArtwork();
  const visibleRecords = includeUploaded ? records : records.filter((record) => record.status !== "uploaded");
  if (visibleRecords.length === 0) return null;
  return <section className="mt-6" aria-labelledby="stored-artwork-title">
    <h2 id="stored-artwork-title" className="font-display text-2xl font-semibold text-text-primary">Uploads needing attention</h2>
    <ul className="mt-4 space-y-3">
      {visibleRecords.map((record) => {
        const recovery = classifyArtworkRecovery(record);
        const recoveryExplanation = recovery.kind === "restart-expired"
          ? "This upload expired. Reselect the same file to try again."
          : recovery.kind === "restart-missing"
            ? "The uploaded file is no longer available. Reselect the same file to try again."
            : recovery.kind === "remove-invalid"
              ? "We couldn’t verify this upload. Remove it before selecting the file again."
              : recovery.kind === "retry-delete"
                ? "Removal did not finish. Try removing the file again."
                : recovery.kind === "resume" || recovery.kind === "retry"
                  ? "Reselect the same file to continue the upload."
                  : null;
        return <li key={record.id} className="flex min-w-0 flex-col gap-4 rounded-control border border-border bg-panel p-4 shadow-[var(--card-shadow)] sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1"><ArtworkIdentity record={record} previewSize="sm" />{recoveryExplanation && <p className="mt-2 text-xs leading-5 text-text-muted">{recoveryExplanation}</p>}{record.failureCode && <p className="mt-2 text-xs text-error">Upload status: {record.failureCode.replaceAll("_", " ")}.</p>}</div>
        <ArtworkRecordActions record={record} />
      </li>})}
    </ul>
  </section>;
}

export function ArtworkRecordActions({ record }: { record: CanonicalArtworkRecord }) {
  const { remove, state, selectRecoveryTarget } = useArtwork();
  const recovery = classifyArtworkRecovery(record);
  const canSelectRecovery = ["resume", "retry", "restart-expired", "restart-missing"].includes(recovery.kind);
  return <div className="flex flex-wrap gap-3">
    {record.status === "uploaded" && <ActionButton type="button" variant="secondary" disabled={state === "mutating"} aria-label={`Replace ${record.originalName}`} onClick={() => selectRecoveryTarget(record)}><RotateCcw aria-hidden="true" size={14} />Replace</ActionButton>}
    {canSelectRecovery && recovery.kind !== "none" && <ActionButton type="button" variant="secondary" disabled={state === "mutating"} aria-label={`${recovery.label} ${record.originalName}`} onClick={() => selectRecoveryTarget(record)}><RotateCcw aria-hidden="true" size={14} />{recovery.label}</ActionButton>}
    {recovery.kind === "remove-invalid" && <ActionButton type="button" variant="quiet" disabled={state === "mutating"} aria-label={`Remove invalid upload ${record.originalName}`} onClick={() => void remove(record)}><Trash2 aria-hidden="true" size={14} />Remove invalid upload</ActionButton>}
    {recovery.kind === "retry-delete" && <ActionButton type="button" variant="quiet" disabled={state === "mutating"} aria-label={`Retry delete ${record.originalName}`} onClick={() => void remove(record)}><RotateCcw aria-hidden="true" size={14} />Retry delete</ActionButton>}
    {recovery.kind !== "remove-invalid" && recovery.kind !== "retry-delete" && <ActionButton type="button" variant="quiet" disabled={state === "mutating"} aria-label={`Remove ${record.originalName}`} onClick={() => void remove(record)}><Trash2 aria-hidden="true" size={14} />Remove</ActionButton>}
  </div>;
}
