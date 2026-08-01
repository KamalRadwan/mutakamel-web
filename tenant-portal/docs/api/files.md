# Core signed file downloads

> **Contract status:** Current, download-only Tenant Portal surface
> **Last verified:** 2026-07-25
> **Backend owner:** Core + shared storage package
> **Canonical browser path:** `/api/tenant/core/v1/files/:bucket/:year/:month/:name?exp=...&sig=...`
> **Controller-relative path:** `/files/:bucket/:year/:month/:name` (version-neutral Core route, mounted as `/api/files/...`)
> **Tenant Portal status:** Planned. Legacy branding/directory/document clients already consume server-issued file URLs.
> **Documentation:** Hand-written and source-verified; not generated.

## Source of truth

- Gateway route: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- Controller: `../backend/mutakamel-apps/core-app/src/common/storage/storage-files.controller.ts`
- Storage constants/security: `../backend/mutakamel-apps/shared-libs/packages/storage/src/constants/buckets.constant.ts` and `../backend/mutakamel-apps/shared-libs/packages/storage/src/security/signed-url.util.ts`
- Existing browser proxy: `../backend/mutakamel-apps/mutakamel-web-app/src/app/api/[master]/[app]/[version]/[...path]/route.ts`

## Contract

| Method and exact canonical browser path | Portal use |
|---|---|
| `GET /api/tenant/core/v1/files/:bucket/:year/:month/:name` | Call only with the server-issued `exp` and `sig` query values |

`GET` is bearer-public but not tenant-independent. Core still resolves the verified request host and binds signature verification to that tenant ID. A valid URL copied to another tenant host fails.

Path validation:

- `bucket`: exactly one of `avatars`, `crm-source-icons`, `invoices`, `attachments`, `exports`, `imports`.
- `year`: four decimal digits.
- `month`: `01`–`12`.
- `name`: 1–128 characters matching `^[A-Za-z0-9._-]+$`.

Query validation:

- `exp`: integer at least 1; the signed Unix expiry must still be current.
- `sig`: exactly 64 hexadecimal characters.

Success streams the stored bytes directly. It is not a Core JSON success envelope. Headers include the stored `Content-Type`, exact `Content-Length`, sanitized inline `Content-Disposition`, and `Cache-Control: private, max-age=300`.

Invalid/missing tenant context, expired/tampered signature, or changed path is deliberately rejected as an invalid signature. Storage not-found/unavailable errors use the shared storage error contract.

Safe example: navigate to the exact signed URL returned by an owning API. Do not replace the placeholders in the route template manually.

## Security and AI implementation rules

- Never construct, sign, extend, or modify a file URL in the portal. Obtain the full opaque URL from the owning API response.
- Never remove `exp`/`sig`, decode them for authorization, or reuse a URL on another host.
- Fetch as a blob/stream, not through the JSON envelope parser.
- Do not persist signed URLs beyond their business view. Refetch the owning record when a URL expires.
- Keep downloads in same-origin navigation/fetch so Gateway preserves the verified browser host.
- The route is idempotent and safely retryable only while the exact URL remains unexpired.
- The download is a synchronous byte stream, not an asynchronous job.
