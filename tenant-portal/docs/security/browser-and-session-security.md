# Browser and Session Security

Status: **Required replacement contract**

Last verified: **2026-07-25**

## Token handling

- Never put tokens in URLs, fragments used by third parties, DOM attributes,
  HTML, logs, telemetry, or error reports.
- Do not store token-bearing objects in general application state or query
  caches.
- Do not expose internal Gateway origins or secrets through public environment
  variables.
- Redact `Authorization`, cookies, refresh tokens, invitation/reset tokens,
  payment checkout evidence, SIP passwords, and signed URLs.

The exact tenant token storage mechanism must match the current Core contract.
Changing to HttpOnly cookie mode requires verified backend support and is not a
frontend-only decision.

## Generation isolation

Every authenticated request is associated with one session generation.

- A new login creates a new generation.
- Refresh rotates only the expected generation.
- Logout removes/tombstones before navigation.
- Storage events invalidate other tabs.
- Delayed work from an old generation fails closed.
- Cache keys include or are cleared by generation.

## Cross-site protections

- Prefer same-origin Gateway calls.
- When cookies are used, send credentials only to the intended origin and
  enforce SameSite/Secure/HttpOnly policy server-side.
- Do not relax CORS from the frontend.
- State-changing cookie-authenticated routes require an explicit CSRF design.
- Validate `Origin`/`Referer` at the appropriate server boundary where the
  contract requires it.

## XSS

- Do not use `dangerouslySetInnerHTML` for backend/user content without an
  approved sanitizer and content contract.
- Keep translations as text, not executable HTML.
- Treat template preview HTML as isolated untrusted content.
- Sanitize/validate URL protocols.
- Do not inject backend theme/custom CSS as raw styles.
- Use a restrictive Content Security Policy and nonces/hashes for necessary
  scripts.

## Security headers

The production app/ingress should define and test:

- Content-Security-Policy;
- Strict-Transport-Security;
- X-Content-Type-Options: `nosniff`;
- Referrer-Policy;
- Permissions-Policy;
- frame-ancestors or equivalent anti-clickjacking policy;
- safe Cache-Control on authenticated responses.

Header ownership between Next, Caddy/ingress, and deployment must be explicit.
Duplicate conflicting headers are not acceptable.

## Navigation

- Allow internal relative routes by default.
- External URLs require explicit HTTPS and allowlist/policy.
- Never redirect to a URL from an unvalidated query parameter.
- Strip action tokens from address/history after successful capture when
  practical.
- Do not include secrets in `returnTo`.

## Client diagnostics

Allowed:

- stable error code/category;
- HTTP status;
- correlation ID;
- feature/route identifier;
- bounded timing;
- non-sensitive state label.

Forbidden:

- request/response bodies by default;
- tokens, cookies, trusted headers;
- personal/contact/financial content;
- template/document bodies;
- signed URLs/provider responses;
- stack traces exposed to end users.

## Dependencies

- Use locked dependencies.
- Review packages that process HTML, rich text, files, documents, charts, or
  authentication.
- Load browser-only telephony/large runtime dependencies only in the browser.
- Avoid packages that require unsafe CSP relaxation without review.
