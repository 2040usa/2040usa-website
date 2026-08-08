"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useArtwork } from "@/components/artwork/artwork-provider";
import { ArtworkIdentity } from "@/components/artwork/artwork-preview";
import { ActionButton } from "@/components/ui/button";
import { classifyArtworkRecovery } from "@/lib/artwork/recovery-classification";

export function ArtworkFileList() {
  const { records, remove, state, selectRecoveryTarget } = useArtwork();
  if (records.length === 0) return null;
  return <section className="mt-6" aria-labelledby="stored-artwork-title">
    <h2 id="stored-artwork-title" className="font-display text-2xl font-semibold text-text-primary">Draft artwork records</h2>
    <ul className="mt-4 space-y-3">
      {records.map((record) => {
        const recovery = classifyArtworkRecovery(record);
        const canSelectRecovery = ["resume", "retry", "restart-expired", "restart-missing"].includes(recovery.kind);
        const recoveryExplanation = recovery.kind === "restart-expired"
          ? "This attempt expired. Reselect the exact file to create a new secure upload record and path."
          : recovery.kind === "restart-missing"
            ? "The prior object is missing. Reselect the exact file to restart with a new secure upload record and path."
            : recovery.kind === "remove-invalid"
              ? "The stored upload failed verification and cannot be overwritten. Remove it before selecting the file again."
              : recovery.kind === "retry-delete"
                ? "Deletion is incomplete. Retry deletion before attempting another upload."
                : recovery.kind === "resume" || recovery.kind === "retry"
                  ? "Reselect this exact file to continue its unexpired secure upload record. The browser cannot restore file bytes automatically."
                  : null;
        return <li key={record.id} className="flex min-w-0 flex-col gap-4 rounded-control border border-border bg-panel p-4 shadow-[var(--card-shadow)] sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1"><ArtworkIdentity record={record} previewSize="sm" />{recoveryExplanation && <p className="mt-2 text-xs leading-5 text-text-muted">{recoveryExplanation}</p>}{record.failureCode && <p className="mt-2 text-xs text-error">Upload status: {record.failureCode.replaceAll("_", " ")}.</p>}</div>
        <div className="flex flex-wrap gap-3">
          {record.status === "uploaded" && <ActionButton type="button" variant="secondary" disabled={state === "mutating"} aria-label={`Replace ${record.originalName}`} onClick={() => selectRecoveryTarget(record)}><RotateCcw aria-hidden="true" size={14} />Replace</ActionButton>}
          {canSelectRecovery && recovery.kind !== "none" && <ActionButton type="button" variant="secondary" disabled={state === "mutating"} aria-label={`${recovery.label} ${record.originalName}`} onClick={() => selectRecoveryTarget(record)}><RotateCcw aria-hidden="true" size={14} />{recovery.label}</ActionButton>}
          {recovery.kind === "remove-invalid" && <ActionButton type="button" variant="quiet" disabled={state === "mutating"} aria-label={`Remove invalid upload ${record.originalName}`} onClick={() => void remove(record)}><Trash2 aria-hidden="true" size={14} />Remove invalid upload</ActionButton>}
          {recovery.kind === "retry-delete" && <ActionButton type="button" variant="quiet" disabled={state === "mutating"} aria-label={`Retry delete ${record.originalName}`} onClick={() => void remove(record)}><RotateCcw aria-hidden="true" size={14} />Retry delete</ActionButton>}
          {recovery.kind !== "remove-invalid" && recovery.kind !== "retry-delete" && <ActionButton type="button" variant="quiet" disabled={state === "mutating"} aria-label={`Remove ${record.originalName}`} onClick={() => void remove(record)}><Trash2 aria-hidden="true" size={14} />Remove</ActionButton>}
        </div>
      </li>})}
    </ul>
  </section>;
}
