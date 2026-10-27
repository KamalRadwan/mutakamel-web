# Anti-Patterns

Status: **Specification**

Written: **2026-08-27**

Updated: **2026-10-26** — [CRM Leads v3 policy](specs/crm-leads-v3.md).

**Read this before writing any markup.**

The requirement is that this product must not look generated. That is not a
vague aesthetic goal — it is a specific, finite list of tells, most of which
are already present in this codebase and measurable. This page is that list.

## Why this page exists

The current tenant portal was built screen by screen with no shared system.
The historical pre-rebuild measurements (not current gate targets):

| Signal | Count |
| --- | --- |
| Color utilities | 1,992 across **17** families |
| Arbitrary type sizes `text-[Npx]` | 83 |
| `font-bold` / `extrabold` / `black` | 157 (vs 30 normal/medium) |
| `rounded-2xl` / `rounded-3xl` | 39 |
| Gradients | 19 |
| `backdrop-blur` | 14 |
| Hand-rolled `<button>` | 46 |
| Physical RTL utilities | 13 |
| Loaded webfonts | **0** |

Nobody chose any of that. It accumulated one screen at a time, each locally
reasonable. That is exactly how the generated look happens.

## The tells — banned outright

### 1. Oversized corner radius

`rounded-2xl` (16px) and `rounded-3xl` (24px) are the single loudest signal.
The generic scale's markup ceiling is `rounded-lg` (8px) — see
[geometry.md](geometry.md#radius--5-steps). CRM Leads v3 adds the named
`rounded-card` (13px) and `rounded-column` (16px) tokens for those surfaces.

**Lint: error** on `rounded-xl` and above. That includes the 10px
`--radius-xl` token: it exists for parity with the admin portal, and no
component in this portal consumes it.

### 2. Raw or improvised gradients

Gradients are allowed only through the named utilities in the
[v3 token contract](specs/crm-leads-v3.md):
`bg-gradient-header`, `bg-gradient-brand-strip`, `bg-gradient-primary`,
`bg-gradient-avatar`, `bg-gradient-logo`, `bg-gradient-canvas` and
`bg-gradient-chip-active`. Use them for the contract's designated surfaces;
each has a theme-aware token definition.

Raw `bg-linear-*`, `bg-radial-*`, `bg-conic-*`, v3 `bg-gradient-to-*` and
arbitrary gradient images are banned in `src/app/**` and `src/components/**`.
This includes bare radial/conic forms and template literals. Raw gradient
definitions belong in the token layer or design-system implementation.

**Lint: error. Census: raw forms only, feature target 0.** Named gradients do
not spend an occurrence budget.

### 3. Backdrop blur as decoration

Currently 14. Budget: **1** — the modal scrim.

A translucent blurred navbar over scrolling content costs real compositing
performance on the 1366×768 laptops this runs on, and it makes text
legibility depend on what happens to be scrolling behind it.

**Census gate.**

### 4. Arbitrary hue-coded view switchers and pipeline stages

The pre-rebuild leads view switcher tinted its active button **purple, emerald or
amber** depending on which of the three views was selected — three hues, one
view-mode toggle, no meaning.

View switchers, navigation items, and tabs do not each get a random hue, and
**pipeline stages never get a hue** — see [tokens.md](tokens.md#status-mapping).
When structured categories (such as the 7 `ActivityType` tiles or 6
`ActivityTargetType` pills) or segmented status/priority controls use color,
they must consume the calibrated `--swatch-*` and semantic surface palettes from
`src/design-system/lib/swatch-palette.ts` and always pair the hue with an icon
and translated text label — never raw Tailwind palette utilities.

### 5. Everything bold

157 bold-or-heavier sites against 30 normal/medium. A table where every cell is
600 has no hierarchy at all.

Table body cells remain **400**. The allowed weights are **400, 500, 600, 700
and 800**: `font-bold` and `font-extrabold` are permitted for the hierarchy
specified in CRM Leads v3. The old ceiling at 600 is lifted for those weights.

**Lint: error on `font-black` (900)**, in strings and template literals.

### 6. Microscopic type

Arbitrary `text-[10px]`/`text-[11px]` sizes remain banned. Small type uses only
the named v3 steps: `text-micro` (10px, count chips only), `text-badge` (11px),
`text-caption` (12px), `text-label` (12.5px), `text-tab` (13.5px),
`text-card-title` (14px) and `text-column-title` (14.5px), where the owner spec
assigns them. Arabic lift and the density multiplier still apply to every step.

**Lint: error on arbitrary `text-[Npx]`, including fractional pixel values.**
Named steps pass in both strings and template literals. `text-tab` avoids a utility collision with `--color-nav`.

### 7. Shadows on cards

A shadow means "floating above the document" and nothing else. Cards use border
plus background step. `shadow-xl` / `shadow-2xl` do not appear in this system
at all — the only two shadows are `shadow-pop` and `shadow-overlay`.

### 8. Dark chrome that is a costume

**Narrowed on 2026-09-06.** This rule used to read "permanently dark chrome",
and it banned what the product now does: `GlobalNav` carries `--color-chrome`,
a dark brand blue, in light mode. The rule was written against the pre-rebuild
navbar, which was dark because dark navbars look serious — and that is still
banned. What is allowed is a top bar that is dark for reasons that can be
stated:

- **It is the brand, not a mood.** `--color-chrome` is the brand hue at the
  ramp's darkest end, and it moves with a tenant's `primaryColor` exactly as
  the ramp does — `deriveChrome` in `src/lib/branding/brand-ramp.ts`. A dark
  bar that stayed navy while a tenant's product turned green would be the
  costume this rule exists to stop.
- **It is measured, not asserted.** Every pair on the bar is a claim in
  `scripts/design/contrast.mjs` (white 17.5:1, muted text 6.96:1, the active
  marker 9.7:1), and `brand-ramp.test.ts` sweeps all 360 hues to prove white
  stays legible on it for any tenant.
- **It stops at 35px.** `PageActionBar` below it stays `bg-card` and the
  workspace stays `--canvas`. The screen's own primary button never lands on
  the chrome — brand-600 measures 2.61:1 against it — because that button lives
  in the bar that did not change.

A dark bar failing any of those three is the tell again.

### 9. Emoji as UI

No emoji in navigation, section headers, empty states, buttons, or status
labels. Use `lucide-react` icons, which theme and mirror correctly. Emoji
render differently per platform and cannot take a token color.

### 10. Centered everything

Long-form centered text, centered form labels, centered table content. Text
aligns to `start`. Numbers align to `end`. Only genuinely short, genuinely
symmetrical content centers — an empty state's icon and its two lines.

### 11. Accent-colored hover on everything

shadcn's `--accent` means *neutral hover fill*. It stays `ink` here. Wiring a
hover state to brand because "accent sounds like brand" produces the
everything-glows look. Brand-as-accent lives only in `--primary` and `--ring`.

### 12. Hand-rolled interactive elements

46 raw `<button>` elements. Every one is a missing focus ring, a missing
disabled state, a missing loading state, and an inconsistent height.

Use the primitive. If the primitive does not fit, extend the primitive.

### 13. Fake data and fake success

No mock arrays, no `setTimeout` to simulate a request, no optimistic success
toast for a request that was never sent. If a capability is not server-backed,
it renders the unavailable boundary — it does not pretend.

This is why 45 routes are currently sealed.

### 14. Physical direction utilities

`ml-`, `pl-`, `left-`, `text-left` in an Arabic-first RTL app.

**`pnpm design:rtl` fails the build at count > 0.**

### 15. Inline language ternaries

151 of them. See [i18n.md](i18n.md#the-zero-ternary-rule).

**Lint: error.**

## The visual clichés — avoid by choice

Not lint-enforceable, but they are why generated UIs look alike. This system's
existing choices already avoid each one; do not reintroduce them.

| Cliché | What this system does instead |
| --- | --- |
| Purple-to-blue gradient hero | No hero. A CRM opens on data |
| Warm cream `#F4F1EA` + serif + terracotta | Cold-blue `ink` + IBM Plex Sans + cobalt brand |
| Near-black with one acid-green pop | Four roles, none acid |
| Inter / Geist / Space Grotesk / Cairo as the "safe" face | IBM Plex Sans + Plex Sans Arabic, drawn against each other by one team |
| Generic SaaS blue picked off a palette site | Cobalt anchored at `brand-600` `#1d4ed8`, on a cold-blue neutral running hue 232→245 — same family, and every step contrast-measured rather than eyeballed |
| Glassmorphism panels | Border + background step |
| Big rounded stat cards with an accent bar | 44px rows and `StatCard` at `rounded-md` |
| Floating action button | Actions live in `PageHeader` |
| Illustrated empty states | One icon, one line, one action |
| Animated page transitions | See [motion.md](motion.md#the-budget) |

## Density is not an excuse

Reviewers sometimes justify a violation with "it's a dense admin UI". Density
is achieved by:

- 44px rows, 32px controls, tight `gap` values
- A readable workhorse type size, with named small steps only in their specified roles
- Short labels — not smaller labels
- Fewer columns — not narrower columns

And by the **compact** density setting, which is a user's choice to make. Since
the admin-portal token port the shipped default is standard, not compact:
matching the sibling portal's physical size was judged worth roughly three rows
of a 1366×768 screen. Shrinking a component to win those rows back for
everyone is the violation this section exists to refuse.

Density is **never** achieved by inventing smaller type outside the named
steps, removing focus rings, dropping labels to icon-only without tooltips, or
cramming actions into an unlabeled overflow menu.

## Before you commit

- [ ] No `rounded-xl`/`2xl`/`3xl`
- [ ] Gradients use only the seven named utilities in their designated roles
- [ ] No `backdrop-blur` outside the modal scrim
- [ ] No `shadow-lg`/`xl`/`2xl`
- [ ] No arbitrary `text-[Npx]`
- [ ] No `font-black`; weights 700/800 follow the specified hierarchy
- [ ] Small type uses named steps only; `text-micro` is limited to count chips
- [ ] No raw palette utility (`bg-slate-800`) in new code — use tokens
- [ ] No hand-rolled `<button>`/`<input>`/`<select>`/`<table>`
- [ ] No physical direction utility
- [ ] No language ternary around a string
- [ ] No emoji in UI
- [ ] No mock data, no simulated success
- [ ] Reviewed in light **and** dark
- [ ] Reviewed in Arabic **and** English
