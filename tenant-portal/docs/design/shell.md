# Shell & Navigation

Status: **Specification**

Written: **2026-08-27**

Implementation: `src/design-system/shell/`

## What is replaced

`src/components/layout/Navbar.tsx` — a horizontal app-switcher bar rendered by
every module layout. It carries hue-coded icons (blue, purple, emerald, amber),
`rounded-2xl` dropdowns, `backdrop-blur-md`, `text-[10px]` labels, and three
different hard-coded heights that disagree with each other (`h-[45px]`,
`top-[49px]`, and a consumer reserving `calc(100vh-3.5rem)` = 56px).

It and its four render sites are deleted.

## AppShell

```text
Sidebar (3 states)  +  48px Topbar  +  <main>
```

```tsx
// src/app/(tenant)/layout.tsx
<TenantHostAdmission>
  <Providers>
    <AppShell>{children}</AppShell>
  </Providers>
</TenantHostAdmission>
```

One height token, used everywhere:

```css
:root {
  --size-topbar: 3rem;      /* 48px */
  --size-sidebar: 15rem;    /* 240px expanded */
  --size-sidebar-rail: 3.25rem; /* 52px collapsed */
}
```

Nothing hard-codes a shell dimension again. A view that needs the remaining
height uses `h-[calc(100dvh-var(--size-topbar))]` — `dvh`, not `vh`, so mobile
browser chrome does not clip the board view.

## Sidebar states

| State | Width | Behavior |
| --- | --- | --- |
| `expanded` | 240px | Full labels, sub-items inline |
| `collapsed` | 52px | Icon rail; labels move to `Tooltip`; sub-nav becomes a flyout |
| `mobile` | Full-width `Sheet side="start"` | Below `lg` |

- Collapse persists in the `tenant_sidebar` cookie, read server-side in
  `app/(tenant)/layout.tsx` so there is **no collapse flash** on first paint.
  This is the one thing genuinely resolved server-side; theme and language are
  not — see [theming.md](theming.md).
- `Ctrl`/`Cmd` + `B` toggles.
- Active state is a **2px logical inset-start bar plus weight 500**. Not a
  filled chip, not a colored pill — a filled chip on every active nav item is
  one of the tells in [anti-patterns.md](anti-patterns.md).
- The collapse chevron mirrors under RTL. Flyout `side` is computed
  `dir === "rtl" ? "left" : "right"`.
- The sidebar is `bg-sidebar` — **white in light mode.**

## Skip link — the first focusable element in the app

`AppShell` renders a visually-hidden **"Skip to content"** link as its very
first focusable child, targeting `<main id="main" tabIndex={-1}>`. It becomes
visible on focus — styled like an `outline` button, pinned to the inline-start
of the topbar.

Without it, a keyboard user tabs through the entire sidebar — up to eleven nav
items plus the collapse control — **on every single page load** before reaching
anything on the page they asked for. That is the difference between a keyboard
user being able to work in this app and merely being able to reach it.

The link text comes from the dictionary like everything else.

## Topbar — 48px

Inline start: mobile menu trigger (below `lg`), breadcrumbs.

Inline end, in order: `LanguageToggle` · `ThemeToggle` ·
`NotificationsDropdown` · `Separator` · `UserMenu`.

No search in the topbar. Search belongs to a workspace's `FilterBar`, scoped to
that workspace's data. A global search implies a global index that does not
exist.

### The unread badge has to be announced

The notification count changes on its own, pushed over the realtime connection
— which means for a screen-reader user it currently changes in total silence.

- A **polite** live region announces a **complete phrase** from the dictionary
  — "3 unread notifications" — not a bare number. "3" announced with no context
  is noise.
- **Never move focus** on an update. The count changing is not a reason to
  interrupt what someone is doing.
- Announce the **count**, not each arriving notification. A busy tenant would
  otherwise produce a stream of announcements nobody can follow.
- The badge is not the only signal: the dropdown trigger's `aria-label` carries
  the same count, so it is available on demand rather than only at the moment
  it changes.

Same rule covers the topbar badge and any count rendered in the sidebar.

## Navigation map

`nav-config.ts` is the single source of truth; `useNavTree.ts` filters it
against the authenticated permission set. **Only routes that are server-backed
appear.** The 45 sealed routes are deleted, not hidden.

| Section | Item | Route | Permission |
| --- | --- | --- | --- |
| Workspace | Home | `/` | authenticated |
| CRM | Leads | `/crm/leads` | `crm.leads.read` (scoped) **and** `crm.lead_stages.read` |
| | Customers | `/crm/customer-profiles` | `crm.customer_profiles.read` (scoped) |
| | Pipeline | `/crm/opportunities` | `crm.opportunities.read` (scoped) **and** `crm.pipelines.read` |
| CRM setup | Lead stages | `/crm/lead-stages` | `crm.lead_stages.read` |
| | Acquisition sources | `/crm/acquisition-sources` | `crm.acquisition_sources.read` |
| | Custom fields | `/crm/custom-fields` | `crm.custom_fields.read` |
| | CRM settings | `/crm/settings` | `crm.settings.read` |
| | Reference data | `/crm/static-data-catalogue` | `crm.settings.read` |
| Account | Sign-in sessions | `/core/authentication` | authenticated |
| — | Notifications | topbar dropdown | authenticated |
| — | Profile / sign out | topbar menu | authenticated |
| `(auth)`, no shell | Login | `/login` | public |

**Route rename:** `/crm/pipeline` → `/crm/opportunities`. The screen lists
opportunities; a pipeline is the grouping axis, selected within it. Add a
redirect from the old path.

Permission pairs use **ALL** semantics unless the row says ANY. "Scoped" means
the base permission or any of `.own` / `.team` / `.all` satisfies it — the
existing `canAccessCrmRoute` logic in `lib/navigation/tenant-routes.ts` is
correct and carries over unchanged.

## Sub-navigation

CRM setup's five screens share a `SubNav` — a horizontal second-level nav with
an active underline driven by `usePathname()`. No other module has a real
second level today.

## Command palette

**Not built.** `Ctrl`/`Cmd` + `K` is reserved but unbound. With ~11 routes a
palette adds a dependency and a surface for negative value; revisit past ~25
routes. Do not add `cmdk` speculatively.

## Unavailable boundary

`src/proxy.ts` redirects any non-allowlisted `/crm/*` or `/core/*` path to
`/unavailable`. It stays after the sealed routes are deleted — it is what makes
a bookmarked dead URL land somewhere truthful instead of a 404.

Once the sealed pages are gone the allowlist shrinks to the table above, and
`isSupportedTradePath` is deleted along with the Trade tree.

## Responsive

| Breakpoint | Shell |
| --- | --- |
| `< lg` (1024px) | Sidebar becomes a `Sheet`; topbar shows the menu trigger |
| `lg` – `xl` | Sidebar defaults collapsed |
| `≥ xl` (1280px) | Sidebar defaults expanded |

The target machine is 1366×768. At that width, expanded sidebar (240) + page
gutter (2 × 24) leaves 1078px of content — enough for eight table columns at
comfortable widths. If a table needs more, it scrolls inside its own container.

## Checklist

- [ ] One `--size-topbar` token; no hard-coded shell heights anywhere
- [ ] Sidebar collapse has no first-paint flash
- [ ] Active nav is an inset bar, not a filled chip
- [ ] No hue-coded nav icons
- [ ] Sidebar light in light mode
- [ ] Mirrors correctly under RTL, including flyout side
- [ ] Every nav item gated by real permissions
- [ ] Keyboard: `Cmd/Ctrl+B`, tab order, visible focus
- [ ] Mobile sheet traps focus and closes on route change
