# Typography

Status: **[Verified current source — Ocean Navy v3 aligned]**

Last source verification: **2026-10-26**

Owner: **Admin Portal**

Source: `src/app/fonts.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/global-error.tsx`.

## Pairing: Plus Jakarta Sans + Cairo + IBM Plex Mono (`2026-10-26`)

Updated **2026-10-26** to match the Ocean Navy v3 identity across both portals
(replacing the earlier `IBM Plex Sans` + `IBM Plex Sans Arabic` pairing while
keeping `IBM Plex Mono` for machine identifiers).

```ts
// src/app/fonts.ts
import { Cairo, IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";

export const uiLatin = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-ui-latin",
  display: "swap",
  preload: false,
});

export const uiArabic = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-ui-arabic",
  display: "swap",
  preload: false,
});

export const uiMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ui-mono",
  display: "swap",
  preload: false,
});
```

Both `src/app/layout.tsx` and `src/app/global-error.tsx` attach
`${uiLatin.variable} ${uiArabic.variable} ${uiMono.variable}` on `<html>`,
so the font variables are available where the `:root` bridges compute.
`preload: false` with `display: "swap"` remains deliberate because language is
resolved from `localStorage` on the client rather than cookies on the server.

`globals.css` declares `--font-sans`, `--font-arabic`, and `--font-mono` in
plain `@theme` (not `@theme inline`, so custom properties exist at runtime) and
binds the font variables directly on `:root` and `body` with **Latin first,
Arabic second**:

```css
--font-sans: var(--font-ui-latin), var(--font-ui-arabic), ui-sans-serif, system-ui, sans-serif;
--font-arabic: var(--font-ui-arabic), ui-sans-serif, system-ui, sans-serif;
--font-mono: var(--font-ui-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
```

The browser resolves `font-family` *per character*, so Latin/Western-digit runs
render in Plus Jakarta Sans and Arabic runs fall through to Cairo on the same
line with zero JavaScript and no `:lang()` switching. `font-arabic` exposes
Cairo explicitly (including its `"latin"` subset for digits and punctuation)
where Arabic headlines opt into optical weight balancing.

## Five weights (`400`–`800`), `900` banned (`2026-10-26`)

Weights **400, 500, 600, 700, and 800** are downloaded for `uiLatin` and
`uiArabic` (`400, 500, 600` for `uiMono`). Weight **900** (`font-black`) remains
banned and remaps to `800` in `globals.css`, while `body { font-synthesis-weight: none; }`
prevents browsers from synthesizing fake bolds:

```css
@theme {
  --font-weight-bold: 700;
  --font-weight-extrabold: 800;
  --font-weight-black: 800;
}
```

**Weight policy:**

| Weight | Utility | Use |
| --- | --- | --- |
| 800 | `font-extrabold` | Inner KPI count chips and avatar initials (`text-micro`) |
| 700 | `font-bold` | Stage/column titles, card titles, compact toolbar CTAs, sidebar section labels |
| 600 | `font-semibold` | Page/section headings, `<th>`, KPI numerals, active nav items, status pills |
| 500 | `font-medium` | Form labels, inactive tabs, badges, subtitles |
| 400 | `font-normal` | **All table body cells**, prose, values, secondary metadata |

## Type scale: base 7-step scale + named v3 steps (`2026-10-26`)

Declared in `src/app/globals.css`. Alongside Admin Portal's 7-step base scale
(13px floor, 14px base, 25px ceiling), Ocean Navy v3 defines seven named role
steps so compact chips, badges, nav items, and card/column headers never use
arbitrary `text-[Npx]` utilities:

| Token | Latin size / line-height | Use |
| --- | --- | --- |
| `text-micro` | 10px / 14px | Inner count chips & avatar initials only |
| `text-badge` | 11px / 16px | KPI badges, activity & source pills, filter chips, sidebar section labels |
| `text-caption` | 12px / 18px | Contact subtitles, compact helper lines |
| `text-label` | 12.5px / 18px | Toolbar CTA & compact control labels |
| `text-tab` | 13.5px / 20px | Nav items & collapsed rail titles |
| `text-card-title` | 14px / 20px | Kanban & entity card titles |
| `text-column-title` | 14.5px / 21px | Stage column header titles |
| `text-2xs` | 13px / 18px | Legacy compatibility alias (`0.06em` tracking); migrate call sites to `text-xs` or `text-badge` |
| `text-xs` | 13px / 18px | **Workhorse** — table headers, badges, metadata |
| `text-sm` | 14px / 20px | **Base** — body, table cells, inputs, buttons, labels |
| `text-base` | 15px / 24px | Prose, dialog descriptions |
| `text-lg` | 17px / 24px | Card/section titles, h2/h3 |
| `text-xl` | 20px / 28px | Page title |
| `text-2xl` | 25px / 32px | KPI numerals — **ceiling**; nothing renders larger |

Verified **2026-10-26**: `text-tab` names the size to avoid the `--color-nav`
color collision. The other custom steps (`micro`, `badge`, `caption`, `label`,
`card-title`, `column-title`, `2xs`) and `tab` have no matching `--color-*` name.

Arbitrary `text-[Npx]` utilities remain banned. Sub-13px sizes are permitted
only through the named v3 tokens (`text-micro`, `text-badge`, `text-caption`,
`text-label`) in their designated roles.

## Arabic lift (`html[lang="ar"]`)

Under `html[lang="ar"]`, every small and mid step — both the named v3 steps and
`xs` / `sm` / `base` — receives `+1px`, raised line-heights, and zeroed negative
letter-spacing so Cairo's dots and joined forms never clip or split:

```css
html[lang="ar"] {
  --text-micro: 0.6875rem; /* 11px / 15px */
  --text-badge: 0.75rem; /* 12px / 17px */
  --text-caption: 0.8125rem; /* 13px / 20px */
  --text-label: 0.84375rem; /* 13.5px / 20px */
  --text-tab: 0.90625rem; /* 14.5px / 22px, tracking 0em */
  --text-card-title: 0.9375rem; /* 15px / 22px, tracking 0em */
  --text-column-title: 0.96875rem; /* 15.5px / 23px, tracking 0em */
  --text-xs: 0.875rem; /* 14px / 20px */
  --text-sm: 0.9375rem; /* 15px / 22px */
  --text-base: 1rem; /* 16px / 26px */
}
```

`text-2xs` remains unlifted by convention (Latin uppercase compatibility alias;
Arabic has no uppercase and must use normal casing with zero tracking). See
[Accessibility, responsive behavior, and localization](accessibility-responsive-and-localization.md#bilingual-typography).

## Numeral policy

Dashboard and KPI number formatting goes through `Intl.NumberFormat` with an
explicit locale — `"ar-EG"` for Arabic, `"en-US"` for English — rather than
`undefined` (which resolves to the runtime's default locale and is
non-deterministic across machines and CI). See `formatDashboardMetric()` in
`src/app/(shell)/dashboard/utils/formatters.ts`.

**Open product decision:** whether Arabic-locale numerals across Admin Portal
should standardize on Western digits (`ar-EG-u-nu-latn`, matching Tenant Portal
so `tabular-nums` columns align identically across locales) or retain `ar-EG`'s
Eastern Arabic-Indic default where currently used (`roles/page.tsx`,
`StorageServerDetailScreen.tsx`, and `StorageServersScreen.tsx` currently opt
into `ar-EG-u-nu-latn`, while other screens pass plain `"ar-EG"`). Standardizing
requires an explicit Admin product decision rather than an unannounced codemod.
