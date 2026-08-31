# Shell & Navigation

Status: **[Verified shell topology; navigation reachability gaps recorded]**

Last source verification: **2026-08-29**

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
Sidebar (three states) + 48px Topbar + <main>
```

**Visible product change:** the new sidebar is `bg-sidebar` in **both**
themes. Light-mode users get a light sidebar for the first time — the old
navbar was permanently dark for everyone.

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
collapse-flash on load. `Ctrl`/`Cmd`+`B` toggles it. Active state is a 2px
logical inset-start bar plus `font-medium` — not a filled/bordered chip,
which was judged to read as the AI-generated look.

RTL handling: the collapse chevron mirrors and the mobile sheet uses the logical
start side. Future physical popover/flyout props require explicit direction
tests because the static RTL guard cannot infer them.

## Command palette

`⌘`/`Ctrl`+`K` opens `CommandPalette` (`cmdk`-based, wrapped in the design
system `Dialog` with `showCloseButton={false}`), searching the same
`nav-config.ts` entries the sidebar renders.

Current `NAV_SECTIONS` contains top-level destinations rather than a complete
nested route tree. The command palette therefore does **not** currently search
all 54 route destinations described below. Backup, Settings, Provisioning,
detail, and creation routes may exist without being individually searchable.

## The 54-route inventory

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
| 2 | Tenancy | Tenants | `/tenants`, `/tenants/new`, `/tenants/[id]` | `admin.tenants.read` |
| 3 | | Applications | `/applications-catalogue`, `/applications-catalogue/[applicationKey]`, `/applications-catalogue/audit` | ANY of `admin.applications.read`, `admin.applications.create` |
| 4 | | Subscriptions | `/subscriptions` | `admin.subscriptions.read` |
| 5 | | Invoices | `/invoices`, `/invoices/new`, `/invoices/[id]` | `admin.invoices.read` |
| 6 | Infrastructure | Database Servers | `/database-servers`, `/database-servers/new`, `/database-servers/[id]` | ANY of `admin.database_servers.read`, `admin.database_servers.create` |
| 7 | | Storage Servers | `/storage-servers`, `/storage-servers/new`, `/storage-servers/[id]` | ANY of `admin.storage_servers.read`, `admin.storage_servers.create` |
| 8 | | Backup & Restore *(SubNav × 6)* | `/backup`, `/backup/access`, `/backup/policies`, `/backup/runs`, `/backup/artifacts`, `/backup/restores` | `admin.backups.read` |
| 9 | | Provisioning *(SubNav × 9)* | `/provisioning`, `/provisioning/fleet`, `/provisioning/fleet/previews/[previewId]`, `/provisioning/fleet/rollouts/[rolloutId]`, `/provisioning/publisher-keys`, `/provisioning/releases`, `/provisioning/releases/[releaseId]`, `/provisioning/releases/drafts/new`, `/provisioning/releases/drafts/[draftId]` | ANY of `admin.tenants.read`, `admin.provisioning.discovery.read`, `admin.provisioning.rollouts.read`, `admin.provisioning.rollouts.report`, `admin.provisioning.publisher-keys.read`, `admin.provisioning.releases.read` |
| 10 | Governance | Admin staff | `/users`, `/users/[id]` | `admin.users.read` |
| 11 | | Roles | `/roles`, `/roles/[id]` | `admin.roles.read` |
| 12 | | Audit log | `/audit` | `admin.audit.read` |
| 13 | | Reports | `/reports` | `admin.reports.read` |
| 14 | | Logging | `/logging` | `admin.logging.read` |
| 15 | System (pinned) | Settings *(SubNav × 8)* | `/settings`, `/settings/platform`, `/settings/auth`, `/settings/billing`, `/settings/notifications`, `/settings/asterisk`, `/settings/smtp`, `/settings/fatal-alerts`, `/settings/storage` | Public entry; each child settings page gates itself via `SettingsResourceBoundary` (matches pre-migration behavior — no page-level gate on the settings index) |
| — | Topbar | Notifications · Profile | `/notifications`, `/profile` | Authenticated |
| — | `(auth)` route group, no shell | — | `/login`, `/admin/accept-invite`, `/admin/reset-password` | Public |
| — | Root | Redirect | `/` | Public |

**Total:** dashboard (1) + tenants (3) + applications (3) + subscriptions
(1) + invoices (3) + database servers (3) + storage servers (3) + backup (6)
+ provisioning (9) + admin staff (2) + roles (2) + audit (1) + reports (1) +
logging (1) + settings incl. index (9) + notifications/profile (2) + auth
group (3) + root redirect (1) = **54**, matching the route count measured
at the start of this migration. Nothing was dropped.

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
second-level nav with active-state underline via `usePathname()`. Current shared
usage is Backup and Settings. Provisioning has second-level destinations but
does not currently consume this shared `SubNav` implementation.

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
