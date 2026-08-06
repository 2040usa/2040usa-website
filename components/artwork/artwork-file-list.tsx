"use client";

import { useState } from "react";
import { File, ImageIcon, RotateCcw, Trash2 } from "lucide-react";
import { useArtwork } from "@/components/artwork/artwork-provider";
import { ActionButton } from "@/components/ui/button";
import { formatBytes } from "@/lib/artwork/constants";
import { isPreviewableArtwork } from "@/lib/artwork/file-validation";
import { classifyArtworkRecovery } from "@/lib/artwork/recovery-classification";
import type { CanonicalArtworkRecord } from "@/lib/artwork/types";

function UploadedPreview({ record }: { record: CanonicalArtworkRecord }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/artwork/${record.id}/preview-url`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draftId: record.draftId }) });
      if (!response.ok) throw new Error("Private preview is temporarily unavailable.");
      const body = await response.json() as { url?: unknown };
      if (typeof body.url !== "string") throw new Error("Private preview is temporarily unavailable.");
      setUrl(body.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Private preview is temporarily unavailable.");
    } finally { setLoading(false); }
  };
  if (!url) return <div className="flex flex-col items-center gap-1"><button type="button" onClick={() => void loadPreview()} disabled={loading} aria-label={`Load private preview of ${record.originalName}`} aria-describedby={error ? `preview-error-${record.id}` : undefined} className="grid size-16 place-items-center rounded-control border border-border bg-raised text-primary-action hover:border-primary-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:text-disabled-text"><ImageIcon aria-hidden="true" size={28} /><span className="sr-only">{loading ? "Loading preview" : "Load preview"}</span></button>{error && <span id={`preview-error-${record.id}`} role="alert" className="max-w-32 text-center text-[0.6rem] leading-4 text-error">{error} Retry.</span>}</div>;
  // The short-lived authenticated URL cannot be sent through the public Next image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={`Private preview of ${record.originalName}; not a print approval`} className="h-16 w-16 rounded-control border border-border object-cover" />;
}

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
        <div className="flex shrink-0 items-center justify-center">{record.status === "uploaded" && isPreviewableArtwork(record.extension) ? <UploadedPreview record={record} /> : <File aria-hidden="true" className="text-accent" size={28} />}</div>
        <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold text-text-primary">{record.originalName}</p><p className="mt-1 font-mono text-[0.65rem] text-text-muted">{record.mimeType} · {formatBytes(record.verifiedSizeBytes ?? record.declaredSizeBytes)} · {record.status}</p>{recoveryExplanation && <p className="mt-2 text-xs leading-5 text-text-muted">{recoveryExplanation}</p>}{record.failureCode && <p className="mt-2 text-xs text-error">Upload status: {record.failureCode.replaceAll("_", " ")}.</p>}</div>
        <div className="flex flex-wrap gap-3">
          {canSelectRecovery && recovery.kind !== "none" && <ActionButton type="button" variant="secondary" disabled={state === "mutating"} aria-label={`${recovery.label} ${record.originalName}`} onClick={() => selectRecoveryTarget(record)}><RotateCcw aria-hidden="true" size={14} />{recovery.label}</ActionButton>}
          {recovery.kind === "remove-invalid" && <ActionButton type="button" variant="quiet" disabled={state === "mutating"} aria-label={`Remove invalid upload ${record.originalName}`} onClick={() => void remove(record)}><Trash2 aria-hidden="true" size={14} />Remove invalid upload</ActionButton>}
          {recovery.kind === "retry-delete" && <ActionButton type="button" variant="quiet" disabled={state === "mutating"} aria-label={`Retry delete ${record.originalName}`} onClick={() => void remove(record)}><RotateCcw aria-hidden="true" size={14} />Retry delete</ActionButton>}
          {recovery.kind !== "remove-invalid" && recovery.kind !== "retry-delete" && <ActionButton type="button" variant="quiet" disabled={state === "mutating"} aria-label={`Remove ${record.originalName}`} onClick={() => void remove(record)}><Trash2 aria-hidden="true" size={14} />Remove</ActionButton>}
        </div>
      </li>})}
    </ul>
  </section>;
}
