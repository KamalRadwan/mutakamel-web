# Tenant workspace settings and branding API

> **Contract status:** Current
> **Last verified:** 2026-08-25
> **Backend owner:** Core (`core-app`)
> **Canonical browser prefixes:** `/api/tenant/core/v1/workspace-settings`, `/api/tenant/core/v1/branding`
> **Controller-relative prefixes:** `/tenant/workspace-settings`, `/tenant/branding`
> **Tenant Portal status:** Planned. A dated 2026-07-25 inventory referenced a consolidated settings implementation, but that `mutakamel-web-app` workspace is absent from the current checkout and is not live-runtime evidence.
> **Documentation:** Hand-written and source-verified; not generated.

Currency, tax, and numbering contracts are documented separately in [finance-configuration.md](finance-configuration.md).

## Source of truth

- Gateway routes: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- Workspace controller, DTO, service: `../backend/mutakamel-apps/core-app/src/tenant/workspace-settings`
- Branding controller, DTO, service: `../backend/mutakamel-apps/core-app/src/tenant/branding`
- Historical consolidated API/page reference (absent from the current checkout): `../backend/mutakamel-apps/mutakamel-web-app/src/features/tenant/settings`

## Common contract

All routes except public branding require a tenant JWT, a verified host matching
the token tenant, an active unexpired `sid` with all four exact Auth epochs,
subscription access, and the listed permission. The browser calls same-origin
canonical paths and must not send trusted tenant/company/branch headers.

Core rejects unknown DTO fields. JSON success responses use `{success:true,data,correlationId,timestamp}`. The public logo and icon reads below instead stream raw image bytes. The error envelope is `{success:false,statusCode,errorCode,errorCategory,message,details?,correlationId,timestamp,path}`. These settings commands are not explicitly replay-safe: do not automatically retry them after an ambiguous network failure.

Security is tenant/session/permission based, with host-only access for public branding. Workspace/branding updates have no application idempotency contract and expose no asynchronous job.

## Workspace settings

| Method and canonical browser path | Permission | Body/result |
|---|---|---|
| `GET /api/tenant/core/v1/workspace-settings` | `workspace.read` | Returns the singleton |
| `PUT /api/tenant/core/v1/workspace-settings` | `workspace.manage` | Partial `UpdateWorkspaceSettingsDto`; returns updated singleton |

Accepted update fields:

- `defaultLanguage`: `en` or `ar`; trimmed and lowercased, maximum 8.
- `defaultCurrencyCode`: exactly three characters, trimmed and uppercased; it must reference an active tenant currency.
- `timezone`: non-empty, trimmed, maximum 48, and a runtime-valid IANA zone such as `Africa/Cairo` or `UTC`.
- `allowSupport`: strict boolean (`true`/`false`, including those exact query-style strings after transformation).

Safe workspace-update example:

```http
PUT /api/tenant/core/v1/workspace-settings
Cookie: __Host-mutakamel-tenant-access=<redacted>; __Host-mutakamel-tenant-session=<redacted>; __Host-mutakamel-tenant-csrf=<csrf-proof>
X-CSRF-Token: <csrf-proof>
Content-Type: application/json

{"defaultLanguage":"ar","defaultCurrencyCode":"EGP","timezone":"Africa/Cairo","allowSupport":false}
```

`GET` may be served through Core's tenant cache for up to 300 seconds; an update purges that cache. Expected domain errors include `TENANT_NOT_READY`, `CURRENCY_NOT_ENABLED`, `TIMEZONE_INVALID`, and `LANGUAGE_INVALID`.

## Branding

| Method and canonical browser path | Permission/access | Body/result |
|---|---|---|
| `GET /api/tenant/core/v1/branding/public` | Public, verified tenant host | Display-only pre-auth branding |
| `GET /api/tenant/core/v1/branding/public/logo` | Public, verified tenant host | Raw PNG, JPEG, or WebP logo bytes |
| `GET /api/tenant/core/v1/branding/public/icon` | Public, verified tenant host | Raw PNG, JPEG, or WebP icon bytes |
| `GET /api/tenant/core/v1/branding` | `branding.read` | Full branding singleton |
| `PUT /api/tenant/core/v1/branding` | `branding.manage` | Partial `UpdateBrandingDto` |
| `POST /api/tenant/core/v1/branding/logo` | `branding.manage` | Multipart `file`; replaces logo |
| `POST /api/tenant/core/v1/branding/icon` | `branding.manage` | Multipart `file`; replaces icon |

`UpdateBrandingDto` accepts only:

| Field | Validation |
|---|---|
| `primaryColor`, `secondaryColor` | CSS hex color |
| `fontFamily`, `appName`, `tabTitle` | string, maximum 120 |
| `loginHtml` | string, maximum 20,000; sanitized server-side before persistence |

Uploads use exactly one `file` field. Allowed MIME types are `image/png`, `image/jpeg`, and `image/webp`; maximum size is 2 MiB. Do not trust filename extensions or attempt to create storage paths in the portal.

The public branding projection supplies the same-origin logo/icon paths. Those asset routes re-resolve the tenant from the verified host and return `Content-Length`, `X-Content-Type-Options: nosniff`, an inline `Content-Disposition`, and `Cache-Control: public, max-age=300`. An unresolved tenant or missing, invalid, or unavailable asset is a `404` (`TENANT_NOT_RESOLVABLE` or `BRANDING_ASSET_NOT_FOUND`); no Storage credential or object key is exposed.

Expected errors include `BRANDING_FILE_REQUIRED`, `BRANDING_FILE_TYPE_UNSUPPORTED`, `BRANDING_FILE_TOO_LARGE`, and `BRANDING_STORAGE_UNAVAILABLE`. Public branding is one of the few reads allowed while a tenant is suspended, so it must remain free of private tenant configuration. Treat every public branding response as tenant-specific; never cache it globally or across hosts.

## AI implementation rules

- Fetch public branding only after host status succeeds.
- Use the returned server-issued asset URLs as opaque values.
- Refresh workspace-derived locale/timezone state from the successful update response.
- Never render unsanitized request `loginHtml`; render only the server-returned value under the portal's HTML policy.
