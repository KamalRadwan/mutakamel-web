# Mutakamel Admin Portal

Next.js control-plane frontend for Mutakamel platform administrators.

## Development

The fixed application port is `5001`:

```powershell
npm run dev
```

In development, same-origin `/api/*` calls are rewritten to `DEV_API_TARGET`
(the API Gateway, default `http://localhost:9000`). Production ingress must
proxy the same-origin `/api/*` namespace to Gateway. Do not configure a
cross-origin public API base: the Secure HttpOnly cookie channel and readable
double-submit CSRF proof are deliberately origin-bound.

## Running in the Docker stack

The local Docker stack runs the **production build** (`output: "standalone"`,
`node admin-portal/server.js`) behind `portal-edge` on `http://localhost:5001`;
the edge routes same-origin `/api/*` to the Gateway like the production
ingress. Changes are live only after `pnpm run portal:rebuild`
(= `node ../scripts/rebuild-portal.mjs admin`); see
[portal runtime](../docs/operations/portal-runtime.md).

## Documentation

Start with:

- [Admin Portal documentation](docs/README.md)
- [Frontend integration guide](docs/frontend-integration-guide.md)
- [Dashboard API contract](docs/api/dashboard.md)

The integration guide identifies live versus mocked screens, backend ownership,
canonical gateway paths, validation rules, enums, RBAC, and known frontend
integration gaps.

Browser requests use:

```text
Core admin:   /api/admin/core/v1/<route>
Worker admin: /api/admin/worker/v1/<route>
```

Do not call unversioned controller-relative `/admin/*` paths from frontend
code.

## User account status confirmation

Source reviewed: **2026-10-31**. On `/users/[id]`, Suspend and Activate open
the same confirmation modal used by the users list, with the existing Arabic
and English action copy. Only confirmation sends the status request; cancelling
sends nothing. Status buttons remain disabled while a save is in progress.
Unit coverage is included in the user detail page tests; execution and runtime
verification are pending the lead's checks and portal rebuild.

## Database migrations permissions

Source verified: **2026-10-17** (Gateway route contracts and Worker controller).

The migration screens require `admin.migrations.read` to load. Starting a run
(dry run or apply, for one tenant or the fleet), pausing, resuming, aborting and
retrying failed tenants require only `admin.migrations.manage`. Abort retains
its audit reason and typed run-ID confirmation. Blocks, downgrade and FORCE
windows retain the additional `admin.migrations.critical` requirement; they
are not exposed by these run-control screens. Read-only feedback names only
the missing manage permission. Gateway and Worker enforce authorization again.

## Billing display localization

Source reviewed: **2026-10-31** (AUDIT29X-APB-8). Wallet ledger direction
and reason, and payment status, purpose and provider use Arabic/English labels;
their title attributes retain the original enum values. Initial-commercial and
commercial-change quote expiry dates use the billing panel's locale-aware
medium-date/short-time format, retaining the ISO value in `time.dateTime`.
Unit execution, typecheck, lint and the admin portal rebuild await lead verification.

## Scripts

```powershell
npm run dev
npm run lint
npm run build
npm run start
```

`start` also binds to the fixed port `5001`.
