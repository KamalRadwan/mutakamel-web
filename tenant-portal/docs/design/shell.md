# Shell & Navigation

Status: **Implemented**

Written: **2026-08-27**

Rewritten for the two-bar shell: **2026-09-06**

Restyled for CRM Leads v3 (Ocean Navy header & floating action bar): **2026-10-26** ([specs/crm-leads-v3.md](specs/crm-leads-v3.md))

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

The replacement is two full-width bars. It costs 22px of height and returns
240px of width, and the toolbar rows fold into the second bar rather than
sitting above the table.

Deleted with it: `Sidebar.tsx`, `MobileNav.tsx`, `Topbar.tsx`, `useSidebar.ts`,
the `tenant_sidebar` cookie and the `Ctrl`/`Cmd`+`B` collapse binding. Two
full-width bars have no collapsed state to remember.

## AppShell

```text
┌ Brand strip     3px ─ bg-gradient-brand-strip                              ┐
├ GlobalNav      58px ─ BrandMark / AppSwitcher │ NavMenu … ⟵⟶ 🌐 ☀ 🔔 👤 ┤
│ PageActionBar  48px ─ ╭─ [+ Add lead]    ⟵⟶ [KPIs] [search] [▤▦▥] ─╮ (floating)
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

Shell height tokens (`src/app/globals.css`):

```css
:root {
  --size-topbar:  calc(3.625rem * var(--ui-scale)); /* 58px — global nav */
  --size-toolbar: calc(3rem * var(--ui-scale));     /* 48px — floating action bar */
  --size-chrome:  calc(var(--size-topbar) + var(--size-actionbar));
}
```

Nothing hard-codes a shell bar height in feature code: `GlobalNav` consumes
`h-(--size-topbar)` and `PageActionBar`'s inner container consumes
`h-(--size-toolbar)`. `--size-chrome` exists for an element positioned against
the chrome from **outside** the shell's flex column — the suspended-tenant
banner in `TenantHostStateBoundary`.

The two bars have distinct visual roles ([specs/crm-leads-v3.md](specs/crm-leads-v3.md)):
`GlobalNav` is a fixed Ocean Navy chrome band (`bg-gradient-header`) crowned by a
`3px` multi-stop brand strip (`bg-gradient-brand-strip`), while `PageActionBar`
floats below it (`px-5 pt-[11px]` outer wrapper) as a `48px` card-like toolbar
(`rounded-xl border border-line-column bg-surface-toolbar px-3.5 shadow-toolbar`)
so the screen's primary CTA, compact KPI badges, search input and view switcher
sit on a crisp elevated surface in both light and dark themes.

### The height chain is load-bearing

`h-dvh` on the shell root, `shrink-0` on the brand strip, `GlobalNav` and
`PageActionBar` outer wrapper, and `flex-1` on `<main>`. Every board and every
`h-full` view inside one resolves its height through that chain and collapses to
nothing if `<main>` stops being a flex item with a definite height. `dvh`, not
`vh`, so mobile browser chrome does not clip the board.

`<main>` is also its own scroll container, which is why nothing carries a
scroll-margin for the chrome: an in-page anchor scrolls **inside** `<main>` and
never under the bars.

**The content inset is 10px on every side, at every width** — `p-2.5`. The bar
directly above already names the screen, so the space between it and the first
control is spacing and nothing else; the 16/24px this inherited from the sidebar
era read as a gap where a page title used to sit, and on the 1366×768 laptop
this is built for it spent 48px of vertical budget on nothing.

## GlobalNav — 58px

Above `<header>`, `GlobalNav` renders a decorative `3px` strip
(`h-[3px] w-full shrink-0 bg-gradient-brand-strip print:hidden`). The `<header>`
itself is `h-(--size-topbar)` (`58px`) with `px-[22px]`, `bg-gradient-header`,
`border-b border-nav-chrome-line`, `text-nav-foreground-strong` and `.nav-surface`
(no `sticky` or `z-*` on `<header>`, preserving the focused skip link's stacking
above the bar).

| Zone | Control / Geometry | Tokens used |
| --- | --- | --- |
| Brand | Mobile `Menu` trigger (`< lg`, `size-9 rounded-lg`) + `BrandMark` (`34×34` `rounded-[10px]` logo tile + tenant name, linking `/`) | `bg-gradient-logo`, `text-white`, `text-nav-foreground-strong` |
| App | `/` divider (`>= sm`) + `AppSwitcher` pill (`h-[34px] px-3 rounded-[9px]`) + vertical `Separator` (`>= lg`, `h-5 border-s`) | `bg-nav-switcher-surface`, `border-nav-switcher-line`, `text-nav-switcher-fg`, `border-nav-chrome-line` |
| Sections | Inline `<nav>` (`>= lg`, `flex-1 gap-1 overflow-x-auto scrollbar-none`): one `NavMenu` per section (`h-9 px-3 gap-2 xl:px-2 xl:gap-1 rounded-lg` with `23×23` `rounded-md` icon box) | Inactive: `text-tab`, `text-nav-foreground`, `bg-white/10` (hover `bg-white/15`, `text-nav-foreground-strong`); Active: `bg-gradient-primary`, `text-white`, `font-semibold`, `border-nav-tab-active-line`, `shadow-nav-active` |
| Account | `ms-auto gap-2 ps-3` — four **separate** controls (no shared wrapper box): `LanguageToggle` (`h-9 rounded-full`), `ThemeToggle` (`size-9 rounded-full`), `NotificationsDropdown` (`size-9 rounded-full` + `size-2` unread dot), `UserMenu` (`h-[38px] rounded-full` + `28×28` avatar) | `border-nav-chrome-line`, `bg-white/8`, `text-nav-foreground`, `text-nav-foreground-strong`, `bg-activity-overdue`, `ring-navy-900`, `bg-gradient-avatar` |

The account cluster keeps the order it had in the topbar (`LanguageToggle` ·
`ThemeToggle` · `NotificationsDropdown` · `UserMenu`). WCAG's consistent-help
expects the same controls in the same order on every route. Each control is an
independent pill or circle button rather than a grouped box, and the `28×28`
user avatar uses `bg-gradient-avatar text-white` (cyan-to-teal chrome gradient —
never `bg-primary` and never purple).

### User menu sign-out — source updated 2026-10-17

Sign-out remains pending until the auth context settles its server-confirmed
logout operation. The menu shows a translated pending label and spinner,
disables repeated selection, and fences activations before the next render.
The account trigger also shows pending activity if the menu is dismissed.
When the operation settles, the menu closes so toast actions are reachable.
Network errors, timeouts and 503 responses produce a persistent, translated
warning that sign-out failed and the session remains active, with a
**Retry sign-out** action. Retry sends a new explicit logout attempt; there is
no automatic retry. Successful logout still delegates session clearing,
navigation and cross-tab synchronization entirely to `AuthContext`.
Regression specs were added; execution remains pending lead verification.

### The bar carries the brand colour

`GlobalNav` is the portal's fixed Ocean Navy chrome band in **both** light and
dark modes: `bg-gradient-header` (`#091526 → #0F2342 → #132C52` via
`--color-navy-950/900/800`) with a subtle bottom hairline
(`border-nav-chrome-line`), crowned by a `3px` `bg-gradient-brand-strip` bar.
Per [specs/crm-leads-v3.md](specs/crm-leads-v3.md) Part 1 #3, the header, brand
strip and user avatar gradient are fixed chrome while active pills
(`bg-gradient-primary`) and logo marks (`bg-gradient-logo`) consume
`--color-brand-*` so white-label tenant hues still recolour interactive accents.
`PageActionBar` below it uses `bg-surface-toolbar` (`#FFFFFF` in light mode and
its calibrated dark counterpart in `.dark`), keeping the screen's primary button
and KPI chips on a surface measured for them.

`.nav-surface` stays on `<header>` so semantic tokens (`--ring`, `--border`,
`--foreground`) resolve to high-contrast on-chrome values for focus rings and
primitives rendered directly on the bar, while Radix dropdown and popover
portals render under `<body>` on the standard `--popover` surface. See
[tokens.md](tokens.md#the-nav-is-the-one-inverted-surface).

### Sections are menus, with promoted record links

The three apps carry **33, 13 and 30 items** (counted 2026-09-24). A horizontal
bar holds about six labels beside the brand zone, the app switcher and the
account cluster, so the only structure that fits is one trigger per section —
the grouping the sidebar already had, rotated ninety degrees.

CRM promotes **Activities**, **Leads**, **Customers** and **Opportunities** from
its Records section into four first-level links at the start of the section
row. These are the app's primary destinations; with the Dashboards and Setup
triggers they make six desktop entries, the same count as Trade's six triggers,
which is the row the `xl` breakpoint below was sized for. The Records trigger is
therefore absent from the desktop GlobalNav; the responsive sheet retains the
full grouping, including the prebuilt CRM Reports link, while PageActionBar
omits the redundant grouping only on an exact route marked `primaryPage` and
restores it on descendant detail routes.

**Activities** leads the row (2026-09-24): it is Core's activity hub filtered to
CRM records, admitted by Core `activities.read` rather than a CRM grant, and it
carries the Core Activities item's glyph, `ListChecks` — one glyph per concept.

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

**Inactive vs active tab styling (updated 2026-10-26).** Inactive tabs render at
`h-9 px-3 gap-2 xl:px-2 xl:gap-1` in `text-tab` (`13.5px`) and high-contrast `text-nav-foreground`
(`#E2E8F0` — never dark or muted slate on the navy header), with the item or
section glyph inside a `23×23` (`size-[23px]`) `rounded-md` soft container
(`bg-white/10`, lightening on hover to `bg-white/15` +
`text-nav-foreground-strong`, with zero hue-coded or purple icon badges). The
active tab or open-route section trigger uses the brand-to-sky pill
(`bg-gradient-primary text-white font-semibold border border-nav-tab-active-line shadow-nav-active`),
and active links keep `aria-current="page"`. The trigger stays marked while any
route in the section is open, so the bar answers "where am I" at the section
level with every menu closed. The item level is answered by the bar below it.

The `text-tab` name avoids a collision with `--color-nav`. The tab row keeps horizontal scrolling with a visually hidden scrollbar; compact spacing at `xl` makes room for the six CRM tabs at 1440px.

### The menus appear at `lg`

Inline section triggers appear from `lg` (`1024px`, `lg:flex` on `<nav>` with
`overflow-x-auto` safety) and expand their inter-tab gap at `xl` (`xl:gap-1.5`).

Below `lg` (`lg:hidden` on the mobile trigger) the menu button opens `NavSheet`:
an inline-start `Sheet` listing every section with its **descriptive** heading
and every item under it. That is where the sidebar's one real advantage — the
whole tree at once — survives. It closes on a route change so a tapped item does
not leave the sheet standing over the screen it opened.

## PageActionBar — 48px floating container

`PageActionBar` renders an outer spacing wrapper
(`shrink-0 px-5 pt-[11px] print:hidden`) around a floating `48px` container
(`flex h-(--size-toolbar) items-center gap-2.5 overflow-x-auto rounded-xl border border-line-column bg-surface-toolbar px-3.5 shadow-toolbar`).
It remains the direct sibling after `<header>`, preserving slot portal order and
keyboard traversal across every tenant app.

Two jobs, and the first is the one that is easy to miss.

### It says where you are

The sidebar answered that continuously, by marking one row in a permanently
visible column. A row of menus cannot — the items are behind a trigger. So the
answer moves to the start of this bar: the section, then the screen, both
derived from `nav-config.ts` by `usePathname()` (`useNavLocation.ts`).

Without it the shell would have traded a permanent location indicator for none,
which is the one real thing a horizontal nav costs.

**Primary destinations are the deliberate exception.** A nav item may mark its
exact route as `primaryPage`. The first-level GlobalNav link already names that
screen, so repeating `Records › Leads` in the bar adds no navigation value. On
that exact route the filled primary action occupies the logical inline start
instead. Prefix-matched detail routes do not inherit the exception: on
`/crm/leads/<id>` the bar still reads `Records › Leads`, and Leads remains the
link back to the list. This also holds when the actor cannot create a lead: the
redundant location stays omitted; the start slot is simply empty.

**The screen half is a link; the section half is not.** A section has no index
route to point at, but a nav item always has one — and on a detail route the
match is a prefix, so standing on `/crm/leads/<id>` the label reads "Leads" and
links to `/crm/leads`. That makes the bar the way back to the list, which is
the trip a reader makes from a record far more often than any other, and it is
why a detail screen no longer needs to draw its own back arrow in the body.

Matching is **longest prefix wins, at a path boundary**. Both halves matter:
`/core/settings` and `/core/settings/currencies` are both nav items and both
prefix the currencies route, so a first-match scan labels every settings screen
"All settings"; and `/crm/leads` must not claim `/crm/lead-stages`.

It is plain text, not a `<nav>` — the sections have no index route, so there is
nothing to link, and a second navigation landmark would only add noise to the
one above it.

### It holds the screen's controls

Five regions: **`primary`** at logical start on a primary destination (or after
`actions` on ordinary screens), **`related`** in the middle, then
**`actions` · `search` · `view`** in a trailing cluster. `view` sits at the
inline end because it is the only control that changes how the screen is drawn
rather than what it holds, so a fixed edge keeps it still as a screen gains or
loses actions.

#### The middle is for other records

`related` is the one region that is not about this screen. It holds links that
LEAVE it — a lead's opportunities, its quotations, its sales orders, its
invoices, each with the number of records behind it — and it is separated from
the trailing cluster for exactly that reason: a control that navigates away
must not sit in the same group as the controls that act on what is in front of
you.

It is `mx-auto` and `empty:hidden`, so it centres in whatever room the location
text and the trailing cluster leave, and disappears entirely on the screens
that register nothing — which is every list screen. `LeadRelatedNav`
(`crm/leads/[id]`) is the first and so far only filler; see
[views.md](views.md#leads) for what it counts and why the opportunities join
differs from the other three.

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
| `primaryAction` → `primary`; `secondaryActions` → `actions` | `PageHeader` | 78 |
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
to several rows of conditions has nowhere to go in a 35px bar. `TradeScopeBar`'s
three selects stay, as they already do on the other nine Trade screens.

Two bespoke filter surfaces also stay, and deliberately: `AuditFilterPanel` is a
205-line panel, and `TradeDocumentFilters` is a `Field` — a **stacked label over
a select**, which is 52px before it starts. Moving either would mean either
dropping its visible label or wrapping a single select in a popover, and both
are worse than a control sitting directly above the table it filters. They are
the boundary of what folded into the bar, not an oversight.

**The bar renders on every route**, including one that registers nothing. A bar
that vanished on some screens would shift the page vertically on those routes,
moving content under the pointer on every navigation between the two kinds.

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

### Notification panel keyboard interaction — source updated 2026-10-17

The bell opens a non-modal popover with a `dialog` role, labelled by the
translated Notifications heading. Opening focuses that heading even while
loading, empty or forbidden, so asynchronous updates do not move focus.
Tab and Shift+Tab use normal browser traversal through enabled Mark all read,
Retry and unread notification buttons; read and pending buttons are disabled.
Notification buttons show an inset focus ring within the scroll viewport.
Escape dismisses the panel and restores focus to the bell. This panel uses
ordinary buttons rather than menu items or menu keyboard navigation.

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
| `< lg` (1024px) | Section menus hidden; the menu trigger opens `NavSheet` |
| `≥ lg` | Section menus inline in `GlobalNav` (`xl` widens inter-tab spacing) |

Both bars, the brand mark, the app switcher and the account controls are present
at every width. Only the section row moves.

The target machine is 1366×768. At that width the full menu row renders, and the
content area is the whole 1366 rather than 1126 — which is the point of the
change.

## Checklist

- [x] One height token per bar (`--size-topbar` 58px, `--size-toolbar` 48px); no hard-coded shell bar heights
- [x] `--size-chrome` derived, never a second literal
- [x] `3px` `bg-gradient-brand-strip` above the `bg-gradient-header` Ocean Navy `<header>`
- [x] Inactive nav tabs use high-contrast `text-nav-foreground` with neutral `bg-white/10` `23×23` icon containers; active tab uses `bg-gradient-primary`, `border-nav-tab-active-line`, `shadow-nav-active` and `aria-current`
- [x] No purple or hue-coded nav icon badges in chrome; user avatar uses `bg-gradient-avatar text-white`
- [x] Floating `PageActionBar` (`bg-surface-toolbar`, `border-line-column`, `shadow-toolbar`) adapts cleanly in light and dark mode while header stays Ocean Navy
- [x] Mirrors correctly under RTL with logical properties only, including `NavSheet` side and `ChevronRight` breadcrumb mirror
- [x] Every nav item gated by real permissions
- [x] Keyboard: skip link first, tab order, visible focus (`focusRing`)
- [x] The sheet traps focus and closes on route change
- [x] The bar names the current location on every non-primary route, including detail routes
