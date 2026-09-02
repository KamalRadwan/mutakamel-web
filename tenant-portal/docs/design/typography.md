# Typography

Status: **Specification**

Written: **2026-08-27**

Source of truth once implemented: `src/app/fonts.ts`, `src/app/globals.css`.

## What this replaced (pre-rebuild, for context)

The app loads **zero fonts**. There is no `next/font` call anywhere, and no
Arabic face — so an Arabic-first product currently renders in whatever the
visiting OS happens to ship. On Windows that is Segoe UI falling back to Segoe
UI Historic for Arabic; on macOS, Geeza Pro. Two users see two different
products.

Alongside that: 83 arbitrary `text-[Npx]` sizes, 157 `font-bold`/`extrabold`/
`black` sites against 30 normal/medium, and no scale of any kind.

## The faces: IBM Plex Sans, Plex Sans Arabic, Plex Mono

Ported verbatim from the admin portal, so both portals draw the same
superfamily. **Plex Sans** and **Plex Sans Arabic** carry all interface text
between them; **Plex Mono** carries machine values.

This is still the single most consequential typographic decision in the system,
and the port did not change what it is *for* — only how it is spelled. Plex
Sans Arabic was drawn against Plex Latin by the same team, so a status badge's
Latin `QUALIFIED` sitting inside an Arabic sentence still shares vertical
metrics with the sentence around it. It does not jump baseline or x-height the
way two independently-chosen faces do.

The one thing that genuinely changed: this is **two sans families, not one**,
and the stack order now does the work a single family used to do for free.

```css
@theme {
  --font-sans: var(--font-plex-latin), var(--font-plex-arabic), ui-sans-serif,
    system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, SFMono-Regular, Menlo, monospace;
}
```

**Latin first, Arabic second.** The browser resolves `font-family` per
*character*, not per element: a Latin run finds its glyphs in Plex Sans and
stops there, an Arabic run finds nothing in Plex Sans and falls through to Plex
Sans Arabic. Both render on the same line, with no `:lang()` switching and no
per-script stack — the property the single-family choice used to buy, bought
here by ordering.

Note `@theme`, **not** `@theme inline`. Under Tailwind v4 `inline` means
"substitute this value into utilities and do not emit the custom property", so
an inline `--font-sans` does not exist at runtime and
`body { font-family: var(--font-sans) }` resolves to nothing — the app renders
in the system stack while the webfont downloads and draws no glyph. `body`
therefore also names the two variables directly rather than going through
`--font-sans`.

What the pairing buys, concretely:

- No `:lang()` switching and no component branching on language to pick a face.
- One set of vertical metrics across both scripts, so line-height maths is
  correct for both.
- Mixed-script table cells — extremely common here, an Arabic customer name
  beside a Latin UUID fragment — align without per-cell correction.

**Plex Mono** carries identifiers and machine values: UUIDs, correlation IDs,
idempotency keys, error codes, decimal strings. Unambiguous `0`/`O` and
`1`/`l`, and it sits quietly beside Plex Sans because it is the same
superfamily rather than a mono chosen to look compatible.

```ts
// src/app/fonts.ts
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";

export const plexLatin = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-latin",
  display: "swap",
  preload: false,
});

export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
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

All three `.variable` classNames go on `<body>` in `src/app/layout.tsx`, never
through a `<link>` — `next/font` self-hosts them, which removes the
render-blocking round trip to Google and the privacy question that comes with
it.

**`latin-ext` draws no glyph this UI renders.** It is declared so a tenant or a
person named with an accented character still renders in Plex rather than
dropping to a system sans mid-word.

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

**Superseded.** These were the system's faces until the token layer was
replaced with the admin portal's. The reasoning that chose them — one
superfamily across scripts, three weights, a quiet mono for identifiers — is
the reasoning the Plex trio satisfies as well, with the extra property that
both portals now set the same type.

Two things retired with them. Readex Pro was chosen partly because *nobody
reaches for it by default*, which is no longer the argument: Plex is chosen
because the sibling portal already ships it, and consistency between the two
products beats distinctiveness within one. And the standing "verify at build
time, fall back to **Zain** if Readex Pro's Arabic proves too wide at row
density" instruction is closed — there is no Zain fallback, and the row it
would have been measured against is 44px now, not 36.

Build records that link to this section, notably
[../build/PHASE-2-FOUNDATION.md](../build/PHASE-2-FOUNDATION.md), describe what
that phase installed and are accurate as history.

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
  --text-2xs: 0.8125rem;              /* 13px — compatibility alias; migrate to text-xs */
  --text-2xs--line-height: 1.125rem;  /* 18px */
  --text-2xs--letter-spacing: 0.06em;

  --text-xs: 0.8125rem;               /* 13px — workhorse: table headers, badges, meta */
  --text-xs--line-height: 1.125rem;   /* 18px */
  --text-xs--letter-spacing: 0em;

  --text-sm: 0.875rem;                /* 14px — base: body, table cells, inputs, buttons, nav */
  --text-sm--line-height: 1.25rem;    /* 20px */
  --text-sm--letter-spacing: -0.003em;

  --text-base: 0.9375rem;             /* 15px — prose, dialog descriptions */
  --text-base--line-height: 1.5rem;   /* 24px */
  --text-base--letter-spacing: -0.006em;

  --text-lg: 1.0625rem;               /* 17px — card titles, h2/h3 */
  --text-lg--line-height: 1.5rem;     /* 24px */
  --text-lg--letter-spacing: -0.01em;

  --text-xl: 1.25rem;                 /* 20px — page title */
  --text-xl--line-height: 1.75rem;    /* 28px */
  --text-xl--letter-spacing: -0.014em;

  --text-2xl: 1.5625rem;              /* 25px — KPI numerals. CEILING. */
  --text-2xl--line-height: 2rem;      /* 32px */
  --text-2xl--letter-spacing: -0.018em;
}
```

Nothing in the app renders larger than `text-2xl`. There is no hero type in a
CRM.

The scale is compressed at the bottom — 13 → 14 → 15px, where roughly 90% of
the app's pixels live — and opens up by about 1.2× per step above that.

**Only two steps moved in the admin port**, and both are at the ends:
`text-2xs` 12 → 13px and `text-2xl` 24 → 25px. Everything between is
byte-identical to what it was, which is why the port changed no layout.

**`text-2xs` is now a compatibility alias for `text-xs`.** It is the same 13px
at the same 18px line-height; the only difference left is its `0.06em`
tracking, which is what an uppercase micro-label wants. That makes it a *style*
rather than a *size*, and new code should reach for `text-xs` plus explicit
tracking instead. `text-xs` gained an explicit `letter-spacing: 0em` in the
same move, so it cannot silently inherit that tracking.

Where `text-2xs` is still used, the old rule holds: **Latin uppercase
micro-labels only.** There is no uppercase in Arabic, so it must never wrap
Arabic text — which is also why it is the one step the Arabic lift skips.

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

Plex Sans Arabic's Naskh forms need more vertical room at small sizes than Plex
Latin does to keep dots and diacritics separable. `text-2xs` is deliberately
**not** lifted — it is Latin-only by convention, there being no uppercase in
Arabic. This block is identical to admin's, and the port did not touch it.

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
| Page title | `text-xl` | 600 |
| Section / card title | `text-lg` | 600 |
| Card description | `text-sm` | 400 |
| Dialog title | `text-lg` | 600 |
| Body prose, dialog description | `text-base` | 400 |
| Form label | `text-sm` | 500 |
| Input, button, nav item | `text-sm` | 400 / 500 for button label |
| Table header `<th>` | `text-xs` uppercase, `tracking-wide` | 600 |
| Table body cell | `text-sm` | **400** |
| Badge | `text-xs` | 500 |
| Metadata, helper, timestamp | `text-xs` | 400 |
| Latin uppercase micro-label | `text-2xs` | 500 |
| KPI numeral | `text-2xl` | 600 |
| ID, code, correlation ID | `text-xs font-mono` | 400 |

Table body cells are 400. A table where every cell is bold is a table with no
hierarchy at all.

Two rows moved with the admin port. **The table now renders at `text-sm`, not
`text-xs`** — one step up, paid for by the row growing from 36px to 44px, so
the cell has the room. And the header cell is uppercase with `tracking-wide`,
both undone under `rtl:` (`rtl:normal-case rtl:tracking-normal`): Arabic has no
uppercase, and letter-spacing breaks its joined forms rather than opening them
up.
