# Replacement Source Inventory

Status: **dated historical snapshot; not current source evidence**

Last verified: **2026-07-25**

## Scope

The standalone `tenant-portal` migration was initially scoped from a
2026-07-25 snapshot of `mutakamel-web-app`. That consolidated workspace is
absent from the current checkout; the counts and paths below are historical
inventory only. Platform-admin pages were excluded. Backend code is read-only
evidence.

## Old-web baseline

Counts captured on 2026-07-25:

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

## New-portal baseline captured on 2026-07-25

At the snapshot date, application source contained only:

```text
src/app/globals.css
src/app/layout.tsx
src/app/page.tsx
```

This baseline is retained only to explain the original migration plan. It is
not a statement about current `tenant-portal` source: Auth/session and API
client foundations plus a substantial route/feature tree now exist, and each
capability must report its own current source, test, runtime, and release
evidence.

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

The counts were produced with narrow `rg --files` scans of the historical roots
above. Generated files, dependencies, build output, and non-TypeScript tenant
feature assets were not counted. Do not rerun those paths unless the historical
workspace is deliberately restored; produce a new dated inventory from current
split-portal source before cutover.
