# Admin Portal Frontend Integration Guide

Status: **[Verified]**

Last source verification: **2026-08-25**

Application Catalogue integration reverified: **2026-08-25**.

Database and Storage registration workflows reverified: **2026-08-25**.

Authentication/session subsection reverified: **2026-08-26**.

## Scope

This guide connects the current Admin Portal source to the Core and Worker
Admin Gateway contracts. The Web source has exact reachable calls for all 240
Core Admin routes. That establishes source route parity, not authenticated
runtime success, release readiness, or deployment. A route inventory remains
transport evidence rather than runtime evidence.

Read the [documentation contract](DOCUMENTATION_CONTRACT.md) and
[AI Start Here](ai/START_HERE.md) before changing a server-backed feature.

## Canonical transport

Browser code uses:

```text
/api/admin/core/v1/<relative>
```

Worker backup/restore uses:

```text
/api/admin/worker/v1/<relative>
```

`/admin/*` and `/api/v1/admin/*` are backend/internal paths, not browser URLs.

Use `src/lib/api/axiosClient.ts` so cookie-mode credentials and coordinated
refresh behavior remain consistent. The current client is a foundation, not the
final typed domain API architecture.

## Source verification order

1. Gateway typed route entry.
2. Core/Worker controller and guards.
3. DTOs, response contracts, services, and tests.
4. Current frontend hooks/types/tests.
5. Markdown.
6. Mocks and fixtures only as frontend defect evidence.

See [Source of Truth](ai/SOURCE_OF_TRUTH.md).

## Current frontend routes

| Frontend route | Source status | Primary contract |
| --- | --- | --- |
| `/login` | `DONE`: login/refresh/me/logout and enumeration-safe forgot password are real | [Auth](api/auth.md) |
| `/admin/accept-invite` | `DONE/SOURCE_INTEGRATED`: public fragment-token flow, exact password/DTO validation, cookie-session establishment, and `/me` hydration | [Auth](api/auth.md) |
| `/admin/reset-password` | `DONE/SOURCE_INTEGRATED`: public fragment-token flow, exact password/DTO validation, all-session invalidation, and return to login | [Auth](api/auth.md) |
| `/settings/auth` | `DONE/SOURCE_INTEGRATED`: authentication settings, list/revoke current-account sessions, confirmation-gated logout-all, and permission-gated invalidation-outbox dry-run/apply recovery | [Auth](api/auth.md), [System Settings](api/system-settings.md) |
| `/dashboard` | `DONE/SOURCE_INTEGRATED`: grouped permission-filtered dashboard with 14 report groups and unavailable states | [Dashboard](api/dashboard.md), [Reports](api/reports.md) |
| `/reports` | `DONE/SOURCE_INTEGRATED`: all five standalone report reads with shared filters and independent resource states | [Reports](api/reports.md) |
| `/database-servers` | `DONE/SOURCE_INTEGRATED`: real typed list/filter/pagination, permission-aware soft delete, deleted-only review, and separately permissioned permanent Destroy | [Database Servers](api/database-servers.md) |
| `/database-servers/new` | `DONE/SOURCE_INTEGRATED`: the two-step screen mounts without a list read and treats connectivity testing as optional diagnostics. For an actor with update+critical, one setup submit registers and bootstraps the DRAFT, then activates it with a separate UUIDv7 intent. A no-read actor with initial-bootstrap authority stays in the wizard when bootstrap is not `READY` and retries bootstrap only with its own stable intent; a no-read actor who can activate also stays after a definitive activation failure and retries activation only after resolving the blocker. Ambiguous activation retains the exact activation key. Recovery never lists, recreates, or resends credentials; only no-read actors unable to recover return to `/dashboard` after a partial result | [Database Servers](api/database-servers.md) |
| `/database-servers/[id]` | `DONE/SOURCE_INTEGRATED`: provisioning and Application principals, maintenance-aware rotation, retry/reconciliation, history, and fail-closed activation; an empty Application catalogue is a valid `READY` no-op rather than an activation blocker; Backup remains an aggregate dependency linked to `/backup/access` | [Database Servers](api/database-servers.md) |
| `/backup` | `DONE/SOURCE_INTEGRATED/RELEASE_BLOCKED`: separate protection-chain overview; Worker safe-response DTOs, durable command identity, and browser minimal reload recovery are source-integrated, while package adoption, migrated runtime, and authenticated browser evidence remain release gates | [Backup and Restore](api/backups-restores.md) |
| `/backup/access` | `DONE/SOURCE_INTEGRATED`: Core-backed fixed `mutakamel_backup` status, hour-based rotation policy, secret-free regeneration, and exact-candidate reconciliation | [Backup and Restore](api/backups-restores.md) |
| `/backup/policies` | `DONE/SOURCE_INTEGRATED`: Worker policy and per-database override editor with exact critical permission pairs | [Backup and Restore](api/backups-restores.md) |
| `/backup/runs` | `DONE/SOURCE_INTEGRATED`: bounded Worker run history, manual start, deletion, and ambiguous-outcome reconciliation | [Backup and Restore](api/backups-restores.md) |
| `/backup/artifacts` | `DONE/SOURCE_INTEGRATED`: bounded safe artifact evidence, critical deletion, and restore hand-off without storage-path exposure | [Backup and Restore](api/backups-restores.md) |
| `/backup/restores` | `DONE/SOURCE_INTEGRATED`: isolated restore tests, verification-presence status, and separately confirmed critical promotion | [Backup and Restore](api/backups-restores.md) |
| `/storage-servers` | `DONE/SOURCE_INTEGRATED`: server-backed search/filter/sort/pagination, truthful totals, lifecycle plus fresh-evidence columns, and stable write identities | [Storage Servers](api/storage-servers.md) |
| `/storage-servers/new` | `DONE/SOURCE_INTEGRATED`: one operator setup intent uses write-only Garage/S3 credentials, creates the durable DRAFT, then authoritatively activates it when the actor also has update+critical. Activation is domain-idempotent: an exact retry or concurrent completion against the same configuration revision returns `ACTIVE`, so a lost response does not misreport a completed setup as `DRAFT`. An ambiguous UI retry sends activation only with its exact key and never recreates the server or resends credentials. Create-only actors retain the catalogue-safe DRAFT flow | [Storage Servers](api/storage-servers.md) |
| `/storage-servers/[id]` | `DONE/SOURCE_INTEGRATED`: lifecycle activation is separate from durable manual probe, 24-hour evidence rail and 12-hour Worker cadence are explicit, and maintenance/default/delete gates match Core | [Storage Servers](api/storage-servers.md) |
| `/tenants` | `DONE/SOURCE_INTEGRATED`: server pagination and filters, including an independently loaded authoritative Database Server filter | [Tenants](api/tenants.md) |
| `/tenants/new` | `DONE/PARTIAL/SOURCE_INTEGRATED`: real identity availability is bound to current name/company input; one no-store `GET /tenants/create-options` snapshot under `admin.tenants.create` supplies authoritative Applications/readiness/tiers, provisioning preview, Application-aware Database placement, and explicit bucket-free Storage placement; quote accepts ANY `admin.catalog.read` or `admin.tenants.create`; submit-time wizard locking, live draft fences, minimal status-only ambiguous-outcome recovery, exact create shape, and PROVISIONING redirect are integrated; no tenant DTO or PII is persisted for replay; authenticated runtime evidence remains open | [Tenants](api/tenants.md) |
| `/tenants/[id]` | `DONE/SOURCE_INTEGRATED`: independent profile/lifecycle, exact FQDN list/validation, provisioning, access, subscription/items, wallet/ledger, invoices, and payments resources | [Tenants](api/tenants.md), [Tenant users](api/tenant-users.md), [Operations](api/tenant-operations.md) |
| `/applications-catalogue` | `DONE/SOURCE_INTEGRATED`: read-authorized actors get list/filtering with the closed `databaseDeployment` profile alongside lifecycle and publication. A create-only actor gets a narrow registration-only page that does not mount the Application or commercial-catalogue list reads and sends only the catalogue-DRAFT command. Full atomic onboarding remains restricted to actors holding create+update+critical ALL | [Application Catalogue](api/catalog.md) |
| `/applications-catalogue/[applicationKey]` | `DONE/SOURCE_INTEGRATED`: real detail includes request-ownership fences, release authority, exact technical readiness, deployment profile, and authoritative Database Server fleet coverage (`eligible`, `ready`, `pending`, `degraded`, and percentage), plus manifests, metadata/policy/lifecycle, and commercial controls | [Application Catalogue](api/catalog.md) |
| `/users` | `DONE/PARTIAL`: real user list/invite/lifecycle; error/state hardening remains | [Users](api/users.md) |
| `/users/[id]` | `DONE/SOURCE_INTEGRATED`: real user, roles, and administrative WebPhone controls | [Users](api/users.md) |
| `/profile` | `DONE/SOURCE_INTEGRATED`: exact self-profile read/update with explicit load/save error and retry states | [Users](api/users.md) |
| `/roles` | `DONE/SOURCE_INTEGRATED`: server pagination, exact permissions, validation, and stable mutation intents | [Roles](api/roles-permissions.md) |
| `/roles/[id]` | `DONE/SOURCE_INTEGRATED`: independently loaded role/catalogue, nullable description, and critical permission replacement | [Roles](api/roles-permissions.md) |
| `/settings/*` | `DONE/SOURCE_INTEGRATED`: exact list/by-key, SMTP, Asterisk, fatal-alert, and storage-runtime permission, validation, idempotency, and resource-state behavior | [Settings](api/system-settings.md) |
| `/subscriptions` | `DONE/SOURCE_INTEGRATED`: cross-tenant subscription directory and pagination | [Subscriptions](api/subscriptions.md) |
| `/invoices`, `/invoices/new`, `/invoices/[id]` | `DONE/SOURCE_INTEGRATED`: all seven invoice administration routes | [Invoices](api/invoices.md) |
| `/notifications` | `DONE/SOURCE_INTEGRATED`: inbox, actions, preferences, configuration, device tokens, and navbar unread state | [Notifications](api/notifications.md) |
| `/logging` | `DONE/SOURCE_INTEGRATED`: overrides, effective state, history, and SSE live view | [Logging](api/logging.md) |
| `/audit` | `DONE/SOURCE_INTEGRATED`: list and entity-history immutable evidence | [Control-plane audit](api/control-plane-audit.md) |
| `/provisioning/*` | `DONE/SOURCE_INTEGRATED`: components/discovery, fleet previews and rollouts, publisher keys, release drafts, publication, releases, and retirement | [Provisioning](api/provisioning-governance.md) |

Every current Core Admin method/path has a reachable exact production call.
Payments/reconciliation remain tenant-workspace capabilities rather than a
separate top-level route. Managed currency list, single-rate update, and
transactional batch update remain under `/settings/billing`.

## Application Catalogue release authority

The browser must render three independent states: lifecycle, publication, and
technical readiness. While the Application is `DRAFT`, Core's adoption command
derives and stores `${applicationKey}-app`, `mutakamel_<key>_app`, and
`app.<key>`. The UI may preview that deterministic identity, but it must treat
the command receipt and refetched readiness projection as authoritative and
must never substitute a locally derived value during execution.

The primary registration path is now one atomic, idempotent onboarding command:
`POST /api/admin/core/v1/applications/onboarding`. It requires ALL of
`admin.applications.create`, `admin.applications.update`, and
`admin.applications.critical`, plus one caller-owned UUIDv7 key. Its body adds
the closed `databaseDeployment=NONE|ON_DEMAND|PREWARM|REQUIRED` profile and an
audited reason to the catalogue identity fields. Core creates the DRAFT
catalogue identity, immutable technical profile, database policy, and the
deterministic TENANT primary component in one transaction. `NONE` is currently
invalid for a TENANT Application. An actor holding only
`admin.applications.create` continues to use `POST /applications`; that legacy
fallback creates only the catalogue DRAFT and the browser does not chain
adoption or component-binding requests after it. If that actor lacks
`admin.applications.read`, the `/applications-catalogue` permission boundary
renders a narrow registration-only page before the catalogue hook can mount.
Its mutation-only hook issues no Application-list or commercial-catalogue GET.

`ApplicationView.serverSummary` is real fleet evidence, not a placeholder. It
reports whether fleet rollout applies, the eligible/ready/pending/degraded
counts, and exact coverage percentage. The UI must render this projection and
must not calculate global fleet coverage from a paginated Database Server list.

- List reads support a `publicationStatus=UNPUBLISHED|PUBLISHED` filter and
  `databaseDeployment` filter, and must show publication, lifecycle, and the
  deployment profile separately.
- `POST /api/admin/core/v1/applications/:applicationKey/publish` requires
  `admin.applications.update` plus `admin.applications.critical`, a caller-owned
  UUIDv7 idempotency key, both current revision fences, and a reason.
- Metadata edits invalidate an existing publication and never auto-publish.
- Adoption and primary-component binding are distinct critical UUIDv7 intents;
  each accepts only its current revision fence and reason. An ambiguous or
  in-flight response is reconciled by refetching before a fresh key is issued.
- Activation requires attributable publication plus technical
  `activationAllowed`; new selection uses complete `selectionAllowed`.
- Existing installed runtime may retain a `PUBLISHED` `ACTIVE` or `DEPRECATED`
  Application. Deprecation must not be presented as automatic tenant removal.

Current frontend source adopts these fields and actions. That establishes
source integration only; it is not authenticated runtime, deployment, or
release-readiness proof.

## Database and Backup module boundary

The UI route namespace deliberately separates database infrastructure from
backup operations:

```text
/database-servers  -> connection, TLS, lifecycle, provisioning, Applications
/backup            -> access, policies, runs, artifacts, restores
```

Database Servers owns `mutakamel_provisioner` and per-Application principal
controls. It consumes only Core's aggregate Backup-readiness signal and links
the operator to `/backup/access?databaseServerId=:id` when that dependency
blocks activation. The Backup module's Core adapter owns `mutakamel_backup`
rotation-policy, regenerate, and reconcile calls. Worker operation clients keep
the plural browser APIs `/api/admin/worker/v1/backups/*` and
`/api/admin/worker/v1/restores/*`; `/backups` is not a frontend route.

Database Server deletion has two explicit stages. `DELETE /:id` performs the
recoverable registry soft delete. The list sends `deleted=true` to review only
deleted rows, and `DELETE /:id/destroy` is available only for an authoritative
non-null `deletedAt` projection with `admin.database_servers.delete.hard` plus
`admin.database_servers.critical`.

Database registration does not require a successful connectivity command
first. `POST /database-servers/check-connectivity` is an optional diagnostic
with its own UUIDv7 intent; `POST /database-servers` always repeats the
connection, TLS, PostgreSQL-major, and security-administrator posture checks
authoritatively. The create screen therefore does not fetch the Database Server
list merely to register one server. If no Application currently belongs in the
server's desired binding set, Application bootstrap completes as a `READY`
no-op and does not block activation.

When the actor also has `admin.database_servers.update` plus
`admin.database_servers.critical`, the same setup submit follows a READY create
receipt with `POST /database-servers/:id/activate`. Create and activate own
separate UUIDv7 keys; this is one operator intent, not one atomic backend
transaction. A definitive activation rejection retires only the activation
key and leaves the registered server in `DRAFT`. A read-authorized actor can
recover from detail; a no-read actor with activation authority remains in the
wizard and gets activation-only retry after the reported blocker is resolved.
An in-flight, network, or `5xx` outcome retains the exact server ID and
activation key, disables changes that could imply a new registration, and
exposes activation-only retry with that exact key.

If bootstrap is not `READY`, activation is not attempted. A read-authorized
actor recovers from detail; a no-read actor holding the initial-bootstrap
create+critical authority remains in the wizard and calls only
`credential-bootstrap/retry` under a separate stable UUIDv7 intent. The wizard
has already cleared the write-only security-administrator credential and never
issues another create. A no-read actor without the authority needed for the
remaining command returns to `/dashboard`; successful no-read flows do the
same. None of these paths mounts the Database Server list or resends
credentials.

Storage registration presents one operator setup action while preserving two
durable backend commands. It creates the DRAFT with one UUIDv7 intent and, when
the actor also has update+critical, activates it with a separate UUIDv7 intent;
activation performs the authoritative connection check. A definitive
activation rejection leaves the created DRAFT for review. A network, `5xx`, or
in-flight response retains only the activation intent and exact server ID so a
retry cannot create a duplicate Storage Server. Core also makes activation
domain-idempotent: an exact retry, or a concurrent completion against the same
configuration revision, returns the current `ACTIVE` projection instead of a
false DRAFT/state-conflict result. The ambiguous UI path therefore retries
activation only with the same key. Manual `probe` remains a separate
post-registration diagnostic and is not a prerequisite for create or activate.

## Reconciled tenant contracts

The tenant workspace now uses the exact current contracts:

| Capability | Current behavior |
| --- | --- |
| FQDN directory | Calls exact `GET /tenants/:id/fqdns` and reconciles mutations by refresh |
| Tenant-user lifecycle | Uses `POST` for suspend, activate, and restore |
| Add/set-primary FQDN | Sends `{ fqdn }` and uses the exact `POST` commands |
| Subscription items/cancel | Calls exact items read and `/subscriptions/:tenantId/cancel` |
| Wallet adjustment/ledger | Uses server preview/confirm and exact wallet-ID ledger |
| Access catalogues | Loads role, branch, department, and team resources independently |

Tenant creation has no hardcoded Database Server, Application, tier, or country
shortlist. The no-store create-options snapshot supplies the mutually
consistent candidate set and provisioning preview; quote authorization accepts
ANY `admin.catalog.read` or `admin.tenants.create`. Identity validation,
coordinate reverse geocoding, canonical country/calling-code/timezone mapping,
and save-boundary validation use the current source contracts.

## Shared HTTP contract

Core success:

```ts
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  correlationId: string;
  timestamp: string;
}
```

Use `data` for rows and `meta.total` for pagination. A successful `DELETE 204`
has no body.

Normalize Core `errorCode` and Gateway `code` into one error while preserving
field errors and `correlationId`. See
[HTTP and Error Contract](architecture/http-and-error-contract.md).

## Authentication

- Use HttpOnly cookie auth.
- Send `credentials: "include"`. The server infers the browser channel; do not
  send a caller-selected authentication-mode header.
- Store only non-secret session timing/epoch metadata and the remember-session
  preference. Every cold or newly opened tab must establish auth from
  `/auth/me`; browser storage is not proof of authentication.
- Treat remember-session as a login-only cookie-persistence preference. Core's
  stored Auth Session value remains authoritative on refresh and never changes
  the server idle or absolute deadline.
- Coordinate one refresh across callers and retry a protected request once.
- Reuse the server-managed session credential for normal refreshes. Never
  rotate/delete it because another tab refreshed or RBAC/profile changed.
- Bind any replay to the same server `sid`. A different-session login in
  another tab fails the old request closed.
- Unsafe calls without a verified caller-owned UUIDv7 (or an explicitly
  documented naturally idempotent contract) repair authentication but are not
  automatically replayed.
- Emit the activity marker only for trusted pointer, keyboard, or touch input
  in a visible tab. Checkpoint direct input immediately, coalesce successful
  touches for one minute, and retry failed best-effort activity no faster than
  five seconds. Core requests also carry recent input evidence; Worker requests
  wait for the same five-second-bounded Core activity checkpoint. Polling,
  access refresh, focus/visibility, synthetic events, hidden tabs, and WSS do
  not claim human activity; employee WSS-duration accounting is independent.
- While an authenticated tab remains visible, call the dedicated, CSRF-bound
  `/auth/presence` contract on an adaptive cadence without the human-activity
  marker. Seed from the current remaining session timing, cap the normal delay
  at five minutes, never clamp a short positive remainder past its deadline,
  and adopt only a same-session server response. Presence must not overwrite
  the metadata timestamp that anchors access expiry. Use bounded exponential
  retry while preserving any earlier retry across refresh timing updates.
  Focus/page-show/online or visibility recovery checks immediately. Hidden and
  closed tabs do no ongoing presence work, and stop scheduling when the idle
  deadline reaches Core's absolute deadline.
- Backup start, restore start, and restore promotion participate in the single
  coordinated refresh retry with their original UUIDv7 key and exact body;
  Worker returns the accepted run instead of dispatching a duplicate effect.
- Only explicit terminal session/security `401` codes clear the session.
  Permission/CSRF `403`, rate limits, network failures, and `5xx` retain it.
- Logout clears local state and notifies sibling tabs only after durable server
  success (or a terminal session code); transient failure reports that the
  user remains signed in.
- Accept-invite and reset-password consume their one-time token from the URL
  fragment, immediately remove it from browser history, validate Core's exact
  12–128 character strong-password policy, and never persist or automatically
  replay the token-bearing write.
- Logout-all is confirmation-gated under Authentication settings, refreshes
  session ownership through the shared coordinator, sends no request body or
  Gateway idempotency key, and clears local state only after durable success or
  an explicit terminal session result.
- Authentication-invalidation recovery is permission-gated under Authentication
  settings. It accepts one exact Control Plane or Tenant target, 1-25 explicit
  UUIDv7 event IDs, and an audited reason; requires an unchanged successful
  `DRY_RUN` before `APPLY`; and owns a fresh UUIDv7 idempotency key for each
  changed intent. Gateway transport retry is disabled. Only an explicit
  operator action may retry an ambiguous outcome with the identical body/key.
- Never treat isolated unauthenticated `/auth/me` as failed-login evidence.

## Permissions

Permission lists use ALL semantics unless Gateway explicitly declares ANY.
FQDN validation is the current explicit ANY route. The frontend needs
`adminCan`, `adminCanAll`, `adminCanAny`, and a ONE/ALL/ANY requirement
component.

The `/backup` shell requires `admin.backups.read`. Backup policy and database
override mutations require `admin.backups.manage` plus
`admin.backups.critical`; manual backup start requires only
`admin.backups.manage`; run/artifact deletion requires `admin.backups.delete`
plus `admin.backups.critical`; restore start and promotion require
`admin.backups.restore` plus `admin.backups.critical`. Backup database-access
reads require `admin.database_servers.read`; its rotation-policy mutation
requires `admin.database_servers.update` plus
`admin.database_servers.critical`, while regenerate/reconcile require
`admin.database_servers.credentials.rotate` plus
`admin.database_servers.critical`.

Nested tenant permissions are independent. `admin.tenants.read` does not grant
tenant-user, subscription, invoice, wallet, payment, audit, or provisioning
access. A `403` renders forbidden, not empty.

## Idempotency

Write-sensitive commands use UUIDv7 keys. One exact user intent owns one key
through pending and exact retry. The settled-tree AST policy scan found 151
production Axios write calls and no bare/implicit-policy call. Idempotent calls
retain caller-owned intent keys; Gateway non-idempotent calls explicitly opt
out and are marked non-replayable. The interceptor fallback is not used as
business-intent ownership.

For Database Server creation, a definitive `4xx` response ends the failed
intent, so a later submission receives a fresh key. `GW.IDEM.IN_FLIGHT`, a
network failure, and `5xx` preserve the original key because the outcome is
still processing or unknown.

Treat `GW.IDEM.IN_FLIGHT` as processing/reconcile. Treat mismatch/reuse errors
as client defects.

Backup policy/override writes, Worker delete commands, Core Backup-principal
credential commands, manual backup start, restore start, and restore promotion
retain stable caller-owned UUIDv7 keys for the exact intent. The three run
commands are Gateway `WRITE_SENSITIVE` with upstream transport retry disabled;
the browser must still reuse the same key and body after an authentication
refresh or ambiguous outcome. Worker durably binds actor, operation, SHA-256
intent fingerprint, and accepted run before dispatch, returning the original
run on an exact retry and rejecting key reuse for another actor or intent.
Before dispatch, the three run-command screens store only a tab-scoped key,
route, SHA-256 intent digest, safe resource identity, and timestamp. They do
not persist the body, audit reason, target database, or confirmation text.
After reload the operator must inspect Worker history and re-enter the exact
original values; a changed digest is blocked, and unavailable storage prevents
dispatch.

Tenant create deliberately uses status-only recovery instead: the tab retains
only the key, immutable public tenant name, and timestamp. An ambiguous outcome
locks the wizard and permits only an authoritative exact-name status lookup;
the sensitive create DTO is never persisted or automatically replayed.

## Data-state and numeric rules

Each independent resource must distinguish loading, refreshing, data, empty,
forbidden, unavailable, validation, conflict, stale, transport, replay, and
terminal async failure.

Initial loading may reserve the surface with a skeleton. Background refresh
keeps safe prior data, controls, pagination, selection, scroll position, and
focus mounted; expose `aria-busy` and one concise status instead of replacing
the region. Forbidden is never empty, stale/partial data remains visibly
qualified, validation stays associated with fields, and blocking errors retain
a retry or recovery action. See
[Operational UX](design-system/operational-ux.md#page-and-query-state-model).

Keep money, FX, byte quotas, and capacities as strings. Do not use `parseFloat`
for authoritative financial calculations.

Backup UI must not render passwords, `storageKey`, `storagePrefix`,
`manifestKey`, raw artifact `metadata`, or raw restore `verification`. It may
show only allowlisted status/evidence projections and verification presence.
The frontend adapter strips raw entity fields from application state; Worker
must still stop returning those fields in its HTTP response before release.

## Gated boundaries

- Existing-tenant Storage Server migration remains default-off and must not be
  exposed.
- Normal tenant PATCH must never accept `storageServerId`.
- Admin Realtime is not activated; notification UX falls back to REST polling.
- Storage attestation/recovery remains gated until its operator-safe evidence
  contract is confirmed.
- Backup safe projections and durable command identity are source-integrated.
  Production readiness still requires Worker database-package adoption, live
  schema execution, and authenticated runtime/deployment evidence.

## Implementation order

1. HTTP/error contracts, RBAC ONE/ALL/ANY, stable intent keys, decimal/byte
   helpers, and shared API states.
2. Repair false-live tenant/auth workflows.
3. Complete the live tenant-creation sequence.
4. Add operational modules.
5. Add provisioning governance.
6. Add bounded catalogue/infrastructure gaps while preserving gates.

See the full [implementation playbook](ai/IMPLEMENTATION_PLAYBOOK.md) and
[test matrix](ai/TEST_MATRIX.md).
