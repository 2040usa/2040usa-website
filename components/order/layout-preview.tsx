"use client";

import { useMemo } from "react";
import { ChevronDown, FileWarning, LayoutTemplate } from "lucide-react";
import { ArtworkIdentity } from "@/components/artwork/artwork-preview";
import { useArtworkPreviewResources } from "@/components/artwork/use-artwork-preview-resources";
import { inputClassName, labelClassName } from "@/components/order/forms/form-feedback";
import { calculateGangSheetLayouts } from "@/lib/gang-sheet-layout/engine";
import { resolveLayoutVariants } from "@/lib/gang-sheet-layout/geometry";
import { DEFAULT_LAYOUT_MODE, DEFAULT_SPACING_INCHES, SPACING_PRESETS } from "@/lib/gang-sheet-layout/constants";
import type { ArtworkPreviewResource } from "@/components/artwork/use-artwork-preview-resources";
import type { GangSheetLayout, WorkingLayoutPreferences } from "@/lib/gang-sheet-layout/types";
import type { CanonicalArtworkRecord } from "@/lib/artwork/types";
import type { WorkingGangSheetConfiguration, WorkingIndividualDesignsConfiguration } from "@/lib/order-draft/types";

const panelClassName = "min-w-0 rounded-control border border-border bg-panel p-5 shadow-[var(--card-shadow)] xl:sticky xl:top-5 xl:max-h-[calc(100vh-2.5rem)] xl:overflow-y-auto";
const defaultWorkingPreferences: WorkingLayoutPreferences = { mode: DEFAULT_LAYOUT_MODE, spacingPreset: "standard", customSpacing: "" };

export function GangSheetLayoutPreview({ artwork, configuration }: {
  artwork: CanonicalArtworkRecord[];
  configuration: WorkingGangSheetConfiguration;
}) {
  const sheetsByArtwork = new Map(configuration.sheets.map((sheet) => [sheet.artworkId, sheet]));
  return <aside className={panelClassName} aria-labelledby="layout-preview-title" data-testid="layout-preview">
    <p className="text-xs font-semibold text-text-secondary">Preview</p>
    <h2 id="layout-preview-title" className="mt-2 font-display text-3xl font-semibold text-text-primary">Your Gang Sheets</h2>
    <p className="mt-3 text-sm leading-6 text-text-muted">Each file is shown separately, exactly as you arranged it.</p>
    {artwork.length ? <ol className="mt-5 divide-y divide-border">
      {artwork.map((record, index) => {
        const sheet = sheetsByArtwork.get(record.id);
        const dimensions = sheet?.finishedWidth.trim() && sheet.finishedLength.trim() ? `${sheet.finishedWidth.trim()} in × ${sheet.finishedLength.trim()} in` : "Dimensions incomplete";
        const copies = sheet?.copies.trim() ? `${sheet.copies.trim()} copies` : "Copies incomplete";
        return <li key={record.id} className="min-w-0 py-5 first:pt-0 last:pb-0" data-testid={`gang-sheet-preview-${record.id}`}>
          <p className="text-xs font-semibold text-text-muted">Gang sheet {index + 1}</p>
          <ArtworkIdentity record={record} previewSize="hero" showMetadata={false} className="mt-3 flex-col items-stretch" />
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-text-muted">Finished size</dt><dd className="text-right text-text-primary">{dimensions}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-text-muted">Copies</dt><dd className="text-right text-text-primary">{copies}</dd></div>
          </dl>
        </li>;
      })}
    </ol> : <EmptyPreview message="Upload a gang-sheet file to see it here." />}
  </aside>;
}

export function IndividualDesignsLayoutPreview({ artwork, configuration, onPreferencesChange, readOnly = false, customSpacingError }: {
  artwork: CanonicalArtworkRecord[];
  configuration: WorkingIndividualDesignsConfiguration;
  onPreferencesChange?: (preferences: WorkingLayoutPreferences) => void;
  readOnly?: boolean;
  customSpacingError?: string;
}) {
  const resources = useArtworkPreviewResources(artwork);
  const preferences = configuration.layoutPreferences ?? defaultWorkingPreferences;
  const spacing = workingSpacing(preferences);
  const geometry = useMemo(() => new Map([...resources].flatMap(([artworkId, resource]) => resource.status === "ready" && resource.widthPixels && resource.heightPixels ? [[artworkId, { widthPixels: resource.widthPixels, heightPixels: resource.heightPixels }] as const] : [])), [resources]);
  const sizingKey = JSON.stringify(configuration.designs.map((design) => ({ artworkId: design.artworkId, sizes: design.sizes })));
  const sizingConfiguration = useMemo(() => ({ designs: (JSON.parse(sizingKey) as WorkingIndividualDesignsConfiguration["designs"]) }), [sizingKey]);
  const variants = useMemo(() => resolveLayoutVariants(sizingConfiguration, artwork, geometry), [artwork, geometry, sizingConfiguration]);
  const comparison = useMemo(() => calculateGangSheetLayouts({ variants, spacingInches: spacing }), [spacing, variants]);
  const selected = preferences.mode === "grouped" ? comparison.grouped : comparison.efficient;
  const loadingGeometry = artwork.some((record) => /^(png|jpe?g|webp)$/i.test(record.extension) && !resources.has(record.id));

  const update = (patch: Partial<WorkingLayoutPreferences>) => onPreferencesChange?.({ ...preferences, ...patch });
  return <aside className={panelClassName} aria-labelledby={readOnly ? "review-layout-preview-title" : "layout-preview-title"} data-testid="layout-preview">
    <p className="text-xs font-semibold text-text-secondary">Layout preview</p>
    <h2 id={readOnly ? "review-layout-preview-title" : "layout-preview-title"} className="mt-2 font-display text-3xl font-semibold text-text-primary">Your Gang Sheet</h2>
    {loadingGeometry ? <LayoutGraphicPlaceholder message="Preparing artwork preview…" />
      : selected.status === "success" ? <LayoutGraphic layout={selected} resources={resources} />
        : <LayoutGraphicPlaceholder message="Your generated gang sheet will appear here when the artwork details are complete." />}
    <LayoutSummary layout={selected} />

    {!loadingGeometry && selected.status !== "success" && <LayoutDiagnostics layout={selected} />}

    {!readOnly ? <details className="group mt-5 border-y border-border py-1" data-testid="layout-options">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
        <span><span className="block text-sm font-semibold text-text-primary">Layout options</span><span className="mt-1 block text-xs text-text-muted">{modeLabel(preferences.mode)} · {spacingLabel(spacing)} spacing</span></span>
        <ChevronDown aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180" size={18} />
      </summary>
      <LayoutControls preferences={preferences} update={update} customSpacingError={customSpacingError} />
      <LayoutComparison comparison={comparison} />
    </details> : <div className="mt-5 border-y border-border py-4"><p className="text-sm font-semibold text-text-primary">{modeLabel(preferences.mode)}</p><p className="mt-1 text-xs text-text-muted">{spacingLabel(spacing)} spacing</p><LayoutComparison comparison={comparison} /></div>}

    <p className="mt-5 text-xs leading-5 text-text-muted">Shows placement, requested size, quantity, and spacing. Final print quality has not been reviewed yet.</p>
  </aside>;
}

function LayoutControls({ preferences, update, customSpacingError }: { preferences: WorkingLayoutPreferences; update: (patch: Partial<WorkingLayoutPreferences>) => void; customSpacingError?: string }) {
  return <div className="space-y-5 pb-5 pt-3">
    <fieldset>
      <legend className="text-sm font-semibold text-text-primary">Layout Preference</legend>
      <div className="mt-3 space-y-2">
        <Choice checked={preferences.mode === "efficient"} name="layout-mode" label="Most Cost Efficient" description="Mix designs as needed to minimize the total gang-sheet length." onChange={() => update({ mode: "efficient" })} />
        <Choice checked={preferences.mode === "grouped"} name="layout-mode" label="Keep Designs Together" description="Keep each uploaded design in its own section for easier cutting and distribution." onChange={() => update({ mode: "grouped" })} />
      </div>
    </fieldset>
    <fieldset>
      <legend className="text-sm font-semibold text-text-primary">Spacing Between Transfers</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {(["tight", "standard", "extra", "custom"] as const).map((preset) => <label key={preset} className="flex min-h-11 items-center gap-3 text-xs text-text-primary">
          <input type="radio" name="layout-spacing" checked={preferences.spacingPreset === preset} onChange={() => update({ spacingPreset: preset })} className="size-4 accent-primary-action" />
          <span><strong>{preset === "tight" ? "Tight" : preset === "standard" ? "Standard" : preset === "extra" ? "Extra" : "Custom"}</strong>{preset !== "custom" && ` — ${SPACING_PRESETS[preset]}\"`}</span>
        </label>)}
      </div>
      {preferences.spacingPreset === "custom" && <div className="mt-3"><label htmlFor="custom-transfer-spacing" className={labelClassName}>Custom spacing <span className="text-text-muted">(in)</span></label><input id="custom-transfer-spacing" type="number" step="0.001" inputMode="decimal" value={preferences.customSpacing} onChange={(event) => update({ customSpacing: event.target.value })} aria-invalid={Boolean(customSpacingError)} aria-describedby="custom-transfer-spacing-error" className={inputClassName} /><p id="custom-transfer-spacing-error" className="mt-1 text-xs text-error">{customSpacingError}</p></div>}
    </fieldset>
  </div>;
}

function Choice({ checked, name, label, description, onChange }: { checked: boolean; name: string; label: string; description: string; onChange: () => void }) {
  return <label className="flex cursor-pointer items-start gap-3 py-1 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus-ring"><input type="radio" name={name} checked={checked} onChange={onChange} className="mt-0.5 size-4 accent-primary-action" /><span><strong className="block text-xs text-text-primary">{label}</strong><span className="mt-1 block text-xs leading-5 text-text-muted">{description}</span></span></label>;
}

function LayoutSummary({ layout }: { layout: GangSheetLayout }) {
  return <div className="mt-5" aria-live="polite" data-testid="layout-text-summary">
    <p className="font-display text-3xl font-semibold tracking-[-0.02em] text-text-primary"><span>{formatInches(layout.sheetWidth)}&quot;</span> <span aria-hidden="true">×</span> <span data-testid="selected-layout-length">{layout.usedLength === null ? "Pending" : `${formatInches(layout.usedLength)}\"`}</span></p>
    <p className="mt-2 text-sm font-semibold text-text-secondary">{layout.totalRequestedPlacements} transfer{layout.totalRequestedPlacements === 1 ? "" : "s"}</p>
    <p className="sr-only">Selected layout: {modeLabel(layout.mode)}. Sheet width {formatInches(layout.sheetWidth)} inches. Calculated length {layout.usedLength === null ? "pending" : `${formatInches(layout.usedLength)} inches`}. Spacing {Number.isFinite(layout.spacing) ? `${formatInches(layout.spacing)} inches` : "invalid"}. {layout.unresolvedItems.length} unresolved items.</p>
  </div>;
}

function LayoutComparison({ comparison }: { comparison: ReturnType<typeof calculateGangSheetLayouts> }) {
  if (comparison.efficient.usedLength === null || comparison.grouped.usedLength === null) return null;
  return <div className="mt-4 border-t border-border pt-4 text-xs leading-5 text-text-secondary" data-testid="layout-comparison">
    <p>Most Cost Efficient — {formatInches(comparison.efficient.usedLength)}&quot;</p>
    <p>Keep Designs Together — {formatInches(comparison.grouped.usedLength)}&quot; (+{formatInches(comparison.difference ?? 0)}&quot;)</p>
    <p className="mt-2 text-text-muted">Shorter layouts use less gang-sheet material. Final pricing is not shown yet.</p>
  </div>;
}

function LayoutGraphic({ layout, resources }: { layout: GangSheetLayout; resources: ReadonlyMap<string, ArtworkPreviewResource> }) {
  if (layout.usedLength === null) return null;
  return <div className="mt-5"><div className="max-h-[56vh] min-h-72 overflow-y-auto rounded-control border border-border-strong bg-neutral-200 p-2" data-testid="gang-sheet-graphic">
    <svg viewBox={`0 0 ${layout.sheetWidth} ${Math.max(layout.usedLength, 0.01)}`} className="block h-auto w-full bg-white" aria-hidden="true" data-layout-mode={layout.mode}>
      {layout.groups.map((group, index) => <g key={group.artworkId} data-testid="layout-group-band"><rect x="0.03" y={group.y + 0.03} width={layout.sheetWidth - 0.06} height={Math.max(0, group.height - 0.06)} fill="none" stroke={index % 2 ? "#7c3aed" : "#0369a1"} strokeWidth="0.06" strokeDasharray="0.18 0.12" /><title>{group.artworkName} group boundary; preview only</title></g>)}
      {layout.placements.map((placement) => {
        const resource = resources.get(placement.artworkId);
        const image = resource?.status === "ready" ? resource.url : null;
        return <g key={placement.id} data-testid="layout-placement" data-rotation={placement.rotation}>
          <rect x={placement.x} y={placement.y} width={placement.width} height={placement.height} fill={image ? "#fff" : "#e5e7eb"} stroke="#111827" strokeWidth="0.025" />
          {image && (placement.rotation === 0
            ? <image href={image} x={placement.x} y={placement.y} width={placement.width} height={placement.height} preserveAspectRatio="xMidYMid meet" />
            : <image href={image} x="0" y="0" width={placement.height} height={placement.width} preserveAspectRatio="xMidYMid meet" transform={`translate(${placement.x + placement.width} ${placement.y}) rotate(90)`} />)}
        </g>;
      })}
    </svg>
  </div>{layout.groups.length > 0 && <div className="mt-3 border-t border-border pt-3"><p className="text-xs font-semibold text-text-primary">Design sections</p><p className="mt-1 text-xs text-text-muted">Outlines help show separation in this preview; they are not printed.</p><ol className="mt-2 space-y-1 text-xs text-text-secondary">{layout.groups.map((group, index) => <li key={group.artworkId}>Section {index + 1}: {group.artworkName}</li>)}</ol></div>}</div>;
}

function LayoutDiagnostics({ layout }: { layout: GangSheetLayout }) {
  return <div className="mt-5 rounded-control border border-warning/40 bg-warning/10 p-4" role="status">
    <div className="flex items-start gap-3"><FileWarning aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-warning" /><div><p className="text-sm font-semibold text-text-primary">Could not generate the complete preview</p><p className="mt-1 text-xs leading-5 text-text-muted">Continue editing your artwork details. We haven’t calculated a sheet length yet.</p></div></div>
    <ul className="mt-3 space-y-2 text-xs leading-5 text-text-secondary">{layout.diagnostics.map((diagnostic, index) => <li key={`${diagnostic.code}-${diagnostic.artworkId ?? index}-${diagnostic.variantId ?? index}`}><strong>{diagnostic.artworkName ? `${diagnostic.artworkName} — ${diagnostic.variantLabel}: ` : ""}</strong>{customerDiagnosticMessage(diagnostic)}</li>)}</ul>
  </div>;
}

function LayoutGraphicPlaceholder({ message }: { message: string }) {
  return <div className="mt-5 flex min-h-72 items-center justify-center rounded-control border border-dashed border-border-strong bg-background p-6 text-center text-xs leading-5 text-text-muted" aria-live="polite" data-testid="gang-sheet-preview-placeholder"><div><LayoutTemplate aria-hidden="true" className="mx-auto mb-3 text-primary-action" size={24} /><p>{message}</p></div></div>;
}

function workingSpacing(preferences: WorkingLayoutPreferences) {
  return preferences.spacingPreset === "custom" ? Number(preferences.customSpacing) : SPACING_PRESETS[preferences.spacingPreset] ?? DEFAULT_SPACING_INCHES;
}

function formatInches(value: number) {
  return Number(value.toFixed(3)).toString();
}

function modeLabel(mode: WorkingLayoutPreferences["mode"]) {
  return mode === "efficient" ? "Most Cost Efficient" : "Keep Designs Together";
}

function spacingLabel(spacing: number) {
  return Number.isFinite(spacing) ? `${formatInches(spacing)}\"` : "Invalid";
}

function customerDiagnosticMessage(diagnostic: GangSheetLayout["diagnostics"][number]) {
  if (diagnostic.code === "geometry-unavailable" && diagnostic.message.startsWith("Original Size")) return "Original Size needs confirmed physical dimensions before we can preview it.";
  if (diagnostic.code === "geometry-unavailable" && diagnostic.message.includes("aspect ratio")) return "We need more size information before we can preview this file.";
  return diagnostic.message;
}

function EmptyPreview({ message }: { message: string }) {
  return <div className="mt-5 rounded-control border border-dashed border-border-strong bg-background p-5 text-center text-xs leading-5 text-text-muted"><LayoutTemplate aria-hidden="true" className="mx-auto mb-2 text-primary-action" size={20} />{message}</div>;
}
