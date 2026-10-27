# Shell & Navigation

Status: **[Verified shell topology; navigation reachability gaps recorded]**

Last source verification: **2026-10-26**

Ocean Navy v3 shell restyle: **2026-10-26**.

Database migration shell integration source amendment: **2026-10-26**.

Settings navigation permission source verification: **2026-10-26**.
The top-level Settings entry requires `admin.settings.read`. Each of the eight
settings-registry sub-pages requires the same read permission; Worker Messages
keeps its separate `admin.provisioning.publisher-keys.read` gate. The settings
index waits for authentication loading, then redirects to the first permitted
sub-page in navigation order, or `/profile` when none is permitted. A Worker
Messages-only operator can still enter `/settings` directly to reach that page.

Owner: **Admin Portal**

Source: `src/design-system/shell/*`, `src/app/(shell)/layout.tsx`,
`src/app/(auth)/layout.tsx`.

## What replaced the navbar

Before Phase 14, every authenticated route rendered a 15-item horizontal
`Navbar.tsx` — permanently dark (1 `dark:` variant in 394 lines) regardless
of the visiting user's theme preference, with per-item hue-coded icons
(`text-blue-400`, `text-emerald-400`, `text-purple-400`, `text-cyan-400`,
`text-amber-400`, `text-indigo-400`) that were one of the loudest sources of
the app's 14-competing-color-families problem. `Navbar.tsx` and its 28
render sites are deleted; nothing imports it.

`AppShell` (`src/design-system/shell/AppShell.tsx`) is the replacement:

```text
Sidebar (three states) + 48px Ocean Navy Topbar (with 3px brand strip) + <main> (on bg-gradient-canvas)
```

### Ocean Navy v3 shell contract (2026-10-26)

- **`AppShell` canvas:** root wrapper uses `bg-gradient-canvas` in both themes.
- **`Topbar` (`48px` `h-12`, `sticky top-0 z-30`):** fixed Ocean Navy chrome band
  (`bg-gradient-header`, `border-b border-nav-chrome-line`, `text-nav-foreground`,
  `.nav-surface`) crowned at `top-0` by a `3px` `bg-gradient-brand-strip` accent
  strip. Breadcrumb copy uses `text-nav-foreground` with the current page crumb in
  `text-nav-foreground-strong`. Icon triggers in `Topbar` are `36px` circles
  (`size-9 rounded-full`) with `hover:bg-white/10`; topbar user avatars follow the
  `bg-gradient-avatar text-white` contract (no purple or indigo).
- **`Sidebar`:** keeps the light column surface in light mode via
  `bg-surface-column text-foreground` (with its calibrated `.dark` counterpart)
  and neutral `border-e border-line-column` / `border-line-column` dividers. The
  brand logo tile uses `bg-gradient-logo` with a white `ShieldCheck` mark; section
  labels use `text-badge font-bold uppercase text-muted-foreground` (with
  `tracking-normal` in Arabic); inactive links use `text-foreground-secondary`
  with `hover:bg-surface-subtle`; and the active item uses
  `bg-gradient-primary text-white font-semibold shadow-nav-active`.
- **`MobileNav`:** renders `Sidebar` (`variant="mobile"`) inside `Sheet`
  (`side="start"`) on `bg-surface-column` with neutral `border-e border-line-column`.

## Sidebar states

| State | Width | Behavior |
| --- | --- | --- |
| `expanded` | 240px | Full top-level section and item labels |
| `collapsed` | 52px | Top-level icon rail; labels move to `Tooltip` |
| `mobile` (`variant="mobile"`) | full-width sheet | Top-level items rendered inside `MobileNav`'s `Sheet side="start"` |

Current `Sidebar.tsx` does not render inline SubNav children or collapsed
DropdownMenu flyouts. Those behaviors were previously documented but are not
present in source.

Collapse state persists in the `ds_sidebar` cookie, read server-side in
`src/app/(shell)/layout.tsx` (an async Server Component) so there is no
collapse-flash on load. `Ctrl`/`Cmd`+`B` toggles it. Active state uses the v3
action-to-sky gradient pill (`bg-gradient-primary text-white font-semibold shadow-nav-active`),
while inactive items use `text-foreground-secondary` with `hover:bg-surface-subtle`.

RTL handling: the collapse chevron mirrors and the mobile sheet uses the logical
start side. Future physical popover/flyout props require explicit direction
tests because the static RTL guard cannot infer them.

## Command palette

`⌘`/`Ctrl`+`K` opens `CommandPalette` (`cmdk`-based, wrapped in the design
system `Dialog` with `showCloseButton={false}`), searching the same
`nav-config.ts` entries the sidebar renders.

Current `NAV_SECTIONS` contains top-level destinations rather than a complete
nested route tree. The command palette therefore does **not** currently search
all 59 route destinations described below. Backup, Settings, Provisioning,
detail, creation, and tenant placement-move routes may exist without being
individually searchable.

## The 59-route inventory

`nav-config.ts`'s `NAV_SECTIONS` is the current source of truth for top-level
sidebar entries; `useNavTree.ts` filters it against the exact same
`adminCan`/`adminCanAll`/`adminCanAny` permission checks the old
`useNavbar.ts` hook used (the RBAC logic is carried over verbatim — only its
output shape changed, from hook-computed booleans to data a sidebar can
iterate). This table is the proof that every route that existed before this
migration still exists and is reachable after it.

| # | Sidebar section | Item | Routes | Permission |
| --- | --- | --- | --- | --- |
| 1 | Overview | Dashboard | `/dashboard` | `admin.reports.read` |
| 2 | Tenancy | Tenants | `/tenants`, `/tenants/new`, `/tenants/[id]`, `/tenants/[id]/move-database`, `/tenants/[id]/move-storage` | `admin.tenants.read`; the two placement-move routes additionally gate on `admin.tenant_relocations.read` and `admin.storage_migrations.read` respectively |
| 3 | | Applications | `/applications-catalogue`, `/applications-catalogue/[applicationKey]`, `/applications-catalogue/audit` | ANY of `admin.applications.read`, `admin.applications.create` |
| 4 | | Addons | `/addons` | `admin.applications.read` |
| 5 | | Subscriptions | `/subscriptions` | `admin.subscriptions.read` |
| 6 | | Invoices | `/invoices`, `/invoices/new`, `/invoices/[id]` | `admin.invoices.read` |
| 7 | Infrastructure | Database Servers | `/database-servers`, `/database-servers/new`, `/database-servers/[id]` | ANY of `admin.database_servers.read`, `admin.database_servers.create` |
| 8 | | Storage Servers | `/storage-servers`, `/storage-servers/new`, `/storage-servers/[id]` | ANY of `admin.storage_servers.read`, `admin.storage_servers.create` |
| — | | Database Migrations | `/database-migrations`, `/database-migrations/runs/[runId]` | `admin.migrations.read`; mutation controls retain their existing `admin.migrations.manage` / `admin.migrations.critical` gates |
| 9 | | Backup & Restore *(SubNav × 6)* | `/backup`, `/backup/access`, `/backup/policies`, `/backup/runs`, `/backup/artifacts`, `/backup/restores` | `admin.backups.read` |
| 10 | | Provisioning *(SubNav × 9)* | `/provisioning`, `/provisioning/fleet`, `/provisioning/fleet/previews/[previewId]`, `/provisioning/fleet/rollouts/[rolloutId]`, `/provisioning/publisher-keys`, `/provisioning/releases`, `/provisioning/releases/[releaseId]`, `/provisioning/releases/drafts/new`, `/provisioning/releases/drafts/[draftId]` | ANY of `admin.tenants.read`, `admin.provisioning.discovery.read`, `admin.provisioning.rollouts.read`, `admin.provisioning.rollouts.report`, `admin.provisioning.publisher-keys.read`, `admin.provisioning.releases.read` |
| 11 | Governance | Admin staff | `/users`, `/users/[id]` | `admin.users.read` |
| 12 | | Roles | `/roles`, `/roles/[id]` | `admin.roles.read` |
| 13 | | Audit log | `/audit` | `admin.audit.read` |
| 14 | | Reports | `/reports` | `admin.reports.read` |
| 15 | | Logging | `/logging` | `admin.logging.read` |
| 16 | System (pinned) | Settings *(SubNav × 8, plus separately gated Worker Messages)* | `/settings`, `/settings/platform`, `/settings/auth`, `/settings/billing`, `/settings/notifications`, `/settings/webphone`, `/settings/smtp`, `/settings/fatal-alerts`, `/settings/storage`; `/settings/worker-events` has its separate gate | `admin.settings.read`; Worker Messages requires `admin.provisioning.publisher-keys.read`. Child pages retain their resource boundaries. |
| — | Topbar | Notifications · Profile | `/notifications`, `/profile` | Authenticated |
| — | `(auth)` route group, no shell | — | `/login`, `/admin/accept-invite`, `/admin/reset-password` | Public |
| — | Root | Redirect | `/` | Public |

**Total:** dashboard (1) + tenants (5) + applications (3) + addons (1) +
subscriptions (1) + invoices (3) + database servers (3) + storage servers (3)
+ database migrations (2) + backup (6) + provisioning (9) + admin staff (2) +
roles (2) + audit (1) +
reports (1) + logging (1) + settings incl. index (9) + notifications/profile
(2) + auth group (3) + root redirect (1) = **59**. The 54 routes measured at
the start of this migration are all still here; the five additions are the
two tenant placement-move wizards documented in
[Tenant placement moves](../api/tenant-placement-moves.md) and the
cross-application `/addons` index documented in
[Application-owned Addons](../api/application-addons-target.md), plus the two
database migration routes listed above. Nothing was dropped.

## Approved navigation target

One canonical nested route tree will supply:

- expanded and collapsed sidebar navigation;
- mobile navigation;
- breadcrumbs and parent relationships;
- module SubNav items;
- command-palette search and aliases;
- permission requirements and hidden/disabled behavior.

Dynamic detail routes may use resolvers for resource labels, but their parent
and route shape remain represented. Search results must distinguish direct
destinations from actions and must never expose a forbidden route.

The shell also requires:

- a skip link targeting a focusable `<main>`;
- route-change focus on the page heading/main region;
- visible focus for SubNav, menu, search, and sidebar controls;
- focus return when mobile navigation, menus, or command search close;
- a 320–360px topbar that prioritizes menu, page identity, and urgent state;
- explicit overflow for secondary topbar actions;
- safe spacing so the WebPhone cannot obscure focused content.

See
[Accessibility, responsive behavior, and localization](accessibility-responsive-and-localization.md#responsive-task-policy)
and [Operational UX](operational-ux.md#permission-aware-interaction).

## `SubNav`

`SubNav` (`src/design-system/shell/SubNav.tsx`) is a generic horizontal
second-level nav driven by `usePathname()`, rendered on a neutral
`border-b border-line-column` rail with `border-line-control bg-surface-toolbar`
overflow scroll controls, `text-foreground-secondary` (`hover:bg-surface-subtle`)
inactive tabs, and the v3 `bg-gradient-primary text-white font-semibold shadow-nav-active`
active tab pill. Current shared usage is Backup and Settings. Provisioning has
second-level destinations but does not currently consume this shared `SubNav`
implementation.

The target adds a visible overflow affordance at narrow widths and a labelled
compact selector when horizontal scrolling would hide the current location.
Removing the native outline without the shared focus ring is prohibited.

## Layout wiring

`src/app/(shell)/layout.tsx` is an async Server Component: it reads the
`ds_sidebar` cookie via `next/headers` and passes
`defaultSidebarCollapsed` into `AppShell`, so the sidebar renders in its
last-known state on the very first paint rather than flashing open then
collapsing. `src/app/(auth)/layout.tsx` renders `/login` and the two invite/
reset-password routes with no shell at all.

Both database migration pages live under `src/app/(shell)/database-migrations/`,
so the overview and run detail inherit `AppShell` with its sidebar, topbar,
notifications, language, and theme controls. Their public URLs are unchanged.
The Infrastructure entry is visible only with `admin.migrations.read` (or
super-admin access), with English and Arabic labels in `nav-config.ts`. Both
routes keep this entry active. Sidebar, mobile navigation, and command-palette
visibility share the same `useNavTree` permission filter. This is source
integration; typecheck, lint, tests, and authenticated runtime verification
remain lead gates.
