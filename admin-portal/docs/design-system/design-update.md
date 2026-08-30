# Cold-Blue Design Update

Status: **[Source implementation complete; conformance verification remains]**

Design approval: **2026-08-29**

Current-source audit: **2026-08-29**

Owner: **Admin Portal**

## Purpose and authority

This document is the master visual and interaction specification for the Admin
Portal design update. The semantic source migration is broadly complete. That
source status is not a claim that every route has completed authenticated,
keyboard, screen-reader, responsive, color-vision, or performance conformance
verification.

Runtime evidence remains independently recorded in the
[UI quality matrix](../audit/ui-quality-matrix.md). Backend behavior, permissions,
idempotency, and transport semantics remain governed by
[the documentation contract](../DOCUMENTATION_CONTRACT.md) and the architecture
contracts under `docs/architecture/`.

Page or component specifications may add stricter requirements, but they must not
weaken this document. Exceptions require a documented reason, an owner, and a
removal or review condition.

## Design thesis: Polar Control Plane

The target is a cold-blue operational interface: an icy canvas, white precision
panels, navy text, crisp blue-gray boundaries, cobalt interaction states, and
emerald reserved for healthy or successful outcomes.

The product should feel calm under pressure. It must prioritize certainty,
traceability, and recovery over decoration or raw interaction speed.

The design dials are:

| Dial | Target | Meaning |
| --- | ---: | --- |
| Visual variance | 3/10 | Centered, minimal, grid-led layouts |
| Motion | 3/10 | Subtle state transitions only |
| Density | 8/10 | Compact desktop administration without microscopic text or targets |

The applicable `ui-ux-pro-max` result is Minimal/Swiss enterprise tooling. Its
landing-page pattern and Inter recommendation are intentionally not adopted:
this is an authenticated control plane, and IBM Plex Sans with IBM Plex Sans
Arabic is the stronger bilingual product fit.

## Product principles

1. **Certainty before speed.** An operator must know what changed, whether it
   completed, and how to recover.
2. **Semantic truth before visual novelty.** Color, labels, and motion reinforce
   real state; they never invent it.
3. **Data before chrome.** Borders and spacing establish hierarchy. Cards,
   shadows, gradients, and decorative color stay scarce.
4. **Accessible compactness.** Dense means controlled spacing and hierarchy,
   not undersized text, invisible focus, or tiny targets.
5. **Bilingual parity.** Arabic/RTL and English/LTR are equal product modes, not
   a translated primary mode and a best-effort secondary mode.
6. **One obvious next action.** A visible surface has at most one filled primary
   action. Row-level secondary actions move into an overflow menu.
7. **Safe power.** High-impact and destructive commands expose scope,
   permissions, consequences, evidence, and recovery behavior.

## Semantic color architecture

The legacy `brand` ramp combined primary interaction and success. The
implemented semantic model splits those meanings:

| Family | Meaning | May not be used for |
| --- | --- | --- |
| `action` | Primary actions, active navigation, links, focus, information | Success/health status |
| `success` | Healthy, completed, connected, verified | Primary buttons or general navigation |
| `warn` | Degraded, caution, attention required | Generic accent or filled primary action |
| `danger` | Failure, destructive action, critical condition | Decoration |
| `ink` | Text and neutral structure | Status when a semantic state is known |
| `surface` | Canvas, card, muted, selected, and overlay backgrounds | Text or status |

`brand` is retained as a compatibility alias only and is aliased to `success`.
New components use semantic roles; legacy emerald/green utility aliases also
resolve through that compatibility mapping rather than being repainted blue.

### Target light palette

Hex values below are the design reference. Implementation should store the
ramps in OKLCH, then validate final browser-composited colors.

| Role | Reference | Usage |
| --- | --- | --- |
| Canvas | `#F1F9FF` | Page background |
| Sidebar | `#F9FDFF` | Primary navigation surface |
| Card/popover | `#FFFFFF` | Forms, tables, panels, menus |
| Muted/hover | `#E5F2FD` | Filter regions, table headers, hover |
| Selected | `#DCEAFF` | Active navigation and selected rows |
| Border | `#D0E5F4` | Structural dividers |
| Control border | `#7894B2` | Inputs and interactive boundaries |
| Foreground | `#10233F` | Primary text |
| Muted foreground | `#526B85` | Supporting text |
| Action | `#1D4ED8` | Primary action fill |
| Action hover | `#1E40AF` | Hover and pressed action |
| Focus | `#2563EB` | Keyboard focus indicator |
| Success text | `#166534` | Healthy/completed status |
| Success tint | `#F0FDF4` | Success background |
| Warning text | `#92400E` | Warning status |
| Warning tint | `#FFFBEB` | Warning background |
| Danger text | `#B91C1C` | Failure/destructive status |
| Danger tint | `#FEF2F2` | Danger background |

Reference sRGB contrast checks are 14.79:1 for foreground on canvas, 5.19:1
for muted foreground on canvas, 6.70:1 for white on action, 7.17:1 for
selected text on the selected surface, and 3.14:1 for the strong control border
on white. Revalidate opacity, hover, disabled, and dark-theme combinations in
the browser.

### Target cold-surface ramp

| Step | OKLCH | Approx. hex | Primary role |
| --- | --- | --- | --- |
| `surface-25` | `0.992 0.006 240` | `#F9FDFF` | Sidebar/faint raised surface |
| `surface-50` | `0.978 0.012 240` | `#F1F9FF` | Canvas |
| `surface-100` | `0.955 0.020 240` | `#E5F2FD` | Muted and hover |
| `surface-200` | `0.910 0.030 240` | `#D0E5F4` | Structural border |
| `surface-300` | `0.840 0.035 240` | `#B7CEDF` | Strong noninteractive structure |

The cold-surface roles are aliased to the reviewed light surface tokens. Dark
`ink`/surface steps 400–1000 retain their prior visual character.

### Target action reference

| Step | Hex | Usage |
| --- | --- | --- |
| `action-50` | `#EFF6FF` | Faint information surface |
| `action-100` | `#DBEAFE` | Selected/information tint |
| `action-500` | `#2563EB` | Focus and secondary action |
| `action-600` | `#1D4ED8` | Primary action fill |
| `action-700` | `#1E40AF` | Hover/pressed and links |
| `action-800` | `#1E3A8A` | Strong information text |

### Semantic light mapping

| Token | Target |
| --- | --- |
| `--background` | Canvas |
| `--foreground` | Foreground |
| `--card`, `--popover` | Card/popover |
| `--primary` | Action |
| `--primary-foreground` | White |
| `--secondary`, `--muted`, `--accent` | Muted/hover |
| `--selected`, `--selected-foreground` | Selected surface/text pair |
| `--border` | Border |
| `--input` | Control border |
| `--ring` | Focus |
| `--info`, `--info-subtle` and foreground pairs | Information fill and subtle states |
| `--success`, `--success-subtle` and foreground pairs | Success fill and subtle states |
| `--warning`, `--warning-subtle` and foreground pairs | Warning fill and subtle states |
| `--destructive`, `--destructive-subtle` and foreground pairs | Danger fill and subtle states |
| `--chart-action`, `--chart-success`, `--chart-warning`, `--chart-danger` | Status-chart roles |
| `--chart-qualitative-1..6`, `--chart-grid`, `--chart-axis` | Qualitative series and chart structure |
| `--sidebar` | Sidebar |
| `--sidebar-accent` and foreground | Muted/hover pair |
| `--sidebar-selected` and foreground | Selected-navigation pair |
| `--sidebar-primary` and foreground | Action pair |
| `--sidebar-border`, `--sidebar-ring` | Sidebar structure and focus |

The dark surface palette is not being redesigned. It must retain its current
visual character while adopting the same action-versus-success separation.

## Component appearance

### Shell and navigation

- Sidebar uses the near-white cold surface and a crisp logical-end divider.
- Active navigation uses a selected-blue surface plus a 2px logical-start
  cobalt rail; it is never a filled pill.
- Topbar is opaque and border-separated. Decorative backdrop blur is not
  allowed.
- Search, command palette, breadcrumbs, sidebar, and mobile navigation consume
  one canonical permission-filtered route tree.
- Deep routes remain reachable by command search even when they are not pinned
  in the expanded sidebar.

### Surfaces

- Cards are white with one 1px border and a 6–8px radius.
- Nested cards are avoided. A filter region plus table is one data surface.
- Cards do not use decorative shadows. Shadow is reserved for popovers,
  dialogs, sheets, and other genuinely floating layers.
- Gradients are functional exceptions only: brand mark, sticky fade, and
  skeleton shimmer.

### Forms and actions

- Every field has a persistent visible label and a programmatic name.
- Desktop controls may render compactly; touch/coarse-pointer hit areas are at
  least 44px.
- Focus uses the cobalt ring and remains visible when the control is obscured,
  scrolled, or placed on a selected surface.
- Validation is inline and persistent. Multi-field failures add an error
  summary with links to every invalid field and focus the summary. A single
  field failure focuses that field.
- A page or visible modal surface has at most one filled primary action.

### Tables and filters

- Table headers use the muted cold-blue surface; rows use white.
- Hover and selected states are visibly distinct and do not rely on color alone.
- Body values use regular weight by default; semibold is reserved for the
  primary row identifier or exceptional emphasis.
- Secondary and destructive row actions move into an overflow menu.
- Filter labels remain visible after a value is entered.
- Refresh keeps stale rows, selection, pagination, and focus in place.

### Status and charts

- Action blue is not a lifecycle-status color.
- Success is green, warning is amber, danger is red, and neutral/in-progress
  uses neutral treatment plus text and optional motion.
- Color is always paired with a label, icon, shape, pattern, or direct value.
- Charts use validated chart-specific tokens, a visible legend or direct
  labels, and a localized text/table alternative.

### Authentication

- Login, invite, and reset screens share one `AuthShell` with theme and
  language controls.
- The light canvas is cold blue; the auth card is white with a border and
  restrained elevation.
- Authentication errors remain visible and announced until the operator acts.
- Login fields use appropriate autocomplete purposes. “Remember this session”
  defaults off for a privileged control plane unless an approved security
  policy explicitly chooses otherwise and explains device/session consequences.
- On large screens, optional supporting content must be operational—environment,
  security, or support information—not a marketing hero.

## Typography and iconography

- Retain IBM Plex Sans, IBM Plex Sans Arabic, and IBM Plex Mono.
- Use only weights 400, 500, and 600.
- Product text is at least 13px. Latin-only uppercase micro-labels use the 13px
  step; Arabic-capable labels use normal case and zero letter spacing.
- Lucide SVG icons remain the default. Emoji flags and emoji status icons are
  not structural UI.
- Icon-only controls require a localized accessible name and a visible tooltip
  when the action is not universally obvious.

## Motion and elevation

- Motion communicates state change or spatial relationship; it is not used for
  decorative entrance choreography in the authenticated application.
- Common transition duration is 150–250ms. Exit may be slightly faster than
  enter.
- Width/height animation in the shell is avoided when transform or opacity can
  communicate the same change.
- Every nonessential animation has a `prefers-reduced-motion` final state.

## Anti-patterns

- Recoloring `brand` blue before separating success.
- Raw palette or hex values inside feature components.
- Decorative orange CTA colors.
- Blue success badges or green primary-navigation states.
- Shadowed cards inside shadowed cards.
- Placeholder-only labels.
- Errors conveyed only through a toast.
- Hover-only actions or chart values.
- Arabic text with uppercase tracking or 12px microtype.
- A separate mobile information architecture that breaks deep links.

## Decision register

| ID | Decision | Status |
| --- | --- | --- |
| `DS-01` | Use Polar Control Plane: cold-blue light surfaces with flat precision panels | Approved |
| `DS-02` | Split cobalt action/information from emerald success/health before recoloring | Approved |
| `DS-03` | Preserve the current dark surface character; migrate semantic roles without a dark reskin | Approved |
| `DS-04` | Retain IBM Plex Sans, IBM Plex Sans Arabic, and IBM Plex Mono | Approved |
| `DS-05` | Use 13px as the minimum product-text size and 44px coarse-pointer targets | Approved |
| `DS-06` | Treat mobile as a supported operational layout with guided full-screen configuration when needed | Approved |
| `DS-07` | Use explicit `ar-EG` locale-default digits in Arabic and `en-US` in English | Implemented; runtime spot-check remains |
| `DS-08` | Validate exact dark action steps and chart qualitative tokens during their implementation phases | Tokens and source guard implemented; browser/CVD validation remains |

New decisions use the next ID and record rationale, owner, and review condition
when they override or narrow this master contract.

## Related target contracts

- [Operational UX](operational-ux.md)
- [Data experiences](data-experiences.md)
- [Accessibility, responsive behavior, and localization](accessibility-responsive-and-localization.md)
- [Design-update roadmap](design-update-roadmap.md)
