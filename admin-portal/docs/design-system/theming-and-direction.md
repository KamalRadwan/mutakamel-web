# Theming & Direction

Status: **[Verified current source; approved light-theme target linked]**

Last source verification: **2026-08-29**

Owner: **Admin Portal**

Source: `src/app/layout.tsx`, `src/app/(shell)/layout.tsx`,
`src/i18n/I18nContext.tsx`, `src/i18n/DirectionBridge.tsx`,
`src/components/layout/hooks/useThemeToggle.ts`,
`src/components/layout/hooks/useLanguageToggle.ts`.

Before this migration, `src/app/layout.tsx` hardcoded
`lang="ar" dir="rtl" className="dark"` and corrected the mismatch in a
`useEffect` after hydration — so any English-preferring or light-theme user
saw one wrong frame on every load. The mechanism below removes the
post-hydration correction for direction/language and keeps a
next-themes-managed flash-prevention path for the theme class, which was
already the more robust choice for that specific problem than reimplementing
it by hand.

## What is actually cookie-resolved, and what isn't

Only **sidebar collapse state** is resolved from a cookie server-side.
`src/app/(shell)/layout.tsx` is an async Server Component:

```ts
const cookieStore = await cookies();
const defaultSidebarCollapsed = cookieStore.get("ds_sidebar")?.value === "collapsed";
```

**Theme and language are not cookie-resolved.** They're read from
`localStorage` on the client, with a `beforeInteractive` inline script in
the root layout closing the gap before React hydrates — this is a
deliberate, different implementation from an earlier draft of this
migration's plan, which called for server-side cookie resolution of theme
and language too. Treat any reference elsewhere to "cookie-resolved
theme/lang" as describing that earlier draft, not current source.

## Language and direction

`src/app/layout.tsx` still renders `lang="ar" dir="rtl"` server-side (the
app's Arabic-first default), but now pairs it with a `beforeInteractive`
`<Script>` that runs before any page code:

```js
(function(){
  try {
    var l = window.localStorage.getItem("app_lang") === "en" ? "en" : "ar";
    document.documentElement.lang = l;
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  } catch (e) {}
})();
```

`I18nContext`'s `I18nProvider` reads the same `localStorage["app_lang"]`
key via `useSyncExternalStore`, so its very first client render already
agrees with what the bootstrap script wrote to the raw DOM — no hydration
mismatch, no post-hydration flash. `useI18n()` returns `{ lang, dir, t,
setLang, toggleLang }`; this shape has not changed across the migration, so
all 100+ call sites work unmodified.

`DirectionBridge` (`src/i18n/DirectionBridge.tsx`) feeds `useI18n()`'s
resolved `dir` into Radix's own `DirectionProvider` — Radix has no way to
read this app's i18n state on its own, and without this bridge, Tabs/Select/
DropdownMenu arrow-key navigation would stay LTR-only regardless of the
visible direction.

`useLanguageToggle()` and `useThemeToggle()` are already fully bilingual —
`useLanguageToggle`'s button deliberately shows the *target* language's own
name (`"Switch to English"` while in Arabic, `"التحويل للغة العربية"` while
in English), not a translated version of "switch language", so a user can
recognize the destination script even if they can't yet read the current one.

## Theme

`next-themes`' `ThemeProvider` wraps the tree with `attribute="class"`,
`defaultTheme="dark"`, `enableSystem={false}`, `disableTransitionOnChange`.
Flash prevention for the dark class is next-themes' own well-tested
mechanism, not custom code — `attribute="class"` matches the app's
`@custom-variant dark (&:where(.dark, .dark *));` in `globals.css`.
`useThemeToggle()` (rewritten in this migration to sit directly on
`next-themes` instead of a hand-rolled `useState` + manual class write)
falls back to `isDark = true` before mount, matching the layout's
`defaultTheme="dark"`, so the toggle's icon never flashes from one state to
another as `next-themes` resolves the real stored value.

### Approved cold-blue target

The light theme adopts the cold-blue surface and action contract in
[Cold-Blue Design Update](design-update.md#target-light-palette). The dark
surface palette keeps its current visual character, but both themes adopt the
same `action` versus `success` semantic split.

This update does not change the first-visit default from dark. Changing the
default theme requires a separate product decision and first-paint verification.

Theme-sensitive components use semantic tokens. Direct `bg-white`, `ink-*`,
or `brand-*` values inside primitives and feature components are migration
targets because they prevent a complete theme change.

Login, invite, and reset screens must expose the same theme and language
controls through a shared auth shell. Inheriting a stored preference without a
way to change it on the primary login screen is not sufficient.

## Localization is more than direction

Correct `dir` wiring does not prove localized content or interaction behavior.
Visible labels, screen-reader-only text, titles, placeholders, validation,
toasts, chart summaries, and dialog close names must all be bilingual.

Mixed-direction identifiers—emails, URLs, IP addresses, phone numbers, UUIDs,
correlation IDs, and idempotency keys—use isolated LTR rendering inside Arabic
content. Number/date/currency formatting uses an explicit application locale
and timezone rather than runtime defaults.

See
[Accessibility, responsive behavior, and localization](accessibility-responsive-and-localization.md#numbers-dates-identifiers-and-bidirectionality).

## First-paint proof

The two things a returning visitor could see wrong on load — direction and
theme — are each closed by a mechanism that runs before React hydrates
(the inline bootstrap script for direction/language, next-themes' own
injected script for theme). A first-ever visitor with no stored preference
sees the deliberate Arabic/RTL/dark defaults, which is a product decision
(this app is Arabic-first per `AGENTS.md`), not a bug.
