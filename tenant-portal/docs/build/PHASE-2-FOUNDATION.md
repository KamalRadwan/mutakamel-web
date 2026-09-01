# Phase 2 — Foundation

Written: **2026-08-27**

Tokens, fonts, theming and motion. **Zero component changes.** This phase is
mostly one file, and it repaints the whole application.

## 1. Dependencies

```bash
pnpm add tw-animate-css class-variance-authority clsx tailwind-merge
```

## 2. Fonts

Create `src/app/fonts.ts` exactly as specified in
[../design/typography.md](../design/typography.md#pairing-readex-pro--dm-mono),
and apply both `.variable` classNames to `<html>` in `src/app/layout.tsx`.

**Look at the result before continuing.** If Readex Pro's Arabic proves too
wide for a **36px** row at `text-xs`, switch to Zain and record it — see
[OPEN-QUESTIONS.md](OPEN-QUESTIONS.md#q4--font-validation--partially-closed).

## 3. globals.css

Rewrite it in this order. Order matters: `@theme` merges, and the last write
of a given variable wins.

1. `@import "tailwindcss"` then `@import "tw-animate-css"`
2. `@custom-variant dark (&:where(.dark, .dark *))`
3. `@theme inline` — `--font-sans`, `--font-mono`
4. `@theme` — the four ramps ([tokens.md](../design/tokens.md#ramps))
5. `:root` / `.dark` — semantic tokens, control sizes, elevation
6. `@theme inline` — bridge semantics into Tailwind utilities
7. **The theme flip** — remap Tailwind's own families onto the roles
8. Weight remap, type scale, `html[lang="ar"]` lift, radius scale
9. `body` — background, color, `font-synthesis-weight: none`
10. Keyframes: `shimmer`, `pulse-dot`
11. `prefers-reduced-motion` block

### Verify the elevation bridge

The single most likely silent failure in this phase:

```bash
pnpm build
grep -r "shadow-pop" .next/static/css/ | head -1
```

If that returns nothing, `--shadow-pop` was not bridged through `@theme inline`
and **every popover, dropdown, tooltip and dialog renders flat, with no error
anywhere**. This exact bug shipped undetected in the sibling portal across
eleven call sites.

## 4. Theming and direction

Fixes [DEFECTS.md](DEFECTS.md) D3 and D4.

- Bootstrap script in `src/app/layout.tsx` (built as `next/script` with
  `strategy="beforeInteractive"`; now a plain inline `<script>` — `next/script`
  applies no prop but `nonce` to the tag, so it could not carry the
  `suppressHydrationWarning` that CSP nonce hiding makes necessary)
- `suppressHydrationWarning` on the `html` element
- `useLanguage()` built on `useSyncExternalStore` over the same storage key
- `ThemeProvider` reading `tenant_theme`, supporting `system`
- `DirectionBridge` feeding `dir` into Radix `DirectionProvider`

Exact code in [../design/theming.md](../design/theming.md).

## 5. Motion

Fixes D2. `tw-animate-css` imported, `shimmer` and `pulse-dot` keyframes
defined, `prefers-reduced-motion` block present. See
[../design/motion.md](../design/motion.md).

## 6. Shared variants

`src/design-system/lib/cn.ts` and `variants.ts` — `focusRing`, `controlSize`,
`surface`, `hitArea`. Exact source in
[../design/geometry.md](../design/geometry.md).

## Gate

```bash
rm -rf .next && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Then look at the running app in all four combinations:

- [ ] Arabic + light
- [ ] Arabic + dark
- [ ] English + light
- [ ] English + dark
- [ ] Hard refresh in each — no flash, no wrong-direction frame
- [ ] Fonts actually loaded, not a system fallback
- [ ] `shadow-pop` present in the built CSS

Every screen still renders with its old markup, repainted. Nothing is converted
yet — that is the point. If a screen looks *broken* rather than merely
different, the theme flip mapped a color family wrongly.
