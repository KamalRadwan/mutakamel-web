# Theming & Direction

Status: **[Verified current source — Ocean Navy v3 aligned]**

Last source verification: **2026-10-26**

Owner: **Admin Portal**

Source: `src/app/layout.tsx`, `src/app/global-error.tsx`, `src/app/globals.css`,
`src/app/fonts.ts`, `src/app/(shell)/layout.tsx`, `src/i18n/I18nContext.tsx`,
`src/i18n/DirectionBridge.tsx`, `src/components/layout/hooks/useThemeToggle.ts`,
`src/components/layout/hooks/useLanguageToggle.ts`.

Before the design-system migration, `src/app/layout.tsx` hardcoded
`lang="ar" dir="rtl" className="dark"` and corrected mismatches inside a
`useEffect` after hydration — causing a wrong-direction or wrong-theme flash on
load. Current source closes both direction and theme before first paint.

## What is cookie-resolved, and what isn't

Only **sidebar collapse state** is resolved from a cookie server-side.
`src/app/(shell)/layout.tsx` is an async Server Component:

```ts
const cookieStore = await cookies();
const defaultSidebarCollapsed = cookieStore.get("ds_sidebar")?.value === "collapsed";
```

**Theme and language are not cookie-resolved.** They live in `localStorage` on
the client, with pre-hydration scripts closing the gap before React hydrates
(`PreferencesProvider` subsequently syncs authenticated account preferences).

## Language, direction, and font variables

`src/app/layout.tsx` renders `lang="ar" dir="rtl"` server-side with the v3 font
variables (`${uiLatin.variable} ${uiArabic.variable} ${uiMono.variable}` from
`src/app/fonts.ts`; `src/app/global-error.tsx` attaches the same three variables
for crash-screen parity) and injects a `beforeInteractive` `<Script>`:

```js
(function(){
  try {
    var l = window.localStorage.getItem("app_lang") === "en" ? "en" : "ar";
    document.documentElement.lang = l;
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  } catch (e) {}
})();
```

`I18nContext`'s `I18nProvider` reads the same `localStorage["app_lang"]` key via
`useSyncExternalStore`, so its first client render agrees with the DOM written
by the bootstrap script — zero hydration mismatch and zero post-hydration flash.
Because `document.documentElement.lang` is set before paint, the CSS
`html[lang="ar"]` type lift in `src/app/globals.css` (+1px and raised
line-heights for Cairo across `micro`…`column-title` and `xs`…`base`) applies
from frame 1 without component branching.

`DirectionBridge` (`src/i18n/DirectionBridge.tsx`) feeds `useI18n()`'s resolved
`dir` into Radix's `DirectionProvider` so `Tabs`, `Select`, and `DropdownMenu`
keyboard navigation mirrors automatically in RTL.

`useLanguageToggle()` displays the *target* language in its own script
(`"Switch to English"` while in Arabic, `"التحويل للغة العربية"` while in
English) so operators can always recognize the destination script.

## Theme (`next-themes` + Ocean Navy v3)

`next-themes`' `ThemeProvider` wraps the tree with `attribute="class"`,
`defaultTheme="dark"`, `enableSystem={false}`, `disableTransitionOnChange`,
matching `@custom-variant dark (&:where(.dark, .dark *));` in `globals.css`.
`useThemeToggle()` falls back to `isDark = true` before mount so the toggle icon
matches `defaultTheme="dark"` without flashing.

### Both themes are designed, not inverted (`2026-10-26`)

Every semantic role and named gradient is declared in `:root` and overridden in
`.dark` (`src/app/globals.css`), so components consume semantic utilities with
**no `dark:` overrides** and **no raw hex/rgb/oklch** in `.tsx` files:

- **Fixed Ocean Navy `Topbar` chrome, theme-adaptive `Sidebar` and workspace.**
  Unlike Tenant Portal's horizontal top nav, Admin Portal uses a `Sidebar` plus
  `Topbar` shell (with no tenant white-label). `Topbar` uses fixed Ocean Navy
  chrome (`bg-gradient-header` across `navy-950 → navy-900 → navy-800` crowned
  by a 3px `bg-gradient-brand-strip`, `--nav-foreground` `#e2e8f0`,
  `--nav-foreground-strong` `#f8fafc`, `--nav-chrome-line`, and `.nav-surface`
  repointing on-bar control tokens) in both light and dark modes. `Sidebar`
  (`bg-surface-column` + `border-line-column`) and the root canvas
  (`bg-gradient-canvas`: `#edf2f8 → #e4ebf5` in light, `#040911 → #060d17` in
  dark; `--background`: `surface-50` in light, `ink-1000` in dark) switch
  cleanly with the active theme.
- **Layered surface and border staircase.** Cards and toolbars sit on `--card` /
  `--surface-toolbar` / `--surface-column-header` (`white` light, `ink-950`
  dark) over `--surface-column` (`#f6f8fc` light, `#070f1a` dark), with
  `--surface-subtle` (`#f8fafc` light, `#111c2b` dark) and calibrated lines
  (`--line-column`, `--line-card`, `--line-control`, `--line-divider`).
- **Action vs. outcome separation without purple chrome.** Cobalt `action`
  (`--primary` = `action-600` light / `action-400` dark) plus sky `accent` and
  teal `aqua` power interactive controls, active navigation
  (`bg-gradient-primary` + `shadow-nav-active`), brand marks
  (`bg-gradient-logo`), and avatars (`bg-gradient-avatar`), while `success`
  (and its `brand` alias) stays reserved for healthy outcomes. Purple, violet,
  indigo, fuchsia, and pink are never used in chrome.
- **Semantic pills adapt from pastel fills to translucent dark tints.** Activity
  (`activity-*`), KPI (`kpi-*`), count (`count-*`), entity (`entity-*`), and
  filter-chip (`chip-active-*`) roles pair soft opaque tints with deep text in
  `:root` and low-alpha `rgb(... / 0.14–0.15)` or `-950` tints with bright
  labels in `.dark`. All text (`≥ 4.5:1`) and non-text (`≥ 3:1`) pairs are
  enforced in `src/design-system/theme-contrast.test.ts`.
- **Elevation switches from drop shadows to inset hairlines.** Document surfaces
  (`pop`, `overlay`, `toolbar`, `column`, `card`) cast soft `rgb(15 23 32)` /
  `rgb(15 23 42)` shadows in light mode and `inset 0 1px 0 0 rgb(255 255 255 / 0.04–0.08)`
  top highlights in dark mode, while `shadow-nav-active` retains its sky glow.

## Logical properties and localization

- **Logical properties only**: use `ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`,
  `text-start`/`text-end`, `border-s`/`border-e`, and `rounded-s-*`/`rounded-e-*`
  (`scripts/design/rtl-guard.mjs` enforces zero physical directional classes).
- **Bilingual completeness**: visible labels, `aria-label`s, titles,
  placeholders, validation, toasts, chart summaries, and dialog close controls
  must be localized in both Arabic and English, and auth screens must expose
  language and theme controls.
- **Bidirectional isolation**: mixed-direction identifiers (emails, URLs, IP
  addresses, phone numbers, UUIDs, `correlationId`s, idempotency keys) render as
  isolated LTR runs inside Arabic content. See
  [Accessibility, responsive behavior, and localization](accessibility-responsive-and-localization.md#numbers-dates-identifiers-and-bidirectionality).

## First-paint proof

Direction/language (`LANG_DIR_BOOTSTRAP`) and theme (`next-themes` inline script)
both execute before React hydration. A first-ever visitor with no stored
preference sees the deliberate Arabic/RTL/dark defaults.
