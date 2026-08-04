# Frontend Capability Matrix

Status: **Current source audit**

Last source verification: **2026-08-04**

This matrix describes the current working tree. `DONE` means source-integrated,
not live-authenticated or deployment-verified.

## Domain status

| Domain | Frontend label | Current evidence and remaining boundary |
| --- | --- | --- |
| Auth session | `DONE/PARTIAL/BROKEN` | Login, refresh, `/auth/me`, logout are real; accept invite, reset password, logout-all are missing; forgot password is simulated |
| Dashboard | `DONE/SOURCE_INTEGRATED` | Grouped permission-filtered dashboard, 14 report groups, nested unavailable states, stale-response retention; five standalone report pages remain missing |
| Admin users/WebPhone | `DONE/PARTIAL` | User lifecycle, roles, WebPhone, and call logs use Core; self profile is missing |
| Roles/permissions | `DONE/PARTIAL/REFACTOR` | Real Core calls; ordinary metadata update must not require the critical permission; RBAC foundation lacks ANY |
| Database Servers | `DONE/SOURCE_INTEGRATED` | Typed list/create/detail/edit/history flows, soft delete, deleted-only review, permanent Destroy, provisioning, and per-Application principal controls are implemented; Backup remains an aggregate activation dependency and link to its separate module |
| Backup & Restore | `DONE/SOURCE_INTEGRATED/RELEASE_BLOCKED` | Separate singular `/backup` module implements overview, Core-backed `mutakamel_backup` access, Worker policies/overrides, runs, allowlisted artifact evidence, restore verification, and promotion. Worker safe-response DTOs and exact non-idempotent start-command recovery remain backend release gates; authenticated runtime evidence is open |
| Storage Servers | `DONE/PARTIAL/GATED` | Bounded registry/history/verification/lifecycle is real; routing/rotation not exposed; attestation/recovery remain operator-safety gated |
| Tenants list/detail | `PARTIAL/BROKEN` | Some real calls; nested FQDN/user/subscription/wallet and local lifecycle behavior contain contract defects |
| Tenant creation | `PARTIAL/BROKEN` | Real Storage placement and quote-route attempts exist, but the quote body does not match Core and identity/plan/database/catalogue/FQDN work remains simulated or hardcoded |
| Tenant users/access | `PARTIAL/BROKEN` | Some real user calls; lifecycle methods and access catalogues are wrong/mock |
| Tenant operations | `PARTIAL/MISSING` | List/reconciliation foundation exists; operation-specific and managed-provisioning controls are largely absent |
| Provisioning governance | `MISSING` | 32 Gateway routes; no frontend module |
| Storage migration | `GATED` | Eight default-off routes; do not expose |
| Application Catalogue | `DONE/SOURCE_INTEGRATED` | All 29 routes implemented. Technical readiness now has independent state, fail-closed activation, accessible controlled binding, and stale/in-flight exact-intent recovery; detail/readiness/lifecycle are EN/AR. Authenticated runtime and remaining list/audit/commercial-rail localization stay open |
| Subscriptions | `MISSING/PARTIAL/BROKEN` | Some tenant detail reads; cancellation path is wrong; administration and plan changes are absent |
| Wallet | `BROKEN/MISSING` | Local credit/debit calls nonexistent APIs; preview/confirm workflow is absent |
| Payments/reconciliation | `MISSING` | Five Gateway routes; no frontend module |
| Invoices | `MISSING` | Seven Gateway routes; no frontend module |
| Settings/SMTP | `DONE/PARTIAL/REFACTOR` | Real registry/auth/platform/notifications/Asterisk/SMTP foundation; permissions, fallbacks, and runtime-effect claims need tightening |
| Notifications | `MISSING` | Navbar uses static data; 14 REST routes are exposed |
| Logging | `MISSING` | Six routes including SSE; no frontend module |
| Control-plane audit | `MISSING` | Two immutable-evidence routes; no explorer |

## Confirmed false-live defects

| Defect | Current frontend evidence | Correct contract |
| --- | --- | --- |
| Separate tenant FQDN read | `src/app/tenants/[id]/hooks/useTenantDetail.ts` | Read `fqdns` from `GET /tenants/:id` |
| Tenant-user lifecycle method | Same hook uses `PATCH` | Use `POST` for suspend/activate/restore |
| Add FQDN body | Sends `{ domain }` | Send `{ fqdn }` |
| Primary FQDN method | Uses `PATCH` | Use `POST` |
| Subscription cancellation | Calls nested tenant route | `POST /subscriptions/:tenantId/cancel` |
| Wallet adjustment | Calls `/wallet/credit` and `/wallet/debit` | Preview then confirm with separate UUIDv7 intents |
| Access catalogues | Mock branch/department/team/role arrays | Use permission-specific access routes |
| Tenant creation | Sends undocumented `modules` to quote, then uses hardcoded `srv-*`, `YEARLY`, timers, and selections | Send Core `items`, use the source-verified sequence, and use `ANNUAL` |
| Forgot password | Timer-only behavior | Real auth route |
| Notifications | Static hook data | REST inbox/config/preferences/actions |

## Foundation gaps

- The shared client now preserves Core, Gateway, and Nest/Worker error evidence
  and supports explicitly non-replayable writes. Older feature mutations still
  need migration away from automatically owned keys where their route contract
  requires caller-owned exact intent.
- `rbac.ts` lacks `adminCanAny`.
- `RequirePermission.tsx` supports only one permission.
- Tenant nested loading uses `Promise.allSettled` and discards independent
  failures.
- Some pagination still reads `totalItems` instead of `meta.total`.
- Financial UI still parses authoritative amounts as JavaScript numbers.
- API paths and projection types remain duplicated through large hooks.

## Database and Backup split

- `/database-servers` owns connection/TLS, lifecycle,
  `mutakamel_provisioner`, and per-Application principals. It does not render or
  mutate `mutakamel_backup`.
- `/backup` is a separate top-level, permission-gated module with child routes
  `/backup/access`, `/backup/policies`, `/backup/runs`, `/backup/artifacts`, and
  `/backup/restores`.
- Worker browser API paths remain plural `/api/admin/worker/v1/backups/*` and
  `/api/admin/worker/v1/restores/*`; there is no `/backups` frontend route.
- The Backup Core adapter owns fixed-principal rotation-policy, regenerate, and
  reconcile calls for `mutakamel_backup` and rejects a mismatched projection.
- Policy/override writes, deletes, and Core credential commands retain stable
  exact-intent UUIDv7 keys. Manual backup start, restore start, and restore
  promotion intentionally send no idempotency key and disable automatic 401
  replay. Minimal attempt evidence persists across reloads; exact backend
  command identity for start operations remains a release gate.
- The UI never renders passwords, storage paths/keys, manifest keys, raw
  artifact metadata, raw process errors, or raw restore verification payloads.
  The frontend adapter strips them from application state, but current Worker
  entity responses still expose them in the browser network response.

## Gated work

### Existing-tenant Storage Server migration

Do not implement or expose. The default-off backend foundation does not yet
provide the complete safe placement/fence/current-operation/post-cutover
recovery projection the frontend needs. Ordinary tenant PATCH must never accept
`storageServerId`.

### Admin Realtime

Do not activate a Socket.IO client from this work. Use REST polling for
notifications while Admin Realtime lacks complete release/deployment evidence.

### Storage recovery

Do not collect/display access keys, secret keys, Ed25519 private keys, raw
fingerprints, or invented force activation. Keep attestation and recovery
controls gated until their operator evidence contract is confirmed.

### Backup response and command recovery

Do not describe Backup as production-ready until Worker replaces entity-shaped
admin responses with explicit safe DTO projections and exposes durable command
identity/recovery for non-idempotent backup and restore starts. Frontend
allowlisting is defense in depth, not a substitute for an API boundary.

## Evidence level for this matrix

- Source audit: yes.
- Generated Gateway route inventory: yes.
- Documentation checks: see current validation report.
- Authenticated live runtime: not established by this document.
- Deployment verification: not established by this document.
