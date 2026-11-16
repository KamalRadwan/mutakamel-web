# Admin portal security headers

Source reviewed: **2026-10-30** (AUDIT29V-AP-1). Runtime verification is pending
the admin production rebuild and lead browser checks.

## Ownership and nonce flow

`src/proxy.ts` owns the enforcing document CSP and security headers. It covers
login, dashboard, tenant workspace, WebPhone settings and other document routes;
the matcher excludes `api`, `_next/static`, `_next/image` and `favicon.ico`.
Gateway owns API responses. Do not add a second CSP at portal-edge.

Each request gets 16 cryptographically random bytes encoded as hex. The proxy
overwrites incoming `x-nonce` and `Content-Security-Policy` request headers and
forwards them to Next. Next uses that request CSP to nonce framework scripts.
The async root layout reads `headers()`, which requires dynamic rendering, and
passes the same nonce to the `LANG_DIR_BOOTSTRAP` Script and `next-themes`.
Document HTML must not be statically generated or shared through a CDN cache.
See the [Next.js CSP guide](https://nextjs.org/docs/app/guides/content-security-policy)
and [next-themes nonce API](https://github.com/pacocoursey/next-themes#themeprovider).

## Enforced production policy

```text
default-src 'self';
script-src 'nonce-<per-request nonce>' 'strict-dynamic';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://tile.openstreetmap.org;
font-src 'self';
connect-src 'self' wss:;
frame-ancestors 'none';
base-uri 'none';
form-action 'self';
object-src 'none'
```

WebPhone servers are configured at runtime in admin settings, so no static host
list exists. `wss:` permits secure WebSocket signaling to those servers without
allowing arbitrary HTTPS fetches. STUN/TURN ICE traffic is not governed by CSP
`connect-src`, so no ICE entries are added. Same-origin API requests remain
allowed. Development alone adds `ws:` for local HMR and `'unsafe-eval'` for
Next/React debugging.

Inline styles are required by React style attributes and Radix positioning;
script execution still requires the nonce or strict-dynamic trust. Images allow
data/blob previews and the exact OpenStreetMap tile origin already used by
`LocationPickerDialog`. Fonts are served locally by Next. No
`upgrade-insecure-requests` directive is emitted because the portal also runs on
the HTTP development endpoint at port 5001.

Documents also carry `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: same-origin`, and
`Permissions-Policy: camera=(), microphone=(self), geolocation=()`.
Microphone access stays available to the same-origin WebPhone. Next's
`X-Powered-By` header is disabled in `next.config.ts`.

## Lead verification

Run the proxy and layout unit specs, admin typecheck and lint, then rebuild from
the frontend repository with `node scripts/rebuild-portal.mjs admin`.
See [portal runtime](../../../docs/operations/portal-runtime.md).

On `:5001`, verify document responses have exactly one enforcing CSP, the listed
security headers and no `X-Powered-By`. Reload twice to check fresh nonces and
inspect the rendered bootstrap/framework script nonces against the response CSP.
Check login, dashboard, tenant workspace and WebPhone for CSP violations, theme
and language hydration in Arabic/English and light/dark, WSS registration and
microphone/call audio. Include the tenant location picker for tile loading.
