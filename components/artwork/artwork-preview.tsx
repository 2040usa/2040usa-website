"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { File, ImageIcon } from "lucide-react";
import { formatBytes } from "@/lib/artwork/constants";
import { isPreviewableArtwork } from "@/lib/artwork/file-validation";
import type { CanonicalArtworkRecord } from "@/lib/artwork/types";
import { cn } from "@/lib/utils";

export function LocalArtworkPreview({ file }: { file: File }) {
  const previewable = isPreviewableArtworkFile(file);
  const attachPreview = useCallback((image: HTMLImageElement | null) => {
    if (!image) return;
    const url = URL.createObjectURL(file);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!previewable) return <File aria-hidden="true" className="text-primary-action" size={28} />;
  // Browser-local object URLs must not pass through the public image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={attachPreview} alt={`Local preview of ${file.name}; not a print approval`} className="h-24 w-24 rounded-control border border-border bg-white object-contain" />;
}

export function ArtworkPreview({ record, size = "md" }: { record: CanonicalArtworkRecord; size?: "sm" | "md" | "lg" }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const imageFailedRef = useRef(false);
  const loadPreview = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/artwork/${record.id}/preview-url`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draftId: record.draftId }), signal });
      if (!response.ok) throw new Error("Private preview is temporarily unavailable.");
      const body = await response.json() as { url?: unknown; expiresIn?: unknown };
      if (typeof body.url !== "string") throw new Error("Private preview is no longer available.");
      setUrl(body.url);
      const expiresIn = typeof body.expiresIn === "number" ? body.expiresIn : 60;
      return Math.max(5, expiresIn - 5) * 1000;
    } catch (cause) {
      if (signal.aborted) return null;
      setError(cause instanceof Error ? cause.message : "Private preview is temporarily unavailable.");
      return null;
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [record.draftId, record.id]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void loadPreview(controller.signal).then((refreshAfter) => {
        if (refreshAfter && !controller.signal.aborted) timer = setTimeout(() => { if (!imageFailedRef.current) setRequestVersion((value) => value + 1); }, refreshAfter);
      });
    });
    return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [loadPreview, record.version, requestVersion]);

  const dimensions = size === "lg" ? "h-32 w-32" : size === "sm" ? "h-16 w-16" : "h-24 w-24";
  if (!url) return <div className="flex max-w-36 flex-col items-center gap-1"><button type="button" onClick={() => { imageFailedRef.current = false; setRequestVersion((value) => value + 1); }} disabled={loading} aria-label={`Retry private preview of ${record.originalName}`} aria-describedby={error ? `preview-error-${record.id}` : undefined} className={cn("grid place-items-center rounded-control border border-border bg-raised text-primary-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-wait disabled:text-disabled-text", dimensions)}><ImageIcon aria-hidden="true" size={28} /><span className="sr-only">{loading ? "Loading private preview" : "Retry private preview"}</span></button>{error && <span id={`preview-error-${record.id}`} role="alert" className="text-center text-[0.65rem] leading-4 text-error">{error} Retry.</span>}</div>;
  // Short-lived authenticated URLs must not pass through the public image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} onError={() => { imageFailedRef.current = true; setUrl(null); setError("The uploaded image could not be displayed."); }} alt={`Private preview of ${record.originalName}; not a print approval`} className={cn("rounded-control border border-border bg-white object-contain", dimensions)} />;
}

export function ArtworkIdentity({ record, className, previewSize = "md", hideName = false }: { record: CanonicalArtworkRecord; className?: string; previewSize?: "sm" | "md" | "lg"; hideName?: boolean }) {
  return <div className={cn("flex min-w-0 items-center gap-4", className)}>
    <div className="grid shrink-0 place-items-center">{isPreviewableArtwork(record.extension) ? <ArtworkPreview record={record} size={previewSize} /> : <div className="grid h-16 w-16 place-items-center rounded-control border border-border bg-raised"><File aria-hidden="true" className="text-primary-action" size={28} /></div>}</div>
    <div className="min-w-0">{!hideName && <p className="break-words text-sm font-semibold text-text-primary">{record.originalName}</p>}<p className={cn("break-words font-mono text-[0.65rem] text-text-muted", !hideName && "mt-1")}>{record.mimeType} · {formatBytes(record.verifiedSizeBytes ?? record.declaredSizeBytes)}</p></div>
  </div>;
}

function isPreviewableArtworkFile(file: File) {
  return /\.(png|jpe?g|webp)$/i.test(file.name);
}
