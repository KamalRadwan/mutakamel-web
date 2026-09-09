# Frontend Capability Matrix

Status: **[Source verified]**

Last source verification: **2026-09-09** (Catalogue/Addons amendment; other rows retain their dated scope).

The historical 2026-08-25 scan found **240 direct, 0 equivalent, 0 missing**
Core Admin calls. It is not current full-route parity: new Addon/commercial
contracts have expanded the generated inventory (282 routes at this checkpoint).
Generated route presence does not prove a reachable frontend action. Catalogue
and billing work is partial; canonical catalogue/pricing, directory/detail, invoice detail and initial create/seed are source-integrated. Aggregate existing-subscription preparation, preview/apply, operation recovery and original receipt lookup are mounted. Governed definition adoption and authenticated runtime acceptance remain open; see the [commercial boundary](../api/subscriptions.md) and [track receipt](../plans/application-catalogue-frontend-track.md).
`DONE` below preserves earlier source-integrated scope, not live-authenticated,
deployment-verified, Addon-complete or release-ready status.

## Historical Core Admin web route coverage (2026-08-25)

| Evidence | Result |
| --- | ---: |
| Core Admin handlers | 240 |
| Matching Gateway Admin contracts | 240 |
| Exact reachable Admin Portal calls | 240 |
| Equivalent-only representations | 0 |
| Missing Admin Portal capabilities | 0 |
| GET / POST / PATCH / DELETE / PUT | 97 / 100 / 24 / 16 / 3 |

See the [parity audit and delivery record](core-admin-ui-gap-audit-2026-08-12.md)
for the exhaustive family comparison, defect reconciliation, phased plan, and
machine evidence.

## Domain status

| Domain | Frontend label | Current evidence and remaining boundary |
| --- | --- | --- |
| Auth session | `DONE/SOURCE_INTEGRATED` | Login, refresh, `/auth/me`, enumeration-safe forgot password, logout, invite acceptance, reset password, logout-all, session management, and invalidation-outbox replay are real. Public invite/reset routes use a narrow allowlist. |
| Dashboard and reports | `DONE/SOURCE_INTEGRATED` | Grouped dashboard plus the five standalone Core report reads are reachable with permission, filter, state, and test coverage. |
| Admin users/profile/WebPhone | `DONE/SOURCE_INTEGRATED` | User lifecycle, roles, self profile read/update, self/admin WebPhone, and call logs use exact Core calls. Profile failures render forbidden/unavailable/error evidence and retry. |
| Roles/permissions | `DONE/SOURCE_INTEGRATED` | Server pagination, independent role/catalogue reads, nullable descriptions, exact ONE/ALL gates, validation, and caller-owned mutation intents are integrated. |
| Database Servers | `DONE/SOURCE_INTEGRATED` | Registration mounts without a list read; connectivity is optional diagnostics while create authoritatively validates and bootstraps the DRAFT. Full update+critical authority gets one register-and-activate setup action over separate UUIDv7 commands. A no-read actor with initial-bootstrap authority stays in the wizard for bootstrap-only retry under its own stable intent; a no-read actor who can activate stays after a definitive activation failure for activation-only recovery, while ambiguous activation preserves the exact key. Recovery never recreates or resends credentials; only no-read actors unable to perform the remaining command return to `/dashboard` after a partial result. Empty Application catalogue bootstrap is a `READY` no-op; typed list/detail/history/lifecycle/principal recovery remains integrated. |
| Backup & Restore | `DONE/SOURCE_INTEGRATED/RELEASE_BLOCKED` | Separate `/backup` module implements Core-backed database access plus Worker policies, runs, artifacts, restore verification, and promotion. Worker package/schema adoption and authenticated runtime/deployment evidence remain open; unused detail wrappers were removed. |
| Storage Servers | `DONE/SOURCE_INTEGRATED` | Full-permission registration is one operator setup intent over durable create then authoritative activate commands. Activation is domain-idempotent: exact retry or concurrent same-revision completion returns `ACTIVE`, so a lost success is not misreported as DRAFT. Ambiguous UI recovery preserves the exact activation identity, repeats activation only, and never recreates the server or resends credentials. The complete `DRAFT`/`ACTIVE`/`DRAINING`/`OFFLINE` projection, create-only DRAFT fallback, independent probes, registry/lifecycle/default/maintenance/delete gates, and stable UUIDv7 intents remain integrated. |
| Tenants list/detail | `DONE/SOURCE_INTEGRATED` | Directory and tenant-first workspace cover profile/lifecycle, exact FQDN list/validation, provisioning, access, subscription/items, wallet/ledger, invoices, and payments. Database filter options come from the authoritative registry. |
| Tenant creation | `DONE/SOURCE_INTEGRATED` | Real identity validation, create options, quote, reverse geocode, canonical country/calling-code/timezone selection, exact create DTO, and stable recovery are integrated. Authenticated runtime proof remains open. |
| Tenant users/access | `DONE/SOURCE_INTEGRATED` | All 18 routes, readiness/RBAC/owner guards, catalogues, lifecycle, roles, password, WebPhone, delete/restore, and command identities are implemented. |
| Tenant operations | `DONE/SOURCE_INTEGRATED` | All 15 current routes cover history/detail/steps/timeline, retry/cancel, updates, prerequisites, component/seed state, add-Application, repair, decommission, and conflict resolution. |
| Provisioning governance | `DONE/SOURCE_INTEGRATED` | All 31 routes are reachable through governance, fleet preview/rollout, publisher-key, release-draft, validation/publish, published-release, and retirement surfaces. |
| Application Catalogue | `DONE/SOURCE_INTEGRATED` | The closed `databaseDeployment` profile, atomic onboarding route (create+update+critical ALL), and real Database Server `serverSummary` coverage are integrated. A create-only/no-read actor receives a narrow registration-only page that mounts neither Application nor commercial-catalogue list reads and sends only the legacy catalogue-DRAFT command. Identity, lifecycle, publication, technical readiness, commercial catalogue, audit, currencies, stable intents, and Arabic/English coverage remain integrated. |
| Subscriptions | `DONE/SOURCE_INTEGRATED` | Cross-tenant directory plus tenant detail/items, seed, plan preview/apply, and cancellation are integrated. Exact item reads are reconciled with detail. |
| Wallet | `DONE/SOURCE_INTEGRATED` | Wallet, currencies, exact wallet-ID ledger, and server-authoritative preview/confirm adjustment flow are integrated without local FX. |
| Payments/reconciliation | `DONE/SOURCE_INTEGRATED` | Tenant history plus refund and evidence-bound reconciliation proposal/decision are integrated. |
| Invoices | `DONE/SOURCE_INTEGRATED` (existing routes); canonical detail | Directory, detail, metadata edit, generation, issue, void, and tenant offline payment retain exact permissions and validation. Detail uses the single purpose-based retained/manual contract with complete system-invoice pricing and no legacy fallback. No authenticated runtime acceptance is claimed for this revision. |
| Settings/SMTP | `DONE/SOURCE_INTEGRATED` | Registry and exact by-key reads, per-page resource states, critical save gates, top-up cross-field validation, SMTP unknown-before-read state, persisted-value verification, and Asterisk validation are integrated. |
| Notifications | `DONE/SOURCE_INTEGRATED` | Navbar unread count/dropdown plus inbox, single/bulk actions, preferences, configuration, and device tokens cover all 14 routes. |
| Logging | `DONE/SOURCE_INTEGRATED` | Override list/upsert/delete, effective view, history, and authorized SSE live stream cover all six routes. |
| Control-plane audit | `DONE/SOURCE_INTEGRATED` | List and entity-history immutable-evidence views cover both routes. |

## Former false-live and false-missing claims resolved

| Previous claim | Current source truth |
| --- | --- |
| Tenant FQDN list was nonexistent/equivalent | Exact `GET /tenants/:id/fqdns` now owns list state. |
| Tenant-user lifecycle used the wrong method | Suspend, activate, and restore use exact `POST` routes. |
| FQDN add/primary used wrong body/method | Add sends `{ fqdn }`; primary uses `POST`. |
| Subscription items/cancellation were indirect or wrong | Exact items read and canonical cancellation are integrated. |
| Wallet used invented credit/debit routes | Preview/confirm adjustment plus exact wallet-ID ledger are integrated. |
| Forgot password used timer-only behavior | The real enumeration-safe Core auth route is used. |
| Notifications were static | REST unread count, inbox, preferences, configuration, and actions are integrated. |
| Self-profile capability was absent | `/profile` reads and updates the exact Core profile routes. |
| Reports/invoices/logging/provisioning lacked modules | Their complete current Core Admin route families now have reachable modules. |

## Remaining web foundation and release gates

- Historical route capability parity and UI-022 were complete for the earlier
  240-route scope; new Addon/commercial parity remains open. A settled-tree TypeScript AST
  scan found 151 production Axios write calls and 0 bare/implicit-policy calls.
  Idempotent writes own retry-stable UUIDv7 intents; the two Gateway
  non-idempotent WebPhone call-log and forgot-password calls explicitly use
  `skipAutoIdempotency` plus `nonReplayable`.
- The shared client preserves Core, Gateway, and Worker error evidence. Every
  feature must retain `correlationId` and distinguish forbidden from empty.
- `RequirePermission` and RBAC helpers now support ONE, ALL, and ANY semantics.
- Source tests, typecheck, lint, build, and docs checks must be rerun against the
  settled working tree; an authenticated Gateway/Core smoke test and deployment
  verification are separate gates.
- UI-022 focused validation passed 6 files/64 tests, TypeScript `--noEmit`, and
  scoped ESLint; the final users/profile/WebPhone AST slice found 0 auto-key
  dependencies across its 9 writes.
- Worker Backup package/schema adoption and runtime evidence remain separate
  from Core Admin web route parity.

## Historical and gated work

### Existing-tenant Storage Server migration

The eight routes described by the historical design are absent from current
Core and Gateway source. They are not part of the 240-route inventory and must
not be exposed or counted as current frontend gaps.

### Admin Realtime

REST notifications are integrated. Do not activate a Socket.IO client until
Admin Realtime has a released admission/reconnect contract and deployment
evidence.

### Excluded clients

Mobile and Partner implementation, inspection and testing are explicitly
excluded from this task and are not release blockers. Existing files remain
intact; their historical coverage numbers are not current task evidence.

## Evidence level

- Compiler-backed Core/Gateway source audit: yes.
- Historical 240-row Web route ledger and hard checks: yes; expanded catalogue
  and commercial full-route parity: not established.
- Focused source tests for delivered modules and repaired defects: yes.
- Authenticated live runtime: not established by this document.
- Deployment verification: not established by this document.
