# Content, Files, and Redirect Security

Status: **Current requirements**

Last verified: **2026-07-25**

## Rich and template content

Template definitions and previews are data, not trusted application code.

- Validate against the published template schema.
- Render previews in an isolated sandbox with the minimum capabilities.
- Do not allow a preview to access parent DOM, auth tokens, storage, or network
  unless explicitly required and mediated.
- Reject unsafe URL protocols and active content.
- Preserve immutable version/snapshot pins for rendering.
- Do not mark an adapter production-ready merely because it is present in an
  authoring catalogue.

## Images and assets

- Accept only documented MIME/extension combinations.
- Verify server response and storage key; never construct storage paths from
  unsanitized names.
- Treat SVG as active content unless sanitized and isolated.
- Revoke object URLs.
- Do not embed credentials in asset URLs.
- Signed URLs must be short-lived and must not be logged.

## Downloads

- Use the authenticated documented endpoint.
- Keep `Content-Disposition` filenames as untrusted.
- Remove control/path characters and apply a safe fallback name.
- Respect `nosniff` and the actual response MIME.
- Do not open HTML/SVG/XML attachments in the application origin.
- Do not cache sensitive generated documents persistently.

## Uploads

- Provide early type/size feedback.
- Backend and Gateway limits remain authoritative.
- Preserve multipart boundaries by using `FormData`.
- Cancel uploads on logout/session replacement.
- Show a terminal server result rather than assuming completion from bytes sent.
- Never retry a non-idempotent upload automatically after an unknown result.

## URLs and redirects

Allowed by default:

- relative application paths;
- same-origin canonical API routes;
- documented HTTPS external provider URLs after validation.

Reject:

- `javascript:`, `data:` except narrowly approved safe image cases, `file:`,
  `vbscript:`, credentials in URL, protocol-relative external URLs, and control
  characters;
- external `returnTo`/`next`/`redirect` targets;
- checkout URLs without persisted server evidence and expiry checks;
- backend `Location` values that leave expected canonical namespaces without an
  explicit contract.

## Spreadsheet and text export

User-originated values beginning with `=`, `+`, `-`, or `@` can execute as
spreadsheet formulas. Export generation should neutralize formula injection
server-side; the frontend must not create unsafe CSV from arbitrary resource
objects.

## Source evidence

```text
../backend/mutakamel-apps/shared-libs/packages/storage/
../backend/mutakamel-apps/shared-libs/packages/template-schema/
../backend/mutakamel-apps/shared-libs/packages/template-engine/
../backend/mutakamel-apps/core-app/src/tenant/template-platform/
../backend/mutakamel-apps/mutakamel-web-app/src/shared/api/gateway-route-handler.ts
```
