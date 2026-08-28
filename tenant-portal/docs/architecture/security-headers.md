# Security Headers

Status: **Specification**

Written: **2026-08-28**

Ingress: **Nginx Proxy Manager**

Resolves [OPEN-QUESTIONS.md](../build/OPEN-QUESTIONS.md) Q1.

## The split — and why it is not "put it all in nginx"

| Header | Owner | Why |
| --- | --- | --- |
| `Strict-Transport-Security` | **NPM** | NPM terminates TLS. The app never sees the scheme |
| `X-Content-Type-Options` | **NPM** | Static, transport-level |
| `X-Frame-Options` | **NPM** | Static, transport-level |
| `Referrer-Policy` | **NPM** | Static, transport-level |
| `Permissions-Policy` | **NPM** | Static, transport-level |
| **`Content-Security-Policy`** | **the app** | **Requires a per-request nonce. nginx cannot generate one** |

That last row is the whole reason this is a split and not a one-line nginx
config.

### The nonce problem

`src/app/layout.tsx` renders an inline `beforeInteractive` script — the
theme/direction bootstrap that prevents the wrong-theme flash
([theming.md](../design/theming.md#no-flash--the-mechanism)). Next.js also
emits its own inline bootstrap.

Inline scripts need one of:

- `'unsafe-inline'` — which defeats the point of having a CSP;
- a hash — brittle, changes every time the script text changes;
- **a nonce** — regenerated per request, which is the correct answer.

A static nginx `add_header` cannot produce a fresh nonce per request. So CSP is
generated in `src/proxy.ts`, where a nonce can be minted and handed to Next.

**Do not also set CSP in NPM.** Two `Content-Security-Policy` headers are
intersected by the browser, and the strictest wins — you get a policy nobody
wrote, and the app breaks in ways that look random.

## Nginx Proxy Manager configuration

Per proxy host, **Advanced → Custom Nginx Configuration**:

```nginx
# Transport-level headers. CSP is deliberately absent — the app sets it,
# because it needs a per-request nonce.
#
# `always` is required: without it nginx drops the header on 4xx/5xx
# responses, so an error page ships unprotected.

add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options    "nosniff" always;
add_header X-Frame-Options           "DENY" always;
add_header Referrer-Policy           "strict-origin-when-cross-origin" always;
add_header Permissions-Policy        "camera=(), microphone=(), geolocation=(), payment=()" always;

# The original Host must survive. Tenant host admission reads it server-side
# and fails closed on a host it cannot verify — see architecture/routing.md.
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

### Three NPM-specific traps

1. **`add_header` does not merge — it replaces.** If any `location` block in
   your config adds a header, every header inherited from the server block is
   dropped inside that block. NPM generates `location` blocks for you. If a
   header goes missing, this is why: re-declare the full set inside that
   location.

2. **`preload` is not in the HSTS value above, on purpose.** Submitting to the
   preload list is effectively irreversible and applies to every subdomain.
   Add it only after the tenant domain strategy is settled and you are certain
   no subdomain will ever need plain HTTP.

3. **NPM's "Block Common Exploits" toggle is fine to leave on**, but it is not
   a substitute for any header above. It filters a small set of known-bad
   request patterns.

### SSL tab

- **Force SSL** — on.
- **HTTP/2 Support** — on.
- **HSTS Enabled** — **leave off.** You are setting HSTS in the custom config
  above; enabling both emits the header twice.

## The app's CSP

`src/proxy.ts` already runs on every `/crm/*` and `/core/*` request. Extend it
to mint a nonce and set the policy:

```ts
// src/proxy.ts
const nonce = crypto.randomUUID().replaceAll("-", "");

const csp = [
  `default-src 'self'`,
  `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
  `style-src 'self' 'unsafe-inline'`,        // Tailwind emits inline styles
  `img-src 'self' data: blob:`,               // avatars arrive as same-origin paths
  `font-src 'self'`,                          // next/font self-hosts — no Google origin
  `connect-src 'self'`,                       // same-origin Gateway + realtime
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
].join("; ");

response.headers.set("Content-Security-Policy", csp);
response.headers.set("x-nonce", nonce);
```

Then read the nonce in `layout.tsx` and pass it to the bootstrap `Script`.

Four values above are deliberate and worth not "simplifying":

- **`font-src 'self'`** — no `fonts.gstatic.com`. `next/font` downloads Readex
  Pro and DM Mono at build time and serves them same-origin
  ([typography.md](../design/typography.md)). If you ever switch to a `<link>`
  to Google Fonts, this line has to change — which is a useful tripwire.
- **`connect-src 'self'`** — the Gateway is same-origin
  (`/api/tenant/...`) and the realtime connection rides the same origin. If
  realtime is ever moved to its own host, add it explicitly rather than
  widening to `*`.
- **`style-src 'unsafe-inline'`** — unavoidable with Tailwind's runtime style
  injection. Style-based attacks are a far smaller surface than script, and
  `script-src` stays strict.
- **`frame-ancestors 'none'`** — this is the modern `X-Frame-Options`.
  Both are set; `frame-ancestors` wins where supported.

## Rollout order

CSP breaks things silently, so do not ship it enforcing:

1. Ship the NPM headers first. They are low-risk and independently useful.
2. Ship CSP as **`Content-Security-Policy-Report-Only`** and watch the console
   in both languages and both themes, with dropdowns, dialogs and the board
   view exercised.
3. Only when report-only is clean for a full day of real use, switch the header
   name to enforcing.

Step 2 is not optional. A CSP that blocks the theme bootstrap gives every user
a flash of the wrong theme, and nothing in the test suite would catch it.

## Verification

```bash
curl -sI https://<tenant-host>/ | grep -iE "strict-transport|x-frame|x-content-type|referrer-policy|permissions-policy|content-security"
```

- [ ] All five NPM headers present on a **200**
- [ ] All five still present on a **404** (proves `always` is working)
- [ ] Exactly **one** `Content-Security-Policy` header, from the app
- [ ] `Host` reaches the app unmodified — host admission still succeeds
- [ ] No CSP violations in the console across both themes and both languages
