# Typography

Status: **[Verified current source; target conformance gaps recorded]**

Last source verification: **2026-08-29**

Owner: **Admin Portal**

Source: `src/app/fonts.ts`, `src/app/globals.css`.

## Pairing: IBM Plex Sans + IBM Plex Sans Arabic + IBM Plex Mono

Before this migration the app loaded **zero fonts** — no `next/font`, no
Arabic face — despite being Arabic-first, so every browser fell back to
whatever system UI font happened to be installed.

The Plex family was chosen because Plex Sans Arabic was drawn against Plex
Latin by the same type team: mixed-script lines (a status badge's Latin enum
value sitting inside an Arabic sentence, a `correlationId` inline with Arabic
prose) don't jump baseline or x-height the way an unrelated Latin/Arabic pair
would. Plex Mono pairs with both for the `correlationId` / `errorCode` /
idempotency-key text that appears throughout the app. Not Inter, not Geist —
picking either of those "safe default" faces is exactly the kind of choice
that makes a product look AI-generated.

```ts
// src/app/fonts.ts
export const plexLatin = IBM_Plex_Sans({ weight: ["400", "500", "600"], ... });
export const plexArabic = IBM_Plex_Sans_Arabic({ weight: ["400", "500", "600"], ... });
export const plexMono = IBM_Plex_Mono({ weight: ["400", "500", "600"], ... });
```

`globals.css` declares `--font-sans` with **Latin first, Arabic second**:

```css
--font-sans: var(--font-plex-latin), var(--font-plex-arabic), ui-sans-serif, system-ui, sans-serif;
```

The browser resolves font-family *per character*, so one stack serves both
scripts on the same line with zero JavaScript and no `:lang()` switching.

## Three weights, physically enforced

Only weights 400/500/600 are downloaded. `body { font-synthesis-weight:
none; }` in `globals.css` stops the browser from synthesizing a fake bold for
any heavier className that slips through — the ceiling is enforced by the
font files themselves, not just convention.

`globals.css` additionally remaps Tailwind's own weight keys:

```css
--font-weight-bold: 600;
--font-weight-extrabold: 600;
--font-weight-black: 600;
```

This is what let 1,078 pre-existing `font-bold` / `font-extrabold` /
`font-black` call sites (280 of which were `font-black`) de-escalate to 600
with zero `.tsx` edits during the theme flip.

**Weight policy:**

| Weight | Use |
| --- | --- |
| 600 | Headings, `<th>`, KPI numerals, button labels, active nav |
| 500 | Form labels, tabs, badges |
| 400 | **All table body cells**, all prose, all values |

Hierarchy comes from size and color, never weight. New code recovered from
before this migration (e.g. Phase 22's restored dashboard charts) is
normalized on sight — `font-bold`/`font-extrabold` classes become
`font-semibold` even where Tailwind's default palette would otherwise render
them correctly, because the census check treats any growth in
`fontBoldOrHeavier` as a regression to flag, not silently accept.

## The 7-step type scale

13px floor, 14px base. Declared in `globals.css`'s `@theme` block (all
values below are also self-documented there as comments):

| Token | Size / line-height | Use |
| --- | --- | --- |
| `text-2xs` | 12px / 16px | Legacy/transitional only; target product text does not use this step |
| `text-xs` | 13px / 18px | **Workhorse** — table cells, badges, metadata |
| `text-sm` | 14px / 20px | **Base** — body, inputs, buttons, labels, nav |
| `text-base` | 15px / 24px | Prose, dialog descriptions |
| `text-lg` | 17px / 24px | Card titles, h2/h3 |
| `text-xl` | 20px / 28px | Page title |
| `text-2xl` | 25px / 32px | KPI numerals — **ceiling**; nothing in the app renders larger |

The scale is compressed at the bottom (13→14→15px, where 90% of the app's
pixels live) and opens up by roughly 1.2× per step above that. Before this
migration 69% of all text was 12px or smaller (415 arbitrary
`text-[8px]`…`text-[11px]` plus 1,030 uses of `text-xs` at Tailwind's stock
12px) — `text-xs` alone lifting from 12px to 13px, plus the arbitrary sizes
collapsing onto `text-2xs`/`text-xs`, was one of the single largest
legibility fixes in the whole migration.

## Arabic lift and current gap

The three smallest steps get +1px in Arabic, with line-heights raised in
lockstep so ascenders/descenders don't clip:

```css
html[lang="ar"] {
  --text-xs: 0.875rem;   /* 14px, was 13 */
  --text-sm: 0.9375rem;  /* 15px, was 14 */
  --text-base: 1rem;     /* 16px, was 15 */
}
```

Plex Arabic needs this where Plex Latin doesn't — Naskh-style Arabic forms
need slightly more room at small sizes to keep dots and diacritics legible.
`text-2xs` is **not** lifted by current source. The intended rule was
Latin-uppercase-only, but current Arabic-capable table headers, sidebar labels,
KPI labels, and status badges still use it. That makes the earlier assumption
that it “never renders Arabic” false.

The approved target is explicit:

- Arabic-capable microcopy is at least 13px;
- Arabic uses normal casing and zero tracking;
- translated table headings, statuses, controls, and chart ticks may not use
  `text-2xs`;
- chart and axis labels are at least 13px in both languages.

See
[Accessibility, responsive behavior, and localization](accessibility-responsive-and-localization.md#bilingual-typography).

## Numeral policy

Dashboard and KPI number formatting goes through `Intl.NumberFormat` with an
explicit locale — `"ar-EG"` for Arabic, `"en-US"` for English — rather than
`undefined` (which resolves to the runtime's default locale and is
non-deterministic across machines and CI). See
`formatDashboardMetric()` in `src/app/(shell)/dashboard/utils/formatters.ts`
for the canonical example, fixed in Phase 22.

**Open, unresolved decision:** whether Arabic-locale numerals should render as
Western digits (`ar-EG-u-nu-latn`, so `tabular-nums` columns stay visually
aligned with their English-locale counterparts) or the `ar-EG` locale's
default Eastern Arabic-Indic digits. Today the app does **both**,
inconsistently — 3 files (`roles/page.tsx`, `StorageServerDetailScreen.tsx`,
`StorageServersScreen.tsx`) explicitly opt into `ar-EG-u-nu-latn`, while 27
other files pass plain `"ar-EG"` and get Eastern Arabic-Indic digits by
default. This predates the design-system migration and was never resolved to
one answer — it changes what numerals Arabic-locale operators see on every
screen, so it needs an explicit product decision before a codemod picks a
direction, not a default assumed by a docs pass.
