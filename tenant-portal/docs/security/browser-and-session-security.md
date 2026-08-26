# Browser and Session Security

Status: **Required replacement contract**

Last verified: **2026-08-26**

## Token handling

- Never put tokens in URLs, fragments used by third parties, DOM attributes,
  HTML, logs, telemetry, or error reports.
- Do not store token-bearing objects in general application state or query
  caches.
- Do not expose internal Gateway origins or secrets through public environment
  variables.
- Redact `Authorization`, cookies, refresh tokens, invitation/reset tokens,
  payment checkout evidence, SIP passwords, and signed URLs.

The accepted direct-cutover contract uses Secure HttpOnly cookies for the
short-lived access token and reusable opaque session credential. Browser
JavaScript rejects a cookie-mode response containing raw token fields.

Unsafe cookie-authenticated requests copy the non-HttpOnly,
session-bound `__Host-mutakamel-tenant-csrf` cookie into `x-csrf-token`.
The proof is not stored in application state, logs, diagnostics, or events.

## Generation isolation

Every authenticated request is associated with one server `sid`.

- A new browser/device login creates another independent `sid`.
- Refresh reuses the credential and cannot revoke sibling tabs.
- Logout/revoke tombstones the exact `sid` only after durable server success,
  before navigation; a transient failure retains authenticated/degraded state.
- BroadcastChannel and storage events carry only a non-secret event ID, `sid`,
  kind, source ID, and timestamp. A changed `sid` blocks old-request replay.
- A terminal cross-tab event affects a tab only when its `sid` exactly matches
  that tab's current session. Successful responses and bootstrap results are
  discarded after any newer session generation or matching tombstone.
- Permission `403` does not refresh or clear auth; terminal session codes do.
- Network/`404`/`409`/`429`/`5xx` failures retain auth and expose degraded
  state.

Only trusted pointer, keyboard, or touch events in a visible tab may mark human
activity. Synthetic events, polling, refresh, timers, hidden tabs, and WSS
traffic cannot extend auth idle time. Core owns all idle-deadline writes;
CRM/Trade activity is checkpointed through Core first. Employee WSS-duration
accounting remains independent from authentication session TTLs.
Activity checkpoint calls are leading, time-bounded, exact-`sid` fenced, and
coalesced by one in-flight call plus bounded success/retry windows. They use the
ordinary coordinated refresh path when access expires. Their safe failure
diagnostics contain only status/code categories and never trigger logout unless
the server returns a definitive terminal session code.

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
