"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes } from "react";
import Uppy from "@uppy/core";
import Tus from "@uppy/tus";
import { UppyContextProvider, useDropzone, useFileInput, useUppyState } from "@uppy/react";
import { FileUp, Pause, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useArtwork } from "@/components/artwork/artwork-provider";
import { LocalArtworkPreview } from "@/components/artwork/artwork-preview";
import { useOrderDraft } from "@/components/order/order-draft-provider";
import { ActionButton } from "@/components/ui/button";
import {
  ARTWORK_ACCEPT,
  ARTWORK_TUS_ENDPOINT,
  MAX_ARTWORK_FILE_BYTES,
  MAX_ARTWORK_FILES,
  MAX_SIMULTANEOUS_UPLOADS,
  TUS_CHUNK_SIZE,
  formatBytes,
  purposeForRoute,
} from "@/lib/artwork/constants";
import { validateSelectedArtworkFile } from "@/lib/artwork/file-validation";
import { createArtworkClientFingerprint } from "@/lib/artwork/fingerprint";
import { createArtworkStagingFileId, createArtworkTransportFileId } from "@/lib/artwork/transport-identity";
import type { ArtworkUploadReservation } from "@/lib/artwork/types";
import { getPublicEnvironment } from "@/lib/env/public";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type UploadMeta = Record<string, unknown> & {
  clientFingerprint?: string;
  idempotencyKey?: string;
  artworkId?: string;
  artworkVersion?: number;
  recoverArtworkId?: string;
  cancelled?: boolean;
  bucketName?: string;
  objectName?: string;
  contentType?: string;
  cacheControl?: string;
};

function metaFor(file: { meta: object }) { return file.meta as UploadMeta; }

function createArtworkUppy(draftId: string, reportStage: (stage: string) => void) {
  const publicEnvironment = getPublicEnvironment();
  const supabase = createSupabaseBrowserClient();
  return new Uppy({
    id: `artwork-${draftId}`,
    autoProceed: false,
    allowMultipleUploadBatches: true,
    onBeforeFileAdded: (file) => {
      const artworkId = metaFor(file).artworkId;
      return {
        ...file,
        id: typeof artworkId === "string"
          ? createArtworkTransportFileId(artworkId)
          : createArtworkStagingFileId(crypto.randomUUID()),
      };
    },
    restrictions: { maxFileSize: MAX_ARTWORK_FILE_BYTES, maxNumberOfFiles: MAX_ARTWORK_FILES },
  }).use(Tus, {
    endpoint: ARTWORK_TUS_ENDPOINT,
    uploadDataDuringCreation: true,
    chunkSize: TUS_CHUNK_SIZE,
    retryDelays: [0, 3000, 5000, 10000, 20000],
    removeFingerprintOnSuccess: true,
    limit: MAX_SIMULTANEOUS_UPLOADS,
    withCredentials: false,
    allowedMetaFields: ["bucketName", "objectName", "contentType", "cacheControl", "artworkId"],
    onBeforeRequest: async (request) => {
      reportStage("Preparing upload");
      const result = await supabase.auth.getSession();
      if (result.error || !result.data.session?.access_token) throw new Error("The upload session is unavailable. Retry without creating a new identity.");
      request.setHeader("Authorization", `Bearer ${result.data.session.access_token}`);
      request.setHeader("apikey", publicEnvironment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
      request.setHeader("x-upsert", "false");
      reportStage("Uploading");
    },
  });
}

export function ArtworkUploader({ draftId, onActivityChange }: { draftId: string; onActivityChange?: (active: boolean) => void }) {
  const [uploadStage, setUploadStage] = useState("Idle");
  const [uppy] = useState(() => createArtworkUppy(draftId, setUploadStage));
  const destroyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (destroyTimer.current) clearTimeout(destroyTimer.current);
    return () => { destroyTimer.current = setTimeout(() => uppy.destroy(), 0); };
  }, [uppy]);
  return <UppyContextProvider uppy={uppy}><ArtworkUploaderContents uppy={uppy} draftId={draftId} uploadStage={uploadStage} setUploadStage={setUploadStage} onActivityChange={onActivityChange} /></UppyContextProvider>;
}

function ArtworkUploaderContents({ uppy, draftId, uploadStage, setUploadStage, onActivityChange }: { uppy: Uppy; draftId: string; uploadStage: string; setUploadStage: (stage: string) => void; onActivityChange?: (active: boolean) => void }) {
  const route = useOrderDraft((state) => state.selectedRoute);
  const { records, error, recoveryTarget, selectRecoveryTarget, reserve, complete, fail, remove } = useArtwork();
  const files = useUppyState(uppy, (uppyState) => Object.values(uppyState.files));
  const [selectionError, setSelectionError] = useState("");
  const [reservationErrors, setReservationErrors] = useState<Record<string, string>>({});
  const [announcement, setAnnouncement] = useState("");
  const cancelledReservations = useRef(new Set<string>());
  const uploadRunRef = useRef(false);
  const uploadAgainRef = useRef(false);
  const beginUploadRef = useRef<() => Promise<void>>(async () => undefined);
  const replacementTarget = recoveryTarget?.status === "uploaded" ? recoveryTarget : null;
  const input = useFileInput(useMemo(() => ({ accept: ARTWORK_ACCEPT, multiple: !replacementTarget }), [replacementTarget]));
  const dropzone = useDropzone(useMemo(() => ({ noClick: false, multiple: !replacementTarget }), [replacementTarget]));

  const hasUploadActivity = files.some((file) => !file.progress.uploadComplete);
  useEffect(() => { onActivityChange?.(hasUploadActivity); }, [hasUploadActivity, onActivityChange]);
  useEffect(() => () => onActivityChange?.(false), [onActivityChange]);

  useEffect(() => {
    const onAdded = (file: (typeof files)[number]) => {
      if (!(file.data instanceof File) || !route) return;
      if (typeof metaFor(file).artworkId === "string") return;
      try {
        const validated = validateSelectedArtworkFile(file.data);
        uppy.setFileMeta(file.id, { ...file.meta, idempotencyKey: crypto.randomUUID(), contentType: validated.mimeType, recoverArtworkId: replacementTarget ? undefined : recoveryTarget?.id });
      } catch (cause) { setSelectionError(cause instanceof Error ? cause.message : "This file is not supported."); uppy.removeFile(file.id); return; }
      setSelectionError("");
      setReservationErrors((current) => { const next = { ...current }; delete next[file.id]; return next; });
      queueMicrotask(() => void beginUploadRef.current());
    };
    const onSuccess = (file: (typeof files)[number] | undefined) => {
      if (!file) return;
      const artworkId = metaFor(file).artworkId;
      if (typeof artworkId === "string") void complete(artworkId).then(() => {
        if (uppy.getFile(file.id)) uppy.removeFile(file.id);
        setAnnouncement(`${file.name} upload completed.`);
        setUploadStage("Ready");
      }).catch(() => undefined);
    };
    const onError = (file: (typeof files)[number] | undefined) => {
      if (!file) return;
      if (metaFor(file).cancelled) return;
      const id = metaFor(file).artworkId;
      const record = records.find((item) => item.id === id);
      const version = metaFor(file).artworkVersion;
      const failure = typeof id === "string" && typeof version === "number" ? fail({ id, version }) : record ? fail(record) : null;
      if (failure) void failure.then((updated) => { if (updated && uppy.getFile(file.id)) uppy.setFileMeta(file.id, { ...file.meta, artworkVersion: updated.version }); });
      setAnnouncement(`${file.name} upload failed. Retry is available.`);
    };
    const onRestrictionFailed = (_file: (typeof files)[number] | undefined, cause: Error) => {
      setSelectionError(cause.message.includes("maximum allowed size") ? "Each artwork file must be 50 MiB or smaller." : cause.message);
    };
    uppy.on("file-added", onAdded);
    uppy.on("upload-success", onSuccess);
    uppy.on("upload-error", onError);
    uppy.on("restriction-failed", onRestrictionFailed);
    return () => { uppy.off("file-added", onAdded); uppy.off("upload-success", onSuccess); uppy.off("upload-error", onError); uppy.off("restriction-failed", onRestrictionFailed); };
  }, [complete, draftId, fail, records, recoveryTarget, replacementTarget, route, setUploadStage, uppy]);

  const beginUpload = useCallback(async () => {
    if (!route) return;
    if (uploadRunRef.current) { uploadAgainRef.current = true; return; }
    uploadRunRef.current = true;
    setSelectionError("");
    try {
      setUploadStage("Preparing upload");
      for (const file of Object.values(uppy.getFiles())) {
        let currentMeta = metaFor(file);
        if (currentMeta.artworkId) continue;
        try {
          if (!(file.data instanceof File) || typeof currentMeta.idempotencyKey !== "string") throw new Error("File preparation is still in progress. Retry shortly.");
          const idempotencyKey = currentMeta.idempotencyKey;
          const validated = validateSelectedArtworkFile(file.data);
          if (typeof currentMeta.clientFingerprint !== "string") {
            const clientFingerprint = await createArtworkClientFingerprint({ draftId, ...validated });
            uppy.setFileMeta(file.id, { ...file.meta, clientFingerprint });
            currentMeta = metaFor(uppy.getFile(file.id));
          }
          if (typeof currentMeta.clientFingerprint !== "string") throw new Error("The recovery fingerprint could not be prepared.");
          const reservation: ArtworkUploadReservation = await reserve({
            originalName: validated.originalName,
            declaredSizeBytes: validated.declaredSizeBytes,
            extension: validated.extension,
            mimeType: validated.mimeType,
            clientLastModified: validated.clientLastModified,
            clientFingerprint: currentMeta.clientFingerprint,
            purpose: purposeForRoute(route),
            idempotencyKey,
            recoverArtworkId: typeof currentMeta.recoverArtworkId === "string" ? currentMeta.recoverArtworkId : null,
            replacementForArtworkId: replacementTarget?.id ?? null,
          });
          if (!reservation.upload) {
            uppy.removeFile(file.id);
            setAnnouncement(`${file.name} was already present and has been reconciled.`);
            continue;
          }
          if (cancelledReservations.current.has(idempotencyKey) || !uppy.getFile(file.id)) {
            cancelledReservations.current.delete(idempotencyKey);
            await remove(reservation.artwork);
            continue;
          }
          const staged = uppy.getFile(file.id);
          if (!(staged.data instanceof File)) throw new Error("The selected file is no longer available.");
          uppy.removeFile(file.id);
          uppy.addFile({ source: staged.source, name: staged.name, type: staged.type, data: staged.data, meta: { ...staged.meta, ...reservation.upload, artworkVersion: reservation.artwork.version } });
          setReservationErrors((current) => { const next = { ...current }; delete next[file.id]; return next; });
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : "The secure upload reservation failed.";
          setReservationErrors((current) => ({ ...current, [file.id]: message }));
          setAnnouncement(`${file.name} could not be reserved. Retry is available.`);
        }
      }
      const transferable = uppy.getFiles().filter((file) => typeof metaFor(file).artworkId === "string" && !file.progress.uploadStarted && !file.progress.uploadComplete);
      if (transferable.length === 0) { setUploadStage(uppy.getFiles().length ? "Waiting for retry" : "Idle"); return; }
      setUploadStage("Starting upload");
      const result = await uppy.upload();
      const failed = result?.failed ?? [];
      if (failed.length) {
        const failure = failed[0]?.error;
        const message = typeof failure === "string" ? failure : "The resumable transfer failed.";
        throw new Error(message);
      }
      if (!(result?.successful ?? []).length && !failed.length) throw new Error("The resumable transfer did not start. Retry the selected file.");
      setUploadStage("Checking file");
    } catch (cause) {
      setSelectionError(cause instanceof Error ? cause.message : "The upload could not begin.");
    } finally {
      uploadRunRef.current = false;
      if (uploadAgainRef.current) { uploadAgainRef.current = false; queueMicrotask(() => void beginUploadRef.current()); }
    }
  }, [draftId, remove, replacementTarget, reserve, route, setUploadStage, uppy]);
  useEffect(() => { beginUploadRef.current = beginUpload; }, [beginUpload]);

  const cancelFile = async (fileId: string) => {
    const file = uppy.getFile(fileId);
    const artworkId = metaFor(file).artworkId;
    const artworkVersion = metaFor(file).artworkVersion;
    const idempotencyKey = metaFor(file).idempotencyKey;
    if (typeof idempotencyKey === "string") cancelledReservations.current.add(idempotencyKey);
    uppy.setFileMeta(fileId, { ...file.meta, cancelled: true });
    uppy.removeFile(fileId);
    const record = records.find((item) => item.id === artworkId);
    if (typeof artworkId === "string" && typeof artworkVersion === "number") await remove({ id: artworkId, version: artworkVersion });
    else if (record) await remove(record);
  };

  const hasUploadedArtwork = records.some((record) => record.status === "uploaded");
  const compact = hasUploadedArtwork && files.length === 0 && !recoveryTarget && !selectionError && !error;
  const addAnotherLabel = route === "gang-sheet" ? "Add another gang sheet" : "Add another design";

  if (compact) return <section className="mt-6" aria-label="Add more artwork" data-testid="compact-artwork-uploader">
    <input {...input.getInputProps()} className="sr-only" aria-label="Choose artwork files" />
    <ActionButton {...input.getButtonProps()} variant="secondary"><Plus aria-hidden="true" size={16} /> {addAnotherLabel}</ActionButton>
    <p className="sr-only" aria-live="polite">{announcement}</p>
  </section>;

  return (
    <section className="mt-6 rounded-control border border-border bg-panel p-5 shadow-[var(--card-shadow)]" aria-labelledby="upload-artwork-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 id="upload-artwork-title" className="font-display text-2xl font-semibold text-text-primary">Add artwork</h2><p className="mt-2 text-sm leading-6 text-text-muted">Choose files or drop them below. Uploading starts automatically.</p></div>
        <p className="text-xs text-text-muted">{records.filter((item) => item.status !== "deleting").length} / 20 files</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-text-muted">PNG, JPG, JPEG, WebP, PDF, AI, or PSD. Up to 50 MiB per file.</p>
      {recoveryTarget && <div className="mt-4 rounded-control border border-primary-action/30 bg-raised p-4"><p className="text-sm font-semibold text-text-primary">{replacementTarget ? "Replace artwork" : "Try this upload again"}</p><p className="mt-2 text-sm text-text-muted">{replacementTarget ? "Choose the replacement file. Your current artwork stays in place until the replacement is ready." : <>Reselect <strong className="text-text-primary">{recoveryTarget.originalName}</strong> to continue.</>}</p><button type="button" className="mt-3 text-sm font-semibold text-primary-action underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-focus-ring" onClick={() => selectRecoveryTarget(null)}>Cancel {replacementTarget ? "replacement" : "retry"}</button></div>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <input {...input.getInputProps()} className="sr-only" aria-label="Choose artwork files" />
        <ActionButton {...input.getButtonProps()}><FileUp aria-hidden="true" size={16} /> {replacementTarget ? `Choose replacement for ${replacementTarget.originalName}` : recoveryTarget ? `Reselect ${recoveryTarget.originalName}` : "Choose files"}</ActionButton>
        <button {...(dropzone.getRootProps() as unknown as ButtonHTMLAttributes<HTMLButtonElement>)} type="button" className="min-h-20 rounded-control border border-dashed border-border-strong bg-background px-4 text-sm font-medium text-text-secondary hover:border-primary-action hover:bg-raised hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus-ring">Drop files here or press Enter</button>
        <input {...dropzone.getInputProps()} className="sr-only" aria-label="Select artwork files from dropzone" accept={ARTWORK_ACCEPT} />
      </div>
      {(selectionError || error) && <p role="alert" className="mt-4 text-sm text-error">{selectionError || error}</p>}
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <p className="mt-3 text-xs text-text-muted" aria-live="polite">Upload status: <span className="font-medium text-text-secondary">{uploadStage}</span></p>

      {files.length > 0 && <ul className="mt-6 space-y-3" aria-label="Selected artwork upload queue">
        {files.map((file) => {
          const progress = file.progress;
          const percentage = typeof progress.percentage === "number" ? progress.percentage : 0;
          const uploaded = typeof progress.bytesUploaded === "number" ? progress.bytesUploaded : 0;
          return <li key={file.id} className="rounded-control border border-border bg-background p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-semibold text-text-primary">{file.name}</p><p className="mt-1 font-mono text-[0.65rem] text-text-muted">{formatBytes(uploaded)} / {formatBytes(file.size ?? 0)} · {percentage}%</p></div><span className="text-xs font-semibold text-primary-action">{progress.uploadComplete ? "Uploaded" : progress.uploadStarted ? file.isPaused ? "Paused" : "Uploading" : "Selected"}</span></div>
            <div className="mt-3">{file.data instanceof File && <LocalArtworkPreview file={file.data} />}</div>
            <progress className="mt-3 h-2 w-full accent-[var(--accent)]" max={100} value={percentage} aria-label={`Upload progress for ${file.name}`}>{percentage}%</progress>
            {reservationErrors[file.id] && <p id={`reservation-error-${file.id}`} role="alert" className="mt-3 text-xs text-error">{reservationErrors[file.id]}</p>}
            <div className="mt-3 flex flex-wrap gap-4">
              {progress.uploadStarted && !progress.uploadComplete && <button type="button" onClick={() => uppy.pauseResume(file.id)} className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-focus-ring">{file.isPaused ? <Play aria-hidden="true" size={13} /> : <Pause aria-hidden="true" size={13} />}{file.isPaused ? `Resume ${file.name}` : `Pause ${file.name}`}</button>}
              {file.error && <button type="button" onClick={() => void uppy.retryUpload(file.id)} className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-focus-ring"><RotateCcw aria-hidden="true" size={13} /> Retry {file.name}</button>}
              {reservationErrors[file.id] && <button type="button" onClick={() => void beginUpload()} className="inline-flex items-center gap-2 text-xs font-semibold text-text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-focus-ring"><RotateCcw aria-hidden="true" size={13} /> Retry reservation for {file.name}</button>}
              {!progress.uploadComplete && <button type="button" onClick={() => void cancelFile(file.id)} className="inline-flex items-center gap-2 text-xs font-semibold text-error underline decoration-current underline-offset-4 focus-visible:outline-2 focus-visible:outline-focus-ring"><Trash2 aria-hidden="true" size={13} /> Cancel {file.name}</button>}
            </div>
          </li>;
        })}
      </ul>}
      <p className="mt-5 text-xs leading-5 text-text-muted">Files begin uploading automatically. You can pause, resume, retry, or cancel each upload.</p>
    </section>
  );
}
