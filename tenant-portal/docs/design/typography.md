# Typography

Status: **Specification**

Written: **2026-08-27**

Source of truth once implemented: `src/app/fonts.ts`, `src/app/globals.css`.

## The current state this replaces

The app loads **zero fonts**. There is no `next/font` call anywhere, and no
Arabic face — so an Arabic-first product currently renders in whatever the
visiting OS happens to ship. On Windows that is Segoe UI falling back to Segoe
UI Historic for Arabic; on macOS, Geeza Pro. Two users see two different
products.

Alongside that: 83 arbitrary `text-[Npx]` sizes, 157 `font-bold`/`extrabold`/
`black` sites against 30 normal/medium, and no scale of any kind.

## Pairing: Readex Pro + DM Mono

**Readex Pro** carries all interface text — headings and body, Arabic and
Latin, from one family.

This is the single most consequential typographic decision in the system.
Readex Pro is a superfamily drawn for Arabic and Latin *together*, so a status
badge's Latin `QUALIFIED` sitting inside an Arabic sentence shares the family's
own vertical metrics. It does not jump baseline or x-height the way two
separately-chosen faces do, no matter how carefully they are matched.

What that buys, concretely:

- No `:lang()` switching and no per-script font stack.
- One set of vertical metrics, so line-height maths is correct for both scripts.
- Mixed-script table cells — extremely common here, an Arabic customer name
  beside a Latin UUID fragment — align without per-cell correction.

It is also not a face anyone reaches for by default, which matters: picking
Inter, Geist, or Cairo is exactly the choice that makes a product look
generated rather than designed.

**DM Mono** carries identifiers and machine values: UUIDs, correlation IDs,
idempotency keys, error codes, decimal strings. It is narrow, has unambiguous
`0`/`O` and `1`/`l`, and its light colour sits quietly next to Readex without
competing.

```ts
// src/app/fonts.ts
import { Readex_Pro, DM_Mono } from "next/font/google";

export const readex = Readex_Pro({
  subsets: ["latin", "arabic"],
  weight: ["400", "500", "600"],
  variable: "--font-readex",
  display: "swap",
});

export const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});
```

```css
@theme inline {
  --font-sans: var(--font-readex), ui-sans-serif, system-ui, "Segoe UI", sans-serif;
  --font-mono: var(--font-dm-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
}
```

Both fonts must be applied via `className` on `<html>` in
`src/app/layout.tsx`, never loaded through a `<link>` — `next/font` self-hosts
them, which removes the render-blocking round trip to Google and the privacy
question that comes with it.

> **Verify at build time.** These faces have not been rendered in this
> environment. Confirm that Readex Pro's Arabic subset loads and that its
> numerals are legible at `text-xs` before converting screens. If Readex Pro's
> Arabic proves too wide for the table density in
> [geometry.md](geometry.md), the fallback choice is **Zain** (also a
> Latin+Arabic superfamily, narrower) — record the switch here if it happens.

## Three weights, physically enforced

Only 400, 500 and 600 are downloaded. `font-synthesis-weight: none` on `body`
stops the browser synthesising a fake bold for anything heavier that slips
through, so the ceiling is enforced by the font files, not by convention.

`globals.css` additionally remaps Tailwind's own weight keys, which
de-escalates all 157 existing `font-bold`/`font-extrabold`/`font-black` call
sites with zero file edits:

```css
@theme {
  --font-weight-bold: 600;
  --font-weight-extrabold: 600;
  --font-weight-black: 600;
}
```

| Weight | Use |
| --- | --- |
| 600 | Headings, `<th>`, KPI numerals, button labels, active nav |
| 500 | Form labels, tabs, badges, card titles |
| 400 | **All table body cells**, all prose, all values, all metadata |

Hierarchy comes from size and color. Never weight.

## The 7-step scale

13px floor, 14px base. Declared in `@theme`.

```css
@theme {
  --text-2xs: 0.75rem;              /* 12px — Latin uppercase micro-labels ONLY */
  --text-2xs--line-height: 1rem;    /* 16px */
  --text-2xs--letter-spacing: 0.06em;

  --text-xs: 0.8125rem;             /* 13px — workhorse: table cells, badges, meta */
  --text-xs--line-height: 1.125rem; /* 18px */

  --text-sm: 0.875rem;              /* 14px — base: body, inputs, buttons, nav */
  --text-sm--line-height: 1.25rem;  /* 20px */
  --text-sm--letter-spacing: -0.003em;

  --text-base: 0.9375rem;           /* 15px — prose, dialog descriptions */
  --text-base--line-height: 1.5rem; /* 24px */
  --text-base--letter-spacing: -0.006em;

  --text-lg: 1.0625rem;             /* 17px — card titles, h2/h3 */
  --text-lg--line-height: 1.5rem;   /* 24px */
  --text-lg--letter-spacing: -0.01em;

  --text-xl: 1.25rem;               /* 20px — page title */
  --text-xl--line-height: 1.75rem;  /* 28px */
  --text-xl--letter-spacing: -0.014em;

  --text-2xl: 1.5rem;               /* 24px — KPI numerals. CEILING. */
  --text-2xl--line-height: 2rem;    /* 32px */
  --text-2xl--letter-spacing: -0.018em;
}
```

Nothing in the app renders larger than `text-2xl`. There is no hero type in a
CRM.

The scale is compressed at the bottom — 13 → 14 → 15px, where roughly 90% of
the app's pixels live — and opens up by about 1.2× per step above that.

**`text-2xs` is Latin-uppercase micro-labels only.** There is no uppercase in
Arabic, so it must never wrap Arabic text. If you need a small label that can
hold Arabic, use `text-xs`.

## Arabic gets a lift

The three smallest steps gain 1px under Arabic, with line-heights raised in
lockstep so ascenders and the dots below `ب`/`ي` do not clip:

```css
html[lang="ar"] {
  --text-xs: 0.875rem;              /* 14px, was 13 */
  --text-xs--line-height: 1.25rem;  /* 20px, was 18 */
  --text-sm: 0.9375rem;             /* 15px, was 14 */
  --text-sm--line-height: 1.375rem; /* 22px, was 20 */
  --text-base: 1rem;                /* 16px, was 15 */
  --text-base--line-height: 1.625rem; /* 26px, was 24 */
}
```

Arabic Naskh forms need more vertical room at small sizes than Latin does to
keep dots and diacritics separable. `text-2xs` is deliberately **not** lifted —
it is Latin-only by definition.

Because the lift is driven by `html[lang]`, it follows the language toggle
automatically. No component branches on language for sizing, ever.

## Numerals

### Tabular figures in every column

Any digit that sits in a column — table cells, KPI values, pagination counts,
currency — takes `tabular-nums`. `DataTable`'s numeric column type applies it
automatically; if you hand-roll a numeric cell, add it.

### Locale formatting

All number and date formatting goes through `Intl` with an **explicit** locale.
Never pass `undefined`, which resolves to the runtime's default and is
non-deterministic across machines and CI.

```ts
// src/lib/format/number.ts
const LOCALE = { ar: "ar-EG-u-nu-latn", en: "en-US" } as const;
```

### The digit decision — settled

Arabic locale renders **Western (Latin) digits**, via the
`-u-nu-latn` numbering-system extension shown above. Not Eastern
Arabic-Indic (`٠١٢٣`).

This is a deliberate product decision, made here so no one has to ask:

- Tenant staff read Latin digits in every other business system they use —
  invoices, bank portals, ERP exports, WhatsApp.
- A `tabular-nums` column stays visually aligned with its English-locale
  counterpart, so a screenshot or an export is comparable across languages.
- Identifiers, decimal strings and currency values arrive from the backend as
  Latin-digit strings. Rendering them as Arabic-Indic while an adjacent raw ID
  stays Latin is the inconsistency users actually notice.

Dates still use the Arabic locale's month names and ordering — only the
*numerals* are Latin.

### Decimals are strings

Money and quantity arrive as exact decimal strings. **Never** `Number()` them —
that silently loses precision past 2^53 and rounds trailing digits. Format for
display from the string; never compute totals in the browser. See
[architecture/data-layer.md](../architecture/data-layer.md#decimals).

## Applying the scale

| Element | Class | Weight |
| --- | --- | --- |
| Page title | `text-xl` | 600 |
| Section / card title | `text-lg` | 500 |
| Dialog title | `text-lg` | 600 |
| Body prose, dialog description | `text-base` | 400 |
| Form label | `text-sm` | 500 |
| Input, button, nav item | `text-sm` | 400 / 600 for button label |
| Table header `<th>` | `text-xs` | 600 |
| Table body cell | `text-xs` | **400** |
| Badge | `text-xs` | 500 |
| Metadata, helper, timestamp | `text-xs` | 400 |
| Latin uppercase micro-label | `text-2xs` | 500 |
| KPI numeral | `text-2xl` | 600 |
| ID, code, correlation ID | `text-xs font-mono` | 400 |

Table body cells are 400. A table where every cell is bold is a table with no
hierarchy at all.
