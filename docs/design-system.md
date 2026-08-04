# Design system

## Approved visual reference

`docs/reference/2040usa-homepage-concept.png` is the initial approved visual direction for the homepage. It is directional rather than a pixel-perfect specification. Real 2040 USA production photography will eventually replace the current code-native placeholders. Product usability and accessibility take priority over literal visual imitation.

## Direction

2040 USA uses a dark industrial visual language: near-black surfaces, warm white type, electric yellow-green signals, square grids, thin technical rules, and production/measurement motifs. It should feel like a working print floor rather than a generic online store or SaaS dashboard.

## Tokens

Tokens are declared in `app/globals.css` and exposed to Tailwind 4 through `@theme inline`.

| Token | Role |
| --- | --- |
| `--background` | Primary near-black canvas |
| `--raised` | Section contrast surface |
| `--panel` | Controls, previews, and technical panels |
| `--text-primary` | Warm white primary type |
| `--text-muted` | Secondary and annotation type |
| `--border` | Thin technical dividers |
| `--accent` | Electric yellow-green action/signal color |
| `--accent-foreground` | Dark text on accent |
| `--error` / `--success` | Semantic state colors |
| `--font-display` / `--font-body` | Industrial display and readable body stacks |
| `--section-spacing` | Responsive vertical section rhythm |
| `--control-radius` | Restrained two-pixel control rounding |

## Typography

Display typography uses a local condensed stack: Arial Narrow, Roboto Condensed, then Impact. Body copy uses local Inter when available and the native system UI stack otherwise. No remote font request is made. A future licensed brand font should be stored locally and loaded with `next/font/local`.

Only the hero owns the `h1`. Section names use `h2`; cards and process items use `h3`.

## UI foundation

- `Button`: link-based primary, secondary, and quiet actions with shared focus behavior.
- `SectionLabel`: mono production annotation with registration rule.
- `SectionHeading`: consistent condensed section scale.
- `StatusBadge`: compact neutral, success, or accent state indicator.
- `IconContainer`: square, bordered Lucide icon frame.

Keep this layer small. Add a primitive only after a repeated interface need is demonstrated.

## Interaction and accessibility

- Focus rings use the accent color and are never suppressed.
- The mobile navigation uses native `details`/`summary`, making it keyboard and touch operable without JavaScript.
- Motion is limited to once-only section reveals and disabled when reduced motion is requested.
- Complex grids stack at narrow widths; the dashboard table scrolls inside its own contained demo rather than expanding the page.
- Placeholder visuals are CSS and SVG-like interface geometry, not remote photography.

## Order experience

The `/order` experience uses the same tokens and typography with a calmer, task-focused density. A persistent shell provides compact branding, an explicit prototype disclosure, semantic progress, route focus management, and an optional draft rail. Native radios, checkboxes, number inputs, text inputs, textareas, and buttons are preferred over custom controls. Completed, current, and future progress states include text or symbols in addition to color.

Order forms use bordered production panels rather than detached checkout cards. Error messages use the semantic error token, remain connected to their fields, and are summarized after an attempted continuation. No pricing, cart, coupon, payment, or storefront visual language is permitted before those capabilities are authorized.

Durable-state labels use the existing mono technical treatment: Initializing, Establishing secure draft, Saving, Saved, Unable to save, and Conflict detected. Success and error colors supplement explicit text rather than carrying meaning alone. Turnstile appears only at the first anonymous identity boundary. Conflict recovery and retry remain native buttons with visible focus states.

Hydration failure uses a full-content unavailable state with an accessible Retry draft check action; it never reveals an empty Start form while canonical state is unknown. Pending route radio styling represents an unconfirmed UI choice, not a saved server state.

Artwork controls reuse technical borders, near-black panels, condensed headings, monospaced status labels, and the electric accent. Uploading, paused, retryable, verified-ready, and reselect states use explicit text/icons in addition to color. The interface is custom headless Uppy rather than a stock Dashboard, and progress does not depend on decorative animation.
