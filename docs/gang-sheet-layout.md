# Individual Designs gang-sheet layout

Increment 3B.2B adds a deterministic, derived layout preview for Individual Designs. It does not apply to Print-Ready Gang Sheet files, which remain customer-supplied layouts.

## Geometry model

The sheet is exactly 22 inches wide. The engine converts inches to integer thousandths of an inch at its boundary (`22 in = 22000 units`) so containment, spacing, and tie-breaking do not depend on floating-point comparisons. Transfer spacing is the minimum edge-to-edge gap between neighboring printed bounds. It is applied once between transfers, stays independent from the outer edge margin, and is not appended after the final row. The current fixed business-controlled edge-margin assumption is 0 inches. That assumption is an engine input, not a permanent production rule or customer setting.

PNG, JPEG, and WebP aspect ratios come from intrinsic pixel dimensions decoded through the existing authenticated private-preview URL. Pixels establish only aspect ratio. They are never interpreted as physical inches or assigned an assumed DPI. Width requests derive height from that ratio, and height requests derive width. Original Size remains unresolved until reliable physical dimensions exist. PDF, AI, PSD, and failed raster decodes also remain unresolved; no parser, DPI, or geometry is fabricated.

## Deterministic heuristic

The pure TypeScript engine in `lib/gang-sheet-layout` has no React, browser, Storage, database, or Supabase dependency. It tries area-, largest-side-, height-, and width-descending orders and evaluates a shelf baseline plus a bottom-left gap-filling strategy. The gap-filling strategy is limited to 200 placements; larger supported requests retain four bounded shelf candidates. Both strategies consider 0-degree and 90-degree orientations and choose the shortest candidate with a stable signature tie-break.

This is a deterministic optimization heuristic, not proof of a global optimum. Most Cost Efficient allows all artwork and variants to mix. Keep Designs Together groups by canonical artwork UUID, optimizes within each group, and stacks groups in contiguous horizontal bands separated only by selected transfer spacing. The Efficient candidate set defensively includes the grouped result, guaranteeing that displayed efficient length never exceeds grouped length for identical inputs.

## Preferences and derived output

Individual Designs configuration JSON persists only `layoutPreferences`: mode (`efficient` or `grouped`) and normalized spacing in inches. Working configuration preserves the selected preset and temporarily incomplete custom text. Legacy drafts without preferences receive application defaults of Efficient and Standard 0.25-inch spacing. No migration is required. Placement coordinates, group bands, calculated lengths, decoded geometry, and signed URLs are derived and are not persisted.

The live exact preview supports up to 1,000 explicit placements. Requests above that threshold remain editable and retain exact quantities but receive a structured diagnostic before expansion. Successful layouts render as a scalable, vertically scrollable SVG. The graphical layer is hidden from accessibility APIs because a concise textual summary reports mode, sheet width, length, transfer count, spacing, and unresolved items.

## Authority and exclusions

The browser preview uses short-lived authenticated image URLs only in memory. It is not a print-quality approval, production file, submission, or payment-authoritative length. The pure engine can later be recomputed with server-verified geometry for authoritative pricing, but this increment adds no pricing, quality review, production export, manual editor, or commerce behavior.
