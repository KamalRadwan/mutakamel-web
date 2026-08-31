# Theming & Direction

Status: **Specification**

Written: **2026-08-27**

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

Defaults for a first-ever visitor: **Arabic, RTL, system theme, compact
density.** Arabic is a product decision, not a fallback, and so is compact —
see [DECISIONS.md](../build/DECISIONS.md).

### Density is the absence of a value, not a value

The other two axes store a default that means something. Density does not.
`compact` is what `globals.css` already declares (`--ui-scale: 0.9`), so
choosing it **removes** the stored key and **removes** the inline property
rather than writing `0.9` a second time:

| Choice | `localStorage` | `<html style>` |
| --- | --- | --- |
| `compact` | key removed | `--ui-scale` removed |
| `standard` | `"standard"` | `--ui-scale: 1` |
| `comfortable` | `"comfortable"` | `--ui-scale: 1.1` |

One number, one home. A second copy of `0.9` is a number that can drift from
the stylesheet, and no gate would catch the drift — which is close to how the
first `--ui-scale` implementation shipped **inverted** with every gate green.

Only the geometry tokens multiply by it. **Type does not**, and neither does
radius: the 13 px Latin / 14 px Arabic floor is absolute, and radius is a shape
constant. Comfortable makes rows taller, not letters bigger.

## No flash — the mechanism

Both axes must be correct in the **first painted frame**. Since neither can be
resolved on the server without a cookie, and this app does not use one, an
inline `beforeInteractive` script writes the DOM before React hydrates.

```tsx
// src/app/layout.tsx
import Script from "next/script";

const BOOTSTRAP = `(function(){try{
  var d=document.documentElement;
  var l=localStorage.getItem("tenant_lang")==="en"?"en":"ar";
  d.lang=l; d.dir=l==="ar"?"rtl":"ltr";
  var t=localStorage.getItem("tenant_theme");
  var dark=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);
  d.classList.toggle("dark",dark);
}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {BOOTSTRAP}
        </Script>
      </head>
      <body className={`${readex.variable} ${dmMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

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
[tokens.md](tokens.md#semantic-tokens). Rules:

- **Never** define a color only inside `.dark`. A token whose sole definition
  sits in the dark block renders as nothing in light mode.
- `body` sets an explicit `background` from `--background`. A transparent body
  borrows whatever is behind it.
- The brand fill uses **different ramp steps per theme** (`brand-600` light,
  `brand-400` dark) because one step cannot clear contrast on both grounds.
- Elevation is a **shadow** in light and an **inset hairline** in dark. Do not
  reuse the light shadow at higher opacity.
- The sidebar is light in light mode. A permanently dark chrome around a light
  body is banned — see [anti-patterns.md](anti-patterns.md).

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

Both live in the topbar.

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
