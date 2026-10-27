# Typography

Status: **Specification**

Written: **2026-08-27**

Updated: **2026-10-26** — [CRM Leads v3 fonts, weight policy & named type steps](specs/crm-leads-v3.md).

Source of truth once implemented: `src/app/fonts.ts`, `src/app/globals.css`.

## What this replaced (pre-rebuild, for context)

The app loads **zero fonts**. There is no `next/font` call anywhere, and no
Arabic face — so an Arabic-first product currently renders in whatever the
visiting OS happens to ship. On Windows that is Segoe UI falling back to Segoe
UI Historic for Arabic; on macOS, Geeza Pro. Two users see two different
products.

Alongside that: 83 arbitrary `text-[Npx]` sizes, 157 `font-bold`/`extrabold`/
`black` sites against 30 normal/medium, and no scale of any kind.

## The faces: Plus Jakarta Sans, Cairo, IBM Plex Mono

Updated **2026-10-26** ([specs/crm-leads-v3.md](specs/crm-leads-v3.md) Part 1 #4).
**Plus Jakarta Sans** (`latin`, `latin-ext`) and **Cairo** (`arabic`, `latin`)
carry all interface text across weights `400`–`800`; **IBM Plex Mono** carries
identifiers and machine values.

The stack order does the script routing automatically:

```css
@theme {
  --font-sans: var(--font-plex-latin), var(--font-plex-arabic), ui-sans-serif,
    system-ui, sans-serif;
  --font-arabic: var(--font-plex-arabic), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
}
```

**Latin first, Arabic second.** The browser resolves `font-family` per
*character*, not per element: a Latin or Western-digit run finds its glyphs in
Plus Jakarta Sans and stops there; an Arabic run falls through to Cairo. Both
render on the same line with no `:lang()` switching needed, while `font-arabic`
(`--font-arabic`) exposes Cairo explicitly where an Arabic headline opts into
optical weight balancing.

Note `@theme`, **not** `@theme inline`. Under Tailwind v4 `inline` means
"substitute this value into utilities and do not emit the custom property", so
an inline `--font-sans` would not exist at runtime. Both `:root` and `body` bind
the `next/font` variables directly so the page never falls back to system fonts
when utilities are tree-shaken.

What the pairing buys, concretely:

- No `:lang()` switching and no component branching on language to pick a face.
- Full geometric clarity across five weights (`400`, `500`, `600`, `700`, `800`)
  for dense Kanban cards, KPI badges and Arabic/English UI hierarchy.
- Mixed-script table cells — an Arabic customer name beside a Latin UUID
  fragment or Western numeral — align cleanly on one line.

**IBM Plex Mono** carries identifiers and machine values: UUIDs, correlation
IDs, idempotency keys, error codes, decimal strings, with unambiguous `0`/`O`
and `1`/`l`.

```ts
// src/app/fonts.ts
import { Cairo, IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";

export const plexLatin = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plex-latin",
  display: "swap",
  preload: false,
});

export const plexArabic = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plex-arabic",
  display: "swap",
  preload: false,
});

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
  preload: false,
});
```

The exported symbol names (`plexLatin`, `plexArabic`, `plexMono`) and CSS
variable names (`--font-plex-latin`, `--font-plex-arabic`, `--font-plex-mono`)
stay unchanged so `src/app/layout.tsx` attaches all three `.variable`
classNames on `<body>` without modification, self-hosted by `next/font`.

**`latin-ext` draws no glyph this UI renders by default.** It is declared so a
tenant or contact named with an accented Latin character stays in Plus Jakarta
Sans rather than dropping to a system sans mid-word.

### Nothing is preloaded, and that is deliberate

A preload is a promise that a file is needed for the first paint. This app
cannot make that promise about any of these faces:

- The language lives in `localStorage`, so the server always renders
  `lang="ar"` and the client corrects it after hydration. Every Arabic preload
  the server emits is wasted on an English operator, and the other way round.
- `latin-ext` carries no glyph this UI draws.
- Which weights a screen needs depends on the screen.

Preloading anyway costs a wasted download per face and makes the browser warn
that a preloaded resource went unused on every page load — the browser
reporting exactly that broken promise. `display: swap` keeps text visible while
a face arrives.

### Pairing: Readex Pro + DM Mono

**Superseded (first by IBM Plex Sans + IBM Plex Sans Arabic on 2026-09-01, then
by Plus Jakarta Sans + Cairo on 2026-10-26).** Readex Pro + DM Mono were the
system's initial rebuild faces, replaced during the admin-portal token port by
IBM Plex Sans / IBM Plex Sans Arabic, and updated in
[CRM Leads v3](specs/crm-leads-v3.md) to Plus Jakarta Sans + Cairo (keeping IBM
Plex Mono). The standing "fall back to **Zain**" instruction remains closed, and
build records that link to this section — notably
[../build/PHASE-2-FOUNDATION.md](../build/PHASE-2-FOUNDATION.md) — describe what
that phase installed as historical record.

## Five weights, physically enforced

Weights **400, 500, 600, 700 and 800** are downloaded for Plus Jakarta Sans and
Cairo ([specs/crm-leads-v3.md](specs/crm-leads-v3.md) Part 1 #4). Weight **900**
(`font-black`) remains forbidden by lint and is remapped to `800` in
`globals.css`, while `font-synthesis-weight: none` on `body` prevents the
browser from synthesising fake bolds:

```css
@theme {
  --font-weight-bold: 700;
  --font-weight-extrabold: 800;
  --font-weight-black: 800;
}
```

| Weight | Utility | Use |
| --- | --- | --- |
| 800 | `font-extrabold` | Inner KPI count numbers and avatar initials (`text-micro`) |
| 700 | `font-bold` | Stage column titles, card titles, primary CTA labels, active count pills, brand title |
| 600 | `font-semibold` | Page/section headings, `<th>`, KPI labels, activity pills, active nav tabs |
| 500 | `font-medium` | Form labels, inactive nav tabs, contact subtitles, source pills |
| 400 | `font-normal` | **All table body cells**, prose, values, secondary metadata |

Table body cells stay **400** unconditionally.

## The 7-step scale and named v3 steps

Declared in `@theme` (`src/app/globals.css`). Alongside the base 7-step scale
(`text-2xs` through `text-2xl`), CRM Leads v3
([specs/crm-leads-v3.md](specs/crm-leads-v3.md) Part 1 #5 & Part 2) defines seven
named steps so compact badges, chips, nav tabs and Kanban headers never use
arbitrary `text-[Npx]` utilities:

```css
@theme {
  /* Named CRM Leads v3 steps */
  --text-micro: 0.625rem;               /* 10px / 14px — inner count chips & avatar initials only */
  --text-badge: 0.6875rem;              /* 11px / 16px — KPI badges, activity & source pills, filter chips */
  --text-caption: 0.75rem;              /* 12px / 18px — contact subtitle, compact helper lines */
  --text-label: 0.78125rem;             /* 12.5px / 18px — toolbar CTA & compact control labels */
  --text-tab: 0.84375rem;               /* 13.5px / 20px — global nav tabs & collapsed rail titles */
  --text-card-title: 0.875rem;          /* 14px / 20px — Kanban & grid card lead/entity title */
  --text-column-title: 0.90625rem;      /* 14.5px / 21px — Kanban stage column header title */

  /* Base 7-step scale */
  --text-2xs: 0.71875rem;               /* 11.5px / 16px — Latin uppercase micro-labels */
  --text-xs: 0.78125rem;                /* 12.5px / 18px — workhorse: table headers, badges, meta */
  --text-sm: 0.875rem;                  /* 14px / 20px — base: body, table cells, inputs, buttons */
  --text-base: 0.9375rem;               /* 15px / 24px — prose, dialog descriptions */
  --text-lg: 1.0625rem;                 /* 17px / 24px — section titles, h2/h3 */
  --text-xl: 1.25rem;                   /* 20px / 28px — page title */
  --text-2xl: 1.5625rem;                /* 25px / 32px — KPI numerals. CEILING. */
}
```

The `text-tab` name avoids a utility collision with `--color-nav`.

Nothing in the app renders larger than `text-2xl`. Arbitrary `text-[Npx]`
utilities remain banned by ESLint and `census.mjs`; small type is permitted
only through `text-micro` (count chips and initials only), `text-badge`, and
`text-caption` in their designated roles. Where `text-2xs` appears, it remains
for Latin uppercase micro-labels only.

## Arabic gets a lift

Every small and mid step — both the named CRM Leads v3 steps and `xs` / `sm` /
`base` — gains `+1px` under `html[lang="ar"]`, with line-heights raised in
lockstep and negative letter-spacing zeroed so Cairo's dots and joined forms
never clip or split:

```css
html[lang="ar"] {
  --text-micro: 0.6875rem;              /* 11px / 15px */
  --text-badge: 0.75rem;                /* 12px / 17px */
  --text-caption: 0.8125rem;            /* 13px / 20px */
  --text-label: 0.84375rem;             /* 13.5px / 20px */
  --text-tab: 0.90625rem;               /* 14.5px / 22px, tracking 0em */
  --text-card-title: 0.9375rem;         /* 15px / 22px, tracking 0em */
  --text-column-title: 0.96875rem;      /* 15.5px / 23px, tracking 0em */
  --text-xs: 0.875rem;                  /* 14px / 20px */
  --text-sm: 0.9375rem;                 /* 15px / 22px */
  --text-base: 1rem;                    /* 16px / 26px */
}
```

`text-2xs` is deliberately **not** lifted — it is Latin-only by convention,
there being no uppercase in Arabic. Because the lift is driven by `html[lang]`,
it follows the language toggle automatically; no component branches on language
for sizing, ever.

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

**The rule holds on both sides of the split, and only one side could drift.**
`INTL_LOCALE.ar` pins every *formatted* number to Latin digits, but the Arabic
dictionary is hand-written, and it carried **24 Arabic-Indic digits across 12
strings** — so a single screen could show a formatted count in `0-9` beside a
hardcoded limit in `\u0660-\u0669`. Both are now Latin, and two census counters
hold the line:

| Counter | Catches |
| --- | --- |
| `arabicIndicDigits` | a literal `\u0660-\u0669` / `\u06F0-\u06F9` anywhere under `src/` |
| `localeUnawareFormatting` | a locale-conversion call with **no** argument, which resolves to the runtime's default and differs between a laptop, a browser and CI |

Both ratchet at **0**. A test that must name the Arabic-Indic block writes it
as code-point escapes, so the test pinning the rule is not the thing that
trips it.

Dates still use the Arabic locale's month names and ordering — only the
*numerals* are Latin.

### Decimals are strings

Money and quantity arrive as exact decimal strings. **Never** `Number()` them —
that silently loses precision past 2^53 and rounds trailing digits. Format for
display from the string; never compute totals in the browser. See
[architecture/data-layer.md](../architecture/data-layer.md#decimals).

## Three rules the scale alone does not cover

### Inputs are 16px on mobile

Text-entry controls render `text-base sm:text-sm`. Mobile Safari zooms the
viewport on focus for any input under 16px, which breaks the layout on every
visit. Full rule and rationale in
[DESIGN-SYSTEM.md](DESIGN-SYSTEM.md#inputs-are-16px-on-mobile).

### Prose is capped at 65 characters

`max-w-prose` on dialog descriptions, empty states, error prose, and the
ambiguous-outcome panel — Tailwind v4's `prose` max-width **is** `65ch`, so
this is the scale utility rather than an arbitrary value. One symbol,
`proseMeasure` in `src/design-system/lib/variants.ts`, so the cap is greppable
and moves in one place. Past roughly 75 characters the eye loses the line
return; in a full-width ERP container prose otherwise runs to 160+.

Exempt: table cells, labels, badges, nav items. Those are not prose and a
`ch` cap would only introduce ragged wrapping.

### Identifiers wrap, never overflow

UUIDs, `correlationId`s, idempotency keys and error codes are unbroken
36-character tokens with no natural break point. In a toast or a narrow cell
they push their container off-screen.

```css
overflow-wrap: anywhere;   /* on the mono / ID utility */
```

Both halves are supplied by one primitive: **`IdentifierText`**
(`src/design-system/primitives/IdentifierText.tsx`), which renders
`<bdi dir="ltr">` carrying `identifierText` (`font-mono wrap-anywhere`,
Tailwind v4's `wrap-anywhere` being exactly `overflow-wrap: anywhere`).

Wrapping was never the hard half. Isolation was: without `<bdi>`, bidirectional
reordering mangles a Latin id inside Arabic chrome and the **displayed value is
wrong**, not merely ugly. The rule was written down and then not followed —
98 monospace call sites carried neither `<bdi>` nor `dir`, and there was not a
single `<bdi>` in feature code, because every call site had to remember two
things and a `<span>` was one keystroke. A primitive that cannot be written
wrong is the fix; `scripts/design/identifier-guard.mjs` is what keeps it that
way (see [enforcement.md](enforcement.md#identifier-guardmjs)).

```tsx
<IdentifierText>{correlationId}</IdentifierText>
<IdentifierText selectAll>{idempotencyKey}</IdentifierText>
```

`selectAll` is for a key the user is expected to hand to support, where a
partial copy is worse than none.

**Never `word-break: break-all`** — it applies to ordinary prose as well and
hyphenates normal Arabic and English words mid-syllable. The guard rejects it.

**A monospace figure is not an identifier.** `font-mono` beside `tabular-nums`
marks a numeric column — a formatted amount, already `Intl`-formatted with an
explicit locale — and is exempt. Only unformatted machine tokens need the
isolation.

## Applying the scale

| Element | Class | Weight |
| --- | --- | --- |
| Page title | `text-xl` | 600 / 700 |
| Section title | `text-lg` | 600 |
| Stage column header title | `text-column-title` (`14.5px`) | 700 |
| Kanban / entity card title | `text-card-title` (`14px`) | 700 |
| Global nav tab / collapsed rail title | `text-tab` (`13.5px`) | 500 (inactive) / 600 (active) |
| Toolbar CTA / compact control label | `text-label` (`12.5px`) | 600 / 700 |
| Contact subtitle / helper line | `text-caption` (`12px`) | 500 |
| KPI badge / activity pill / source pill / filter chip | `text-badge` (`11px`) | 600 / 700 |
| Inner KPI count chip / avatar initials | `text-micro` (`10px`) | 700 / 800 |
| Card description | `text-sm` | 400 |
| Dialog title | `text-lg` | 600 |
| Body prose, dialog description | `text-base` | 400 |
| Form label | `text-sm` | 500 |
| Input, button | `text-sm` | 400 / 500 for button label |
| Table header `<th>` | `text-xs` uppercase, `tracking-wide` | 600 |
| Table body cell | `text-sm` | **400** |
| Metadata, helper, timestamp | `text-xs` | 400 |
| Latin uppercase micro-label | `text-2xs` | 500 |
| KPI numeral (StatCard) | `text-2xl` | 600 |
| ID, code, correlation ID | `text-xs font-mono` | 400 |

Table body cells are 400. A table where every cell is bold is a table with no
hierarchy at all.

Two rows moved with the admin port. **The table now renders at `text-sm`, not
`text-xs`** — one step up, paid for by the row growing from 36px to 44px, so
the cell has the room. And the header cell is uppercase with `tracking-wide`,
both undone under `rtl:` (`rtl:normal-case rtl:tracking-normal`): Arabic has no
uppercase, and letter-spacing breaks its joined forms rather than opening them
up.
