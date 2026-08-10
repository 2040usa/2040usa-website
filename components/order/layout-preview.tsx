"use client";

import { CheckCircle2, LayoutTemplate } from "lucide-react";
import { ArtworkIdentity } from "@/components/artwork/artwork-preview";
import { individualDesignsFormSchema } from "@/lib/order-draft/schemas";
import type { CanonicalArtworkRecord } from "@/lib/artwork/types";
import type { WorkingGangSheetConfiguration, WorkingIndividualDesignsConfiguration, WorkingSizeVariant } from "@/lib/order-draft/types";

const panelClassName = "min-w-0 rounded-control border border-border bg-panel p-5 shadow-[var(--card-shadow)] xl:sticky xl:top-5";

export function GangSheetLayoutPreview({ artwork, configuration }: {
  artwork: CanonicalArtworkRecord[];
  configuration: WorkingGangSheetConfiguration;
}) {
  const sheetsByArtwork = new Map(configuration.sheets.map((sheet) => [sheet.artworkId, sheet]));
  return <aside className={panelClassName} aria-labelledby="layout-preview-title" data-testid="layout-preview">
    <p className="text-xs font-semibold text-text-secondary">Layout preview</p>
    <h2 id="layout-preview-title" className="mt-2 font-display text-2xl font-semibold text-text-primary">Your print-ready files</h2>
    <p className="mt-3 text-xs leading-5 text-text-muted">Each uploaded file is already its own layout. Files are shown independently and are never combined here.</p>
    {artwork.length ? <ol className="mt-5 space-y-5">
      {artwork.map((record, index) => {
        const sheet = sheetsByArtwork.get(record.id);
        const dimensions = sheet?.finishedWidth.trim() && sheet.finishedLength.trim()
          ? `${sheet.finishedWidth.trim()} in × ${sheet.finishedLength.trim()} in`
          : "Dimensions incomplete";
        const copies = sheet?.copies.trim() ? `${sheet.copies.trim()} copies` : "Copies incomplete";
        return <li key={record.id} className="min-w-0 rounded-control border border-border bg-background p-4" data-testid={`gang-sheet-preview-${record.id}`}>
          <p className="text-xs font-semibold text-text-muted">Gang sheet {index + 1}</p>
          <ArtworkIdentity record={record} previewSize="lg" className="mt-3 flex-col items-start sm:flex-row xl:flex-col" />
          <dl className="mt-4 grid gap-2 text-xs">
            <div className="flex justify-between gap-4"><dt className="text-text-muted">Finished size</dt><dd className="text-right text-text-primary">{dimensions}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-text-muted">Copies</dt><dd className="text-right text-text-primary">{copies}</dd></div>
          </dl>
        </li>;
      })}
    </ol> : <EmptyPreview message="Upload a gang-sheet file to see it here." />}
  </aside>;
}

export function IndividualDesignsLayoutPreview({ artwork, configuration }: {
  artwork: CanonicalArtworkRecord[];
  configuration: WorkingIndividualDesignsConfiguration;
}) {
  const designsByArtwork = new Map(configuration.designs.map((design) => [design.artworkId, design]));
  const quantities = configuration.designs.flatMap((design) => design.sizes.map((size) => Number(size.quantity)));
  const totalTransfers = quantities.length > 0 && quantities.every((quantity) => Number.isInteger(quantity) && quantity > 0)
    ? quantities.reduce((total, quantity) => total + quantity, 0)
    : null;
  const configuredIds = new Set(configuration.designs.map((design) => design.artworkId));
  const complete = artwork.length > 0
    && configuredIds.size === artwork.length
    && artwork.every((record) => configuredIds.has(record.id))
    && individualDesignsFormSchema.safeParse(configuration).success;

  return <aside className={panelClassName} aria-labelledby="layout-preview-title" data-testid="layout-preview">
    <p className="text-xs font-semibold text-text-secondary">Layout preview foundation</p>
    <h2 id="layout-preview-title" className="mt-2 font-display text-2xl font-semibold text-text-primary">Design request summary</h2>
    <div className="mt-4 rounded-control border border-primary-action/25 bg-raised p-4">
      <div className="flex items-start gap-3"><LayoutTemplate aria-hidden="true" className="mt-0.5 shrink-0 text-primary-action" size={18} /><p className="text-xs leading-5 text-text-secondary"><strong className="text-text-primary">No optimized gang sheet has been generated.</strong> This panel summarizes your inputs without arranging artwork or estimating sheet length.</p></div>
    </div>
    <dl className="mt-5 grid grid-cols-2 gap-3">
      <div className="rounded-control border border-border bg-background p-3"><dt className="text-xs text-text-muted">Uploaded designs</dt><dd className="mt-1 font-display text-2xl font-semibold text-text-primary">{artwork.length}</dd></div>
      <div className="rounded-control border border-border bg-background p-3"><dt className="text-xs text-text-muted">Requested transfers</dt><dd className="mt-1 font-display text-2xl font-semibold text-text-primary">{totalTransfers ?? "—"}</dd></div>
    </dl>
    <p className="mt-3 flex items-center gap-2 text-xs text-text-muted"><CheckCircle2 aria-hidden="true" size={15} className={complete ? "text-success" : "text-text-muted"} />{complete ? "Configuration complete" : "Configuration needs attention"}</p>
    {artwork.length ? <ul className="mt-5 space-y-4">
      {artwork.map((record) => {
        const design = designsByArtwork.get(record.id);
        return <li key={record.id} className="min-w-0 rounded-control border border-border bg-background p-4">
          <ArtworkIdentity record={record} previewSize="sm" />
          <ul className="mt-3 space-y-1 text-xs text-text-muted">
            {(design?.sizes ?? []).map((size) => <li key={size.id}>{formatWorkingSize(size)}</li>)}
          </ul>
        </li>;
      })}
    </ul> : <EmptyPreview message="Upload individual designs to build the request summary." />}
  </aside>;
}

function formatWorkingSize(size: WorkingSizeVariant) {
  const quantity = size.quantity.trim() || "?";
  if (size.method === "original") return `Original artwork size · quantity ${quantity}`;
  if (size.method === "width") return `Width ${size.dimension.trim() || "?"} in · quantity ${quantity}`;
  if (size.method === "height") return `Height ${size.dimension.trim() || "?"} in · quantity ${quantity}`;
  return `Size not selected · quantity ${quantity}`;
}

function EmptyPreview({ message }: { message: string }) {
  return <div className="mt-5 rounded-control border border-dashed border-border-strong bg-background p-5 text-center text-xs leading-5 text-text-muted">{message}</div>;
}
