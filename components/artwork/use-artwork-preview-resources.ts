"use client";

import { useEffect, useMemo, useState } from "react";
import { isPreviewableArtwork } from "@/lib/artwork/file-validation";
import type { CanonicalArtworkRecord } from "@/lib/artwork/types";

export type ArtworkPreviewResource = {
  status: "ready" | "error" | "unsupported";
  url: string | null;
  widthPixels: number | null;
  heightPixels: number | null;
  message: string | null;
};

export function useArtworkPreviewResources(artwork: CanonicalArtworkRecord[]) {
  const [resources, setResources] = useState<ReadonlyMap<string, ArtworkPreviewResource>>(() => new Map());
  const [requestVersion, setRequestVersion] = useState(0);
  const rasterArtwork = useMemo(() => artwork.filter((record) => isPreviewableArtwork(record.extension)), [artwork]);
  const identity = rasterArtwork.map((record) => `${record.id}:${record.version}`).join("|");

  useEffect(() => {
    const controller = new AbortController();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    void Promise.all(rasterArtwork.map(async (record) => {
      try {
        const response = await fetch(`/api/artwork/${record.id}/preview-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftId: record.draftId }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Private preview is temporarily unavailable.");
        const body = await response.json() as { url?: unknown; expiresIn?: unknown };
        if (typeof body.url !== "string") throw new Error("Private preview is no longer available.");
        const dimensions = await decodeImage(body.url, controller.signal);
        const expiresIn = typeof body.expiresIn === "number" ? body.expiresIn : 60;
        return { record, expiresIn, resource: { status: "ready", url: body.url, widthPixels: dimensions.width, heightPixels: dimensions.height, message: null } satisfies ArtworkPreviewResource };
      } catch (cause) {
        if (controller.signal.aborted) return null;
        return { record, expiresIn: 60, resource: { status: "error", url: null, widthPixels: null, heightPixels: null, message: cause instanceof Error ? cause.message : "Private preview could not be decoded." } satisfies ArtworkPreviewResource };
      }
    })).then((loaded) => {
      if (controller.signal.aborted) return;
      const next = new Map<string, ArtworkPreviewResource>();
      for (const record of artwork) {
        if (!isPreviewableArtwork(record.extension)) next.set(record.id, { status: "unsupported", url: null, widthPixels: null, heightPixels: null, message: `${record.extension.toUpperCase()} preview geometry is unavailable.` });
      }
      let refreshAfter = Number.POSITIVE_INFINITY;
      for (const item of loaded) {
        if (!item) continue;
        next.set(item.record.id, item.resource);
        refreshAfter = Math.min(refreshAfter, Math.max(5, item.expiresIn - 5) * 1000);
      }
      setResources(next);
      if (Number.isFinite(refreshAfter)) refreshTimer = setTimeout(() => setRequestVersion((value) => value + 1), refreshAfter);
    });
    return () => { controller.abort(); if (refreshTimer) clearTimeout(refreshTimer); };
  }, [artwork, identity, rasterArtwork, requestVersion]);

  return resources;
}
function decodeImage(url: string, signal: AbortSignal) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    const abort = () => { image.src = ""; reject(new DOMException("Preview decoding was aborted.", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
    image.onload = () => {
      signal.removeEventListener("abort", abort);
      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) reject(new Error("Raster preview has invalid intrinsic dimensions."));
      else resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => { signal.removeEventListener("abort", abort); reject(new Error("Raster preview could not be decoded.")); };
    image.src = url;
  });
}
