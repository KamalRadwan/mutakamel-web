<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Admin Portal Rules

- **Fixed Port**: Run this application only on port `5001`. Do not select an
  alternate port for development or testing.
- **Documentation First**: Read `docs/README.md` and
  `docs/frontend-integration-guide.md` before implementing a server-backed
  screen. For dashboard work, also read `docs/api/dashboard.md`; for
  database-server work, read `docs/api/database-servers.md`; for module,
  feature, tier, pricing, or managed-currency work, read
  `docs/api/catalog.md`; for backup or restore work, read
  `docs/api/backups-restores.md`; for tenant work, read `docs/api/tenants.md` and the
  nested `docs/api/tenant-users.md` and `docs/api/tenant-operations.md`
  contracts relevant to the screen; for platform, auth, billing, notification,
  Asterisk, or SMTP settings work, read `docs/api/system-settings.md`.
- **Backend Scope & Prohibition**: `core-app` is the primary Admin Portal backend;
  `worker-app` owns backup/restore execution; `api-gateway-app` owns the public
  browser route contract. CRM and Trade APIs are tenant-product APIs unless the
  gateway explicitly adds an admin-master route. NEVER edit, modify, or update
  any backend file under `../backend/` under any circumstances.
- **Canonical Browser APIs**: Call Core through
  `/api/admin/core/v1/<route>` and Worker through
  `/api/admin/worker/v1/<route>`. Never call controller-relative
  `/admin/...` or upstream `/api/v1/admin/...` paths from browser code.
- **Contract Verification**: Verify method/path in the gateway route contracts,
  then verify guards, permissions, DTO validation, enums, and response shapes
  in the owning backend controller/DTO/service. Frontend mock objects and
  endpoint comments are design fixtures, not API evidence.
- **Integration Status**: Authentication, dashboard, admin users/roles,
  Database Servers, the separate Backup module, and Storage Servers with
  server-backed registry controls, independent safe probes, and explicit
  evidence freshness,
  Catalogue, and settings contain substantial real integration. Backup safe
  projections and exact durable command recovery are source-integrated, while
  package/schema adoption and authenticated runtime remain release gates.
  Tenants remain partial and
  contract-breaking; several operational modules are missing. Use
  `docs/audit/frontend-capability-matrix.md` for the current source boundary.
  Do not treat source integration as authenticated runtime or deployment
  evidence.
- **Shared HTTP Behavior**: Use the shared API client so protected calls use
  HttpOnly cookie auth, `credentials: "include"`, and the coordinated single
  refresh retry. The server infers the browser channel; feature code must not
  select an authentication mode, read or attach JWT bearer tokens, or introduce
  raw `fetch` paths that bypass session handling.
  Routes explicitly documented as non-idempotent and non-replayable must opt
  out of both automatic idempotency-key injection and the automatic 401
  refresh replay. Persist only minimal, non-secret attempt evidence until the
  operator resolves an ambiguous outcome.
  Core success payloads are under `data`; paginated responses also use `meta`,
  while Core failures expose `errorCode` and Gateway Problem Details expose
  `code`. Normalize both without discarding `correlationId`.
- **Idempotent Writes**: A Gateway route marked `WRITE_SENSITIVE` and
  `idempotent: true` requires an `x-idempotency-key` UUIDv7 header. Generate
  one key per user intent and reuse that exact key only when retrying the same
  request.
- **Strict DTOs**: Core rejects unknown fields. Send only documented DTO keys,
  preserve case-sensitive enum wire values, and do not submit placeholder IDs
  to UUID-validated endpoints.
- **RBAC**: Derive navigation and action visibility from `/auth/me`
  permissions. Permission pairs use ALL semantics; use ANY only when the
  Gateway route explicitly declares it. UI hiding is not a replacement for
  backend authorization, and `403` is not an empty state.
- **Documentation Maintenance**: When a route, DTO, enum, permission, response
  adapter, or live/mock boundary changes, update the relevant file under
  `docs/` and refresh its verification date in the same task.
- **Styling**: Use Tailwind CSS first and keep admin dashboards, tables, and
  metric layouts compact and space-efficient.
- **Navigation**: Use `Link` from `next/link` for internal routes.
- **Bilingual and Theme Support**: Every screen must support Arabic RTL and
  English LTR plus dark and light themes. Prefer logical Tailwind properties
  such as `start-*`, `end-*`, `ms-*`, and `me-*`.
- **Logic/View Separation**: Put state, effects, handlers, and API integration
  in `hooks/use<ComponentName>.ts`; keep `.tsx` components focused on markup
  and Tailwind classes.
- **WebPhone Security**: The floating Admin WebPhone uses browser-only `jssip`
  plus `/api/admin/core/v1/users/me/webphone`, Asterisk settings, and call-log
  routes. SIP passwords may exist only in active component memory and must
  never be written to browser storage, logs, analytics, or UI fixtures.
- **File Scope**: Modify files only when the user has authorized changes.
