# Anti-Patterns

Status: **Specification**

Written: **2026-08-27**

**Read this before writing any markup.**

The requirement is that this product must not look generated. That is not a
vague aesthetic goal — it is a specific, finite list of tells, most of which
are already present in this codebase and measurable. This page is that list.

## Why this page exists

The current tenant portal was built screen by screen with no shared system.
The measured result:

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
The scale stops at 10px, and the ceiling you may actually write in markup is
`rounded-lg` (8px) — see [geometry.md](geometry.md#radius--5-steps).

**Lint: error** on `rounded-xl` and above. That includes the 10px
`--radius-xl` token: it exists for parity with the admin portal, and no
component in this portal consumes it.

### 2. Decorative gradients

Currently 19. Budget: **2** — the brand mark and `Skeleton`'s shimmer.

Specifically banned: gradient buttons, gradient card backgrounds, gradient text
(`bg-clip-text`), gradient borders, and the two blurred colored orbs behind the
login form.

**Census gate.**

### 3. Backdrop blur as decoration

Currently 14. Budget: **1** — the modal scrim.

A translucent blurred navbar over scrolling content costs real compositing
performance on the 1366×768 laptops this runs on, and it makes text
legibility depend on what happens to be scrolling behind it.

**Census gate.**

### 4. Hue-coded controls

The current leads view switcher tints its active button **purple, emerald or
amber** depending on which of the three views is selected. Three hues, one
control, no meaning.

Color encodes *outcome*, never *identity* or *category*. Nav items do not each
get a hue. Tabs do not each get a hue. Stages never get a hue — see
[tokens.md](tokens.md#status-mapping).

### 5. Everything bold

157 bold-or-heavier sites against 30 normal/medium. A table where every cell is
600 has no hierarchy at all.

Table body cells are **400**. Weight is remapped at the token level so
`font-bold` cannot escalate past 600.

**Lint: error.**

### 6. Microscopic type

83 arbitrary `text-[10px]`/`text-[11px]` sizes. The floor is 13px, and Arabic
lifts it to 14px. Density comes from tight spacing and short rows, never from
shrinking text below legibility.

**Lint: error on arbitrary `text-[Npx]`.**

### 7. Shadows on cards

A shadow means "floating above the document" and nothing else. Cards use border
plus background step. `shadow-xl` / `shadow-2xl` do not appear in this system
at all — the only two shadows are `shadow-pop` and `shadow-overlay`.

### 8. Permanently dark chrome

The current navbar is dark regardless of theme. The sidebar in this system is
`bg-sidebar`, which is **`ink-25` in light mode** — the lightest step in the
neutral ramp, a single notch off the page background it sits beside. A dark
chrome wrapped around a light body is a tell.

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
- A 13px workhorse type size — not 10px
- Short labels — not smaller labels
- Fewer columns — not narrower columns

And by the **compact** density setting, which is a user's choice to make. Since
the admin-portal token port the shipped default is standard, not compact:
matching the sibling portal's physical size was judged worth roughly three rows
of a 1366×768 screen. Shrinking a component to win those rows back for
everyone is the violation this section exists to refuse.

Density is **never** achieved by shrinking text below the floor, removing focus
rings, dropping labels to icon-only without tooltips, or cramming actions into
an unlabeled overflow menu.

## Before you commit

- [ ] No `rounded-xl`/`2xl`/`3xl`
- [ ] No gradient outside the 2-item budget
- [ ] No `backdrop-blur` outside the modal scrim
- [ ] No `shadow-lg`/`xl`/`2xl`
- [ ] No arbitrary `text-[Npx]`
- [ ] No `font-bold`/`extrabold`/`black`
- [ ] No raw palette utility (`bg-slate-800`) in new code — use tokens
- [ ] No hand-rolled `<button>`/`<input>`/`<select>`/`<table>`
- [ ] No physical direction utility
- [ ] No language ternary around a string
- [ ] No emoji in UI
- [ ] No mock data, no simulated success
- [ ] Reviewed in light **and** dark
- [ ] Reviewed in Arabic **and** English
