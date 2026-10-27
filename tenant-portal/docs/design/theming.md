# Theming & Direction

Status: **Specification**

Written: **2026-08-27**

Updated: **2026-10-26** — [CRM Leads v3 Ocean Navy & dark surface hierarchy](specs/crm-leads-v3.md).

## What this replaced (pre-rebuild, for context)

Four separate defects, all in the same seam:

1. `src/app/layout.tsx` hardcodes `lang="ar" dir="rtl"`, and
   `I18nContext` corrects it in a `useEffect` after hydration. Every
   English-preferring user sees one RTL frame on every page load.
2. `ThemeToggle` writes `document.documentElement.classList` from its own
   `useEffect`. The stored theme is therefore applied **only on pages that
   render the toggle**, and always one frame late — a dark-mode user gets a
   white flash on every navigation.
3. There is no `ThemeProvider` anywhere in the tree. Theme is a side effect of
   a button being mounted.
4. 13 physical direction utilities (`ml-`, `pl-`, `left-`, `text-left`) are
   in use in an RTL-default app.

All four are fixed in the foundation phase, before any screen is converted.

## Three axes, three states each

| Axis | States | Stored as |
| --- | --- | --- |
| Theme | `light`, `dark`, `system` | `localStorage["tenant_theme"]` |
| Language | `ar`, `en` | `localStorage["tenant_lang"]` |
| Density | `compact`, `standard`, `comfortable` | `localStorage["tenant_density"]` |

Direction is **derived** from language and never stored separately:
`ar → rtl`, `en → ltr`.

Defaults for a first-ever visitor: **Arabic, RTL, system theme, standard
density.** Arabic is a product decision, not a fallback. Standard is the
decision the admin-portal token port made — `--ui-scale` moved from 0.9 to 1,
so the shipped default is no longer compact. See
[DECISIONS.md](../build/DECISIONS.md).

### Density is the absence of a value, not a value

The other two axes store a default that means something. Density does not.
Whichever density `globals.css` already declares is written **nowhere else**:
choosing it **removes** the stored key and **removes** the inline property
rather than writing the same number a second time. Since the port, the value
`globals.css` declares is `--ui-scale: 1`, so the row carrying no override is
`standard`:

| Choice | `localStorage` | `<html style>` |
| --- | --- | --- |
| `compact` | `"compact"` | `--ui-scale: 0.9` |
| `standard` | key removed | `--ui-scale` removed |
| `comfortable` | `"comfortable"` | `--ui-scale: 1.1` |

**The top two rows swapped when the default moved.** It used to be `compact`
that was the absence. The *rule* did not change — one number, one home — only
which choice the stylesheet happens to be spelling. A second copy of the
default is a number that can drift from the stylesheet, and no gate would catch
the drift: that is close to how the first `--ui-scale` implementation shipped
**inverted** with every gate green. `DensityProvider.applyDensity` and the
inline bootstrap in `layout.tsx` perform the identical write, and a test pins
them against each other so they cannot drift apart either.

Why the default moved at all: 0.9 was the single reason the tenant portal
rendered about 10 % smaller than the admin portal at every control, row and
chrome edge. Admin has no density multiplier, so scale 1 is what "the same size
as admin" means. Compact stays one click away in the user menu for the operator
who wants more rows on a 1366×768 laptop.

Only the geometry tokens (`--size-control-*`, `--size-row`, `--size-topbar`
`58px`, `--size-actionbar` `35px`, `--size-toolbar` `48px`,
`--size-toolbar-control` `33px`, `--size-brand`, `--size-column-collapsed`)
multiply by `--ui-scale`. **Type does not**, and neither does radius
(`--radius-xs` through `--radius-xl`, plus `--radius-card` `13px` and
`--radius-column` `16px`): the named type steps (`text-micro` through
`text-column-title` and `text-2xs` through `text-2xl`) hold their `rem` scale
and `html[lang="ar"]` lift, and radius stays a shape constant. Comfortable
makes rows and bars taller, not letters bigger.

## No flash — the mechanism

All three axes must be correct in the **first painted frame**. Since none can
be resolved on the server without a cookie, and this app does not use one, an
inline script writes the DOM before React hydrates.

```tsx
// src/app/layout.tsx
import { InlineBootstrapScript } from "./InlineBootstrapScript";

const BOOTSTRAP = `(function(){try{
  var d=document.documentElement;
  var l=localStorage.getItem("tenant_lang")==="en"?"en":"ar";
  d.lang=l; d.dir=l==="ar"?"rtl":"ltr";
  var t=localStorage.getItem("tenant_theme");
  var dark=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);
  d.classList.toggle("dark",dark);
  var s=localStorage.getItem("tenant_density");
  if(s==="compact")d.style.setProperty("--ui-scale","0.9");
  else if(s==="comfortable")d.style.setProperty("--ui-scale","1.1");
}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Minted per request by src/proxy.ts — see
  // ../architecture/security-headers.md#the-nonce-problem.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="ar" dir="rtl" className={`${uiLatin.variable} ${uiArabic.variable} ${uiMono.variable} h-full`} suppressHydrationWarning>
      <head>
        <InlineBootstrapScript nonce={nonce} html={BOOTSTRAP} />
      </head>
      <body
        suppressHydrationWarning
        className="h-full antialiased"
      >
        {children}
      </body>
    </html>
  );
}
```

Note the density branch writes **nothing** for `standard`. That is the table
above expressed in the one place it has to be: the absence of an override *is*
the default, so the bootstrap has no `else` and never needs to know what number
`globals.css` carries.

```tsx
// src/app/InlineBootstrapScript.tsx
"use client";

export function InlineBootstrapScript({
  nonce,
  html,
}: {
  nonce?: string;
  html: string;
}) {
  return (
    <script
      id="theme-bootstrap"
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

`suppressHydrationWarning` on that tag is not optional and not cosmetic.
Browsers blank a `nonce` **content attribute** once the document is parsed —
CSP3 nonce hiding, so the value cannot be read back out of the DOM — while
React compares that attribute during hydration and sees `""` against the value
it rendered. Without the suppression every page load reports a mismatch on a
security-critical element, which is exactly the noise that teaches a reader to
scroll past hydration warnings.

This is also why it is a plain `<script>` rather than `next/script` with
`strategy="beforeInteractive"`: that component applies only `nonce` and
`dangerouslySetInnerHTML` to the emitted tag and serialises every other prop
into its `self.__next_s` queue, so the suppression could never reach the
element — and queueing would run the bootstrap when Next's runtime drains the
queue rather than at parse time, which is later than a no-flash script can
afford. The helper follows Next 16's inline-script guidance: its server render
is executable `text/javascript`, while a client render is an inert
`text/plain` data block. That keeps the hard-navigation, before-paint bootstrap
and prevents React from warning or trying to create an executable script during
Fast Refresh and client reconciliation.

Notes that matter:

- The server still renders `lang="ar" dir="rtl"` — the Arabic-first default.
  The script corrects it for English users before first paint.
- `suppressHydrationWarning` on `<html>` is **required**, because the script
  intentionally mutates attributes React rendered.
- The whole thing is wrapped in `try/catch`. A private window or blocked
  storage must fall through to the defaults, never throw.
- `matchMedia` is only consulted when the stored value is neither `dark` nor
  `light` — an explicit choice always beats the OS.

## Providers read the same keys

`I18nProvider`, `ThemeProvider` and `DensityProvider` must read the identical `localStorage` keys
via `useSyncExternalStore`, so their **first client render already agrees**
with what the bootstrap script wrote. No `useEffect` correction, no hydration
mismatch, no flash.

```ts
// src/i18n/useLanguage.ts
export function useLanguage() {
  return useSyncExternalStore(subscribe, getSnapshot, () => "ar" as const);
}
```

The server snapshot is `"ar"`, matching the server-rendered `<html lang="ar">`.

**Never write these values from a `useEffect`.** A `useEffect` that sets
`document.documentElement.*` on mount is precisely the bug being removed.

## Account preferences on a fresh device

Verified **2026-10-17** (CXPORTAL-SHELL-112). The authenticated runtime reads
`GET /api/tenant/core/v1/users/me/profile` after authentication and seeds each
missing device key independently with supported account values (`ar`/`en`,
`light`/`dark`/`system`). Profile loading also retries this initialization.
Null or unsupported values leave the defaults intact. Failed reads leave the
session and local rendering intact; Profile exposes its normal error/retry UI.

The inline bootstrap still owns first paint (D-4.17). Account loading is
asynchronous and may update an empty device after authentication. Stored device
choices, including choices made while the read is pending, always win.
Selecting `system` stores the literal `system` rather than deleting the key,
so account dark/light preferences cannot override that explicit OS-following
choice. Previously deleted system choices cannot be distinguished from a fresh
device. Signing out or switching accounts aborts pending preference reads.

## The dark variant

```css
@custom-variant dark (&:where(.dark, .dark *));
```

Class-based, matching the bootstrap script's `classList.toggle("dark", …)`.
Not `prefers-color-scheme` alone — that cannot express an explicit user choice
that overrides the OS.

`system` means "follow the OS". When the stored value is `system`, subscribe to
`matchMedia("(prefers-color-scheme: dark)")` and update the class on change, so
a user whose OS flips at sunset sees the app follow without a reload.

## Both themes are designed, not inverted

Every token has an explicit value in both themes — see
[tokens.md](tokens.md#semantic-tokens) and
[specs/crm-leads-v3.md](specs/crm-leads-v3.md) Part 2. Rules:

- **Never** define a color or gradient only inside `.dark`. Every semantic role
  and `--gradient-*` token is declared on `:root` and overridden in `.dark` so
  components carry zero `dark:` overrides.
- `body` sets an explicit `background` from `--background`. A transparent body
  borrows whatever is behind it.
- **Three-tier surface staircase in both themes.** In light mode:
  `bg-gradient-canvas` (`#edf2f8 → #e4ebf5`) / `--background` (`ink-50`) →
  `--surface-column` (`#f6f8fc`) → `--card` / `--surface-toolbar` /
  `--surface-column-header` (`#ffffff`) with `--surface-subtle` (`#f8fafc`) for
  inner footers and neutral pills. In dark mode: `bg-gradient-canvas`
  (`#040911 → #060d17`) / `--background` (`ink-1000`) → `--surface-column`
  (`#070f1a`) → `--card` / `--surface-toolbar` / `--surface-column-header`
  (`ink-950`) → `--surface-subtle` (`#111c2b`), paired with calibrated borders
  (`--line-column`, `--line-card`, `--line-control`, `--line-divider`).
- **Semantic pills flip from pastel fills to low-alpha dark tints.** Activity
  pills (`--activity-*-surface`), KPI badges (`--kpi-*-surface`) and count pills
  (`--count-*-surface`) use soft opaque tints with deep labels in `:root` and
  translucent `rgb(... / 0.14–0.15)` tints with bright pastel labels in `.dark`
  (or `brand-950` / `accent-950` for white-labelled / sky tokens). Every
  composited foreground/surface pair clears `≥ 4.5:1` (`≥ 3:1` for non-text
  entity icons and dark control lines) in `scripts/design/contrast.mjs`.
- **White-label survives across both themes.** Tenant-branded roles (`--primary`
  `brand-600` light / `brand-400` dark, `kpi-new-*`, `entity-person-*`,
  `count-active-*`, `chip-active-*`, `bg-gradient-primary`, `bg-gradient-logo`,
  `bg-gradient-chip-active`) resolve through `--color-brand-*`.
- **Elevation is a drop shadow on document surfaces in light and an inset
  hairline in dark.** `--elevation-pop`, `--elevation-overlay`,
  `--elevation-toolbar`, `--elevation-column` and `--elevation-card` become
  `inset 0 1px 0 0 rgb(255 255 255 / 0.04–0.08)` in `.dark`, while
  `--elevation-nav-active` retains its subtle sky glow on the Ocean Navy header.
- **Ocean Navy global header is fixed chrome; the toolbar and workspace theme.**
  `GlobalNav` (`bg-gradient-header` + `bg-gradient-brand-strip`, `58px`) stays
  Ocean Navy in both light and dark modes with `#e2e8f0` / `#f8fafc` text, while
  the floating `48px` `PageActionBar` (`bg-surface-toolbar`) and workspace
  switch cleanly between light and dark — see [shell.md](shell.md) and
  [anti-patterns.md](anti-patterns.md#8-dark-chrome-that-is-a-costume).

Every screen is reviewed in both themes before it is called done. "It works in
dark" is half a review.

## RTL

### Logical properties only

| Never | Always |
| --- | --- |
| `ml-2` / `mr-2` | `ms-2` / `me-2` |
| `pl-3` / `pr-3` | `ps-3` / `pe-3` |
| `left-0` / `right-0` | `start-0` / `end-0` |
| `text-left` / `text-right` | `text-start` / `text-end` |
| `border-l` / `border-r` | `border-s` / `border-e` |
| `rounded-l-*` / `rounded-r-*` | `rounded-s-*` / `rounded-e-*` |

`pnpm design:rtl` hard-fails on any occurrence. The limit is **0**, with no
transitional headroom.

### Icons that must mirror

Direction-carrying glyphs flip; everything else does not.

| Flips | Never flips |
| --- | --- |
| `ChevronLeft` / `ChevronRight` | `Check`, `X`, `Plus`, `Search` |
| `ArrowLeft` / `ArrowRight` | Clock and time glyphs |
| Breadcrumb separators | Logos and brand marks |
| Pagination arrows | Media controls (play always points right) |
| Drawer/sheet slide direction | Status icons |

Use the logical component and let direction drive it, or apply
`rtl:-scale-x-100`. Never hand-swap the icon in a ternary.

### Third-party physical APIs

Radix takes physical sides. Compute them:

```tsx
const { dir } = useI18n();
<DropdownMenuContent side={dir === "rtl" ? "left" : "right"} />
```

`Sheet` wraps this: its prop is **logical** (`side="start" | "end"`) and it
resolves internally, so consumers never branch.

Radix keyboard navigation needs direction too. Wrap the tree once in
`DirectionProvider` — without it, arrow keys in `Tabs`, `Select` and
`DropdownMenu` stay LTR regardless of what is on screen:

```tsx
// src/i18n/DirectionBridge.tsx
<DirectionProvider dir={dir}>{children}</DirectionProvider>
```

### Layout mirroring

- Flex and grid mirror automatically under `dir` — do not reverse them manually.
- The board view's horizontal scroll mirrors automatically. Do not negate
  `scrollLeft`.
- `Skeleton`'s shimmer sweep **must** be direction-aware, or it runs backwards
  against the reading direction in Arabic.
- Numbers, IDs and decimal strings stay LTR inside RTL text. Wrap bare
  identifiers in `<bdi>` so bidirectional reordering cannot mangle them.

## The toggles

Both live in the global nav's account cluster and on authentication, fence and
tenant action screens. **2026-10-26 (T26):** both accept
`tone?: "surface" | "chrome"`, defaulting to `surface`. Surface controls use
`border-line-control bg-surface-subtle text-foreground-secondary` and semantic
hover colours, so they remain visible on light and dark surfaces. Only
`GlobalNav` passes `tone="chrome"` for the fixed navy header. Both tones keep
the same 36px height, round shape, focus ring and accessible labels.

The three next/font `.variable` classes belong on `<html>` in both `layout.tsx`
and `global-error.tsx`. The `@theme` font aliases resolve on the root where
`--font-ui-latin`, `--font-ui-arabic` and `--font-ui-mono` now exist, then inherit
their computed families. Thus `font-sans` resolves to Jakarta + Cairo,
`font-arabic` to Cairo and `font-mono` to IBM Plex Mono. A body-only declaration
cannot supply a variable required to compute a root alias. The duplicate
`:root` sans/Arabic bridge is removed; the `@theme` block remains the source.

Primary, avatar and logo gradients now use contrast-safe stops in both themes
(see the [gradient contract](specs/crm-leads-v3.md#gradients-root--dark-vars-plus-utility)).
White text is checked against every stop at 4.5:1. Header contrast claims use
the fixed navy stops, including composited hairline and hover surfaces.

**`LanguageToggle`** shows the *target* language in its own script — "English"
while in Arabic, "العربية" while in English — so a user can recognise the
destination even if they cannot read the current language. Never a translated
"switch language".

**`ThemeToggle`** cycles `light → dark → system`, with an icon per state
(`Sun`, `Moon`, `Monitor`) and an `aria-label` naming the state it will move
to. Before mount it renders the `system` icon, matching the default, so it
never visibly flips as the stored value resolves.

## Verification

Before any screen is done:

- [ ] Hard refresh in Arabic + dark — no flash, no wrong-direction frame
- [ ] Hard refresh in English + light — same
- [ ] Toggle language — layout mirrors, no reload, no flash
- [ ] Toggle theme — no flash, no layout shift
- [ ] `system` follows an OS theme change live
- [ ] `pnpm design:rtl` passes at 0
- [ ] Dropdowns and popovers open on the correct side in both directions
- [ ] Arrow-key navigation works in `Tabs`/`Select` in both directions
- [ ] Private window with blocked storage still loads at the defaults
