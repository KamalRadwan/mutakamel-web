# Shell & Navigation

Status: **Implemented**

Written: **2026-08-27**

Rewritten for the two-bar shell: **2026-09-06**

Implementation: `src/design-system/shell/`

## What is replaced

A **240px sidebar beside a 48px topbar**, shipped 2026-08-28. It worked, and
this page's previous revision is the record of why it was built that way. Three
things sent it away:

1. **Horizontal space is the scarce one.** The target machine is 1366×768. The
   sidebar took 240 of those 1366 pixels on every screen, permanently, to show a
   list the user reads for about a second after each navigation.
2. **It could not show a tenant's logo.** The head of the sidebar was reserved
   for one and never rendered it, so white-labelling reached the login screen
   and stopped.
3. **A screen's actions and its heading were stacked above its data.** Every
   list screen spent a header row and a toolbar row before the first record.

The replacement is two full-width bars. It costs 42px of height and returns
240px of width, and the toolbar rows fold into the second bar rather than
sitting above the table.

Deleted with it: `Sidebar.tsx`, `MobileNav.tsx`, `Topbar.tsx`, `useSidebar.ts`,
the `tenant_sidebar` cookie and the `Ctrl`/`Cmd`+`B` collapse binding. Two
full-width bars have no collapsed state to remember.

## AppShell

```text
┌ GlobalNav      45px ─ brand 250px │ app ▾ │ section ▾ … ⟵⟶ 🌐 ☀ 🔔 │ 👤 ┐
├ PageActionBar  45px ─ CRM › Leads          ⟵⟶ [+ Add lead] [search] [▤▦▥] ┤
│ main                                                                      │
└───────────────────────────────────────────────────────────────────────────┘
```

```tsx
// src/app/(tenant)/layout.tsx
<TenantPortalRuntime>
  <RouteTitle />
  <AppShell initialApp={initialApp}>{children}</AppShell>
</TenantPortalRuntime>
```

One height token per bar, and one derived total:

```css
:root {
  --size-topbar:    calc(2.8125rem * var(--ui-scale)); /* 45px — global nav */
  --size-actionbar: calc(2.8125rem * var(--ui-scale)); /* 45px — action bar */
  --size-brand:     calc(15.625rem * var(--ui-scale)); /* 250px — brand zone */
  --size-chrome:    calc(var(--size-topbar) + var(--size-actionbar)); /* 90px */
}
```

Nothing hard-codes a shell dimension. `--size-chrome` exists for the one thing
that needs it: an element positioned against the chrome from **outside** the
shell's flex column, of which there is exactly one — the suspended-tenant banner
in `TenantHostStateBoundary`, which used to carry a hand-fitted `top-16`.

**Both bars are the same height on purpose.** They read as one 90px chrome block
split by a rule, not as a header with a subordinate strip under it. 45px is the
smallest height that clears a 32px control with a 6.5px optical margin, and 32px
is what the action bar's primary button and the branch selects beside it are.

### The height chain is load-bearing

`h-dvh` on the shell root, `shrink-0` on both bars, `flex-1` on `<main>`. Every
board and every `h-full` view inside one resolves its height through that chain
and collapses to nothing if `<main>` stops being a flex item with a definite
height. `dvh`, not `vh`, so mobile browser chrome does not clip the board.

`<main>` is also its own scroll container, which is why nothing carries a
scroll-margin for the chrome: an in-page anchor scrolls **inside** `<main>` and
never under the bars.

**The content inset is 20px at the top** and 16px / 24px (`md`) on the other
three sides — `p-4 pt-5 md:p-6 md:pt-5`. The top is the odd one out on purpose:
the bar directly above already names the screen, so what is left between them is
spacing and nothing else, and the 24px inherited from the sidebar era read as a
gap where a page title used to sit.

## GlobalNav — 45px

| Zone | Width | Contents |
| --- | --- | --- |
| Brand | `--size-brand`, fixed | Tenant logo + name, linking `/` |
| App | auto | Menu trigger (below `xl`), `AppSwitcher` |
| Sections | fills | One `NavMenu` per section of the active app (from `xl`) |
| Account | `ms-auto` | `LanguageToggle` · `ThemeToggle` · `NotificationsDropdown` · `Separator` · `UserMenu` |

The brand zone is a **fixed** width rather than `w-auto`, so the first menu
starts at the same x on every screen and for every tenant. A brand block that
resized with the tenant's name would move a position the user learns once and
then relies on.

The account cluster keeps the order it had in the topbar. WCAG's
consistent-help expects the same controls in the same order on every route, and
moving them would have restarted that habit for nothing.

### Sections are menus, not links

The three apps carry **30, 11 and 30 items**. A horizontal bar holds about six
labels beside the brand zone, the app switcher and the account cluster, so the
only structure that fits is one trigger per section — the grouping the sidebar
already had, rotated ninety degrees.

`NavSection.menuLabelKey` is the short label the trigger renders, and it is a
**separate, required field** from `labelKey`. The two answer different
questions: a heading is read once, in a column, with its items already visible
underneath — "Dashboard Builder & Widgets" is fine there and unusable as one of
five triggers competing for a 1366px bar. Two of the old headings were also
simply wrong, and only survived because nobody reads a grey 10px heading
closely: the inventory section was labelled "Fulfilment nodes" while holding
seven screens of which nodes is one, and the account section had no label at
all.

**A section filtered down to one item renders as a plain link.** Permission
filtering does that routinely, and a menu whose only job is to reveal one item
costs a click to say what it could have said outright.

**Active state is a 2px logical bar along the bottom edge** plus weight 500 —
the horizontal equivalent of the sidebar's inset-start bar. Not a filled chip;
see [anti-patterns.md](anti-patterns.md). The marker stays on while any route in
the section is open, so the bar answers "where am I" at the section level with
every menu closed. The item level is answered by the bar below it.

### The menus appear at `xl`, not `lg`

The fixed costs are the brand zone, the switcher and the account cluster —
roughly 570px before a section is drawn. Trade's six triggers need about 600px.
At 1280px that fits; at 1024px it does not, and the honest options there are a
clipped row, a horizontal scrollbar inside a 45px bar, or the sheet.

Below `xl` the menu trigger opens `NavSheet`: an inline-start `Sheet` listing
every section with its **descriptive** heading and every item under it. That is
where the sidebar's one real advantage — the whole tree at once — survives. It
closes on a route change so a tapped item does not leave the sheet standing over
the screen it opened.

This is also what the old shell did at the same width, where `lg`–`xl` defaulted
the sidebar to its icon rail.

## PageActionBar — 45px

Two jobs, and the first is the one that is easy to miss.

### It says where you are

The sidebar answered that continuously, by marking one row in a permanently
visible column. A row of menus cannot — the items are behind a trigger. So the
answer moves to the start of this bar: the section, then the screen, both
derived from `nav-config.ts` by `usePathname()` (`useNavLocation.ts`).

Without it the shell would have traded a permanent location indicator for none,
which is the one real thing a horizontal nav costs.

Matching is **longest prefix wins, at a path boundary**. Both halves matter:
`/core/settings` and `/core/settings/currencies` are both nav items and both
prefix the currencies route, so a first-match scan labels every settings screen
"All settings"; and `/crm/leads` must not claim `/crm/lead-stages`.

It is plain text, not a `<nav>` — the sections have no index route, so there is
nothing to link, and a second navigation landmark would only add noise to the
one above it.

### It holds the screen's controls

Three regions, in render order: **`actions` · `search` · `view`**. `view` sits
at the inline end because it is the only control that changes how the screen is
drawn rather than what it holds, so a fixed edge keeps it still as a screen
gains or loses actions.

Screens fill them with `<PageActions slot="…">`, which **portals** the DOM into
the bar while the control stays mounted inside the page that declared it:

```tsx
<PageActions slot="view">
  <ViewSwitcher value={view} onChange={setView} … />
</PageActions>
```

A portal, not shell state, because a page's actions are not static markup —
"Add lead" needs the screen's `openCreate`, its capability check and its pending
flag, and the search box owns a debounce. Lifting those into the shell would
mean hoisting each screen's hooks into it, or re-rendering the whole shell on
every keystroke.

Most screens never call `PageActions` themselves:

| What moves | Who moves it | Screens |
| --- | --- | --- |
| `primaryAction` + `secondaryActions` | `PageHeader` | 78 |
| Search box + `Filters` popover | `FilterBar` | 47 |
| The basic search row | The three CRM search bars | 3 |
| `ViewSwitcher` | The screen, `slot="view"` | 5 |

Doing it inside `PageHeader` is what moved every screen's actions into the bar
without editing any of them, and it keeps the one-filled-action rule structural:
the bar has no `primary` of its own to reach for.

Outside the shell — the `(fence)` screens, `/login`, a component test —
`PageActions` renders its children **in place**. A `PageHeader` there must still
show its actions rather than dropping them silently.

**What does not move.** The `<h1>` stays on the page: it is the document's
outline, and on a detail screen it names the record, which is a different
sentence from the nav location. `FilterBar`'s chips stay on the page — they wrap
onto a second line by design and describe applied state rather than asking a
question. The advanced search cards stay for the same reason: a card that grows
to several rows of conditions has nowhere to go in a 45px bar. `TradeScopeBar`'s
three selects stay, as they already do on the other nine Trade screens.

Two bespoke filter surfaces also stay, and deliberately: `AuditFilterPanel` is a
205-line panel, and `TradeDocumentFilters` is a `Field` — a **stacked label over
a select**, which is 52px before it starts. Moving either would mean either
dropping its visible label or wrapping a single select in a popover, and both
are worse than a control sitting directly above the table it filters. They are
the boundary of what folded into the bar, not an oversight.

**The bar renders on every route**, including one that registers nothing. A bar
that vanished on some screens would move the page 45px on those routes, and
every navigation between the two kinds would shift content under the pointer.

### Filters are one shape at every width now

`FilterBar` used to render its filter controls inline from `lg` up and collapse
them into a popover below it. In a row it owned, that was free. In a bar shared
with the screen's actions and its view switcher it made the toolbar a different
width on every screen and every viewport, so the popover is now the only shape.
It also gives the filters a 288px column instead of a squeezed row.

## Skip link — the first focusable element in the app

`AppShell` renders a visually-hidden **"Skip to content"** link as its very
first focusable child, targeting `<main id="main" tabIndex={-1}>`. It becomes
visible on focus — styled like an `outline` button, pinned to the inline-start
of the global nav.

Without it, a keyboard user tabs the brand, the switcher and up to six menus
**on every single page load** before reaching anything on the page they asked
for. That is the difference between a keyboard user being able to work in this
app and merely being able to reach it.

`tabIndex={-1}` on the target is not decoration: without it the browser scrolls
to `<main>` but leaves focus at the top of the document, and the next Tab lands
back in the nav.

The link text comes from the dictionary like everything else.

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

## Brand zone

The tenant's logo and name come from `GET /api/tenant/core/v1/branding/public`,
which is `@Public()` and resolves from the request host. `BrandingProvider`
(`src/context/BrandingContext.tsx`) runs that fetch once in the **root** layout,
writes the colour tokens as `TenantBrandingTokens` did before it, and now also
hands `appName` and `logoUrl` to the shell rather than discarding them.

`logoUrl` is a same-origin **path**, compared against the exact constant Core
emits — `parsePublicBranding` rejects anything else, so a compromised upstream
cannot point the `<img>` at another host. An unbranded tenant gets the product
wordmark; a failed branding request is never surfaced, because branding is
decoration over a complete design system.

## Navigation map

`nav-config.ts` is the single source of truth; `useNavTree.ts` filters it
against the authenticated permission set, and `useNavApps.ts` cuts that result
by app. **Only routes that are server-backed appear.**

The map itself is unchanged by this rewrite — 15 sections across three apps,
each section owned by exactly one app (asserted in `nav-config.test.ts`). What
changed is that every section now also declares a short `menuLabelKey`.

Permission pairs use **ALL** semantics unless a row says ANY. "Scoped" means the
base permission or any of `.own` / `.team` / `.all` satisfies it — the
`canAccess*Route` logic in `lib/navigation/tenant-routes.ts` carries over
unchanged.

`route-title.ts` derives every page's `<title>` from this same map, which is the
other reason it survives untouched.

## Sub-navigation

CRM setup's five screens, Core settings' six, and eight other groups share
`SubNav` — a horizontal second-level nav with an active underline driven by
`usePathname()`, rendered in the page body under `PageHeader`.

**It did not fold into either bar.** The global nav's section menu answers "what
else is in this section" one click away; `SubNav` answers it without the click,
in the body, beside the screen it belongs to — which is what someone comparing
four tax tables actually wants. It filters against the same `hasAccess`
predicate `useNavTree` applies, so the nav cannot hide a screen this bar still
links to.

## Command palette

`Ctrl`/`Cmd`+`K` opens `NavCommandPalette`, which consumes the **unscoped**
`useNavTree()`. It searches every screen the actor may open, in every app —
which matters more now than it did: the global nav shows one app's sections at a
time, and the palette is the one surface that reaches all fifteen.

## Unavailable boundary

`src/proxy.ts` redirects any non-allowlisted `/crm/*`, `/trade/*` or `/core/*`
path to `/unavailable`. `appForPath` reuses those same allowlists rather than
testing path prefixes, so `/crm/not-a-real-screen` resolves to no app and the
stored preference stands, instead of a prefix test answering "crm" for a route
that is about to be redirected.

## Responsive

| Breakpoint | Shell |
| --- | --- |
| `< xl` (1280px) | Section menus hidden; the menu trigger opens `NavSheet` |
| `≥ xl` | Section menus inline in the global nav |

Both bars, the brand zone, the app switcher and the account cluster are present
at every width. Only the section row moves.

The target machine is 1366×768. At that width the full menu row renders, and the
content area is the whole 1366 rather than 1126 — which is the point of the
change.

## Checklist

- [x] One height token per bar; no hard-coded shell heights anywhere
- [x] `--size-chrome` derived, never a second literal
- [x] Active nav is a 2px edge bar, not a filled chip
- [x] No hue-coded nav icons
- [x] Chrome is light in light mode (`bg-card`)
- [x] Mirrors correctly under RTL, including the sheet side
- [x] Every nav item gated by real permissions
- [x] Keyboard: skip link first, tab order, visible focus
- [x] The sheet traps focus and closes on route change
- [x] The bar names the current location on every route, including detail routes
