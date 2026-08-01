# Replacement Source Inventory

Status: **verified-current snapshot**

Last verified: **2026-07-25**

## Scope

The standalone `tenant-portal` replaces tenant-facing behavior in
`mutakamel-web-app`. Platform-admin pages are excluded. Backend code is
read-only evidence.

## Old-web baseline

Current source counts:

| Evidence | Count | Meaning |
| --- | ---: | --- |
| All Next page files | 41 | Entire old app route inventory |
| Admin page files | 5 | Excluded from Tenant Portal replacement |
| Non-admin page files | 36 | Tenant/public/compatibility pages requiring a retain, replace, redirect, or retire decision |
| Tenant feature TypeScript/JavaScript files | 376 | Detailed migration evidence, not 376 independent capabilities |
| API/client-named source files across old `src` | 29 | Starting points for request sequencing and response adapters |

Source roots:

```text
../backend/mutakamel-apps/mutakamel-web-app/src/app/
../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/
../backend/mutakamel-apps/mutakamel-web-app/src/shared/api/
../backend/mutakamel-apps/mutakamel-web-app/src/shared/auth/
../backend/mutakamel-apps/mutakamel-web-app/e2e/
```

See [Tenant route map](../app/route-map.md) for the functional URL inventory.

## New-portal baseline

Current application source contains only:

```text
src/app/globals.css
src/app/layout.tsx
src/app/page.tsx
```

The default page/layout do not yet implement tenant admission, authentication,
an API client, an application shell, feature routes, or tests. Documentation
and its audit tooling are implemented, but product replacement coverage is
still zero.

## Classification rule

Every old page or capability receives exactly one decision:

```text
RETAIN_URL
REPLACE_AT_NEW_URL
REDIRECT
RETIRE
ADMIN_EXCLUDED
```

Dynamic catch-all routes do not count as replacement coverage until their
reachable views are enumerated. A backend capability absent from the old UI can
still require a new explicit route under the approved Tenant Portal scope.

## Reproduction notes

The counts were produced with narrow `rg --files` scans of the roots above.
Generated files, dependencies, build output, and non-TypeScript tenant feature
assets were not counted. Re-run this inventory before cutover because old-web
source can continue to change during the migration.
