# Security Headers

Status: **App half built** (MASTER-PLAN 13.1) · **Nginx half still to configure**

Written: **2026-08-28** · CSP built and verified: **2026-08-31**

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

## The app's CSP — built

`src/proxy.ts` mints the nonce and sets the policy. Until 2026-08-31 this
section described a mechanism nobody had built: there was no CSP string and no
nonce anywhere in that file, which is what
[DECISIONS.md#d16](../build/DECISIONS.md#d16--the-csp-policy-decided-against-what-actually-exists--assumed)
recorded and MASTER-PLAN 13.1 closed.

```ts
default-src 'self'
script-src 'self' 'nonce-<n>' 'strict-dynamic'   // + 'unsafe-eval' in dev only
style-src 'self' 'unsafe-inline'
img-src 'self' data: blob:
font-src 'self'
connect-src 'self'
frame-ancestors 'none'
base-uri 'self'
form-action 'self'
object-src 'none'
```

Five values are deliberate and worth not "simplifying":

- **`font-src 'self'`** — no `fonts.gstatic.com`. `next/font` downloads Readex
  Pro and DM Mono at build time and serves them same-origin
  ([typography.md](../design/typography.md)). If you ever switch to a `<link>`
  to Google Fonts, this line has to change — which is a useful tripwire.
- **`connect-src 'self'`** — the Gateway is same-origin (`/api/tenant/...`) and
  the realtime socket rides the same origin: `createSocketIoTransportFactory`
  documents that it "always uses the current browser origin", and `'self'`
  matches `wss:` on the page's own origin. If realtime is ever moved to its own
  host, add it explicitly rather than widening to `*`.
- **`style-src 'unsafe-inline'`** — **and the reason first written here was
  wrong.** It said "Tailwind emits inline styles"; Tailwind v4 compiles to an
  external stylesheet and needs nothing. What actually forces it is `style`
  **attributes in server-rendered markup** — React `style={{…}}` props (eight
  components, `DataTable` among them) and Radix's positioning — and no nonce
  can ever whitelist a style attribute, because CSP has no nonce mechanism for
  `style-src-attr`. Tenant branding and density force nothing: both write
  through `element.style.setProperty`, a CSSOM mutation `style-src` never sees.
- **`img-src 'self'`** — the branding logo and icon are same-origin paths
  (`PUBLIC_BRANDING_LOGO_PATH`, `PUBLIC_BRANDING_ICON_PATH`), never a CDN URL.
- **`frame-ancestors 'none'`** — this is the modern `X-Frame-Options`.
  Both are set; `frame-ancestors` wins where supported.

`upgrade-insecure-requests` is deliberately **absent**: NPM forces SSL and sets
HSTS, the app loads no external subresource, and including it would break a
plain-HTTP `next start` used to verify the policy.

### Where the nonce goes, and the one way to get it wrong

The first draft of this page said `response.headers.set("x-nonce", nonce)`.
That does not work, and it fails **silently**: Next reads the nonce from the
**request** headers, so a nonce set only on the response leaves `headers()` in
`layout.tsx` with nothing to read and the theme bootstrap blocked.

`src/proxy.ts` therefore sets both `Content-Security-Policy` and `x-nonce` on
the request headers it hands to `NextResponse.next({ request })`, and the
policy on the response. Next parses `'nonce-…'` out of the request policy and
stamps it onto every framework and bundle script it emits; `layout.tsx` reads
`x-nonce` and passes it to the bootstrap `<Script>`.

**Consequence, stated rather than discovered later:** a nonce must be fresh per
request, so every page is now dynamically rendered. That costs nothing here —
`TenantHostAdmission` already calls `headers()` and `(tenant)/layout.tsx` calls
`cookies()`, so the whole authenticated tree was dynamic already.

### The matcher, and the defect it must not resurrect

CSP belongs on every document, `/login` most of all — it is the one screen that
handles a password. So the matcher covers everything except `api`,
`_next/static`, `_next/image` and `favicon.ico`.

That is a real widening, and `proxy.test.ts` had pinned the opposite: a matched
path with no entry in an `isSupported*Path` allowlist used to redirect to
`/unavailable`, which is how six finished screens shipped unreachable (DEFECTS
D22, Q40). Both module rules — the `/unavailable` redirect and the `405` — are
therefore gated on the `/core`, `/crm`, `/trade` segment itself rather than on
the matcher, and the test now pins the behaviour directly: a non-module path is
passed through untouched and carries the header.

## Rollout order

CSP breaks things silently. The soak is a **flag**, not a code edit:

1. Ship the NPM headers first. They are low-risk and independently useful.
2. Set `TENANT_CSP_REPORT_ONLY=1`. The app then sends
   `Content-Security-Policy-Report-Only` and nothing else — while still
   stamping nonces exactly as it would when enforcing, so flipping the flag
   changes what the browser does and nothing about what the app emits. Watch
   the console in both languages and both themes, with dropdowns, dialogs and
   the board view exercised.
3. Unset the flag to enforce. Enforcing is the default precisely because a
   policy that only ever reports is the same shape as a mechanism that was
   never built.

## Verification

```bash
curl -sI https://<tenant-host>/ | grep -iE "strict-transport|x-frame|x-content-type|referrer-policy|permissions-policy|content-security"
```

- [ ] All five NPM headers present on a **200**
- [ ] All five still present on a **404** (proves `always` is working)
- [ ] Exactly **one** `Content-Security-Policy` header, from the app
- [ ] `Host` reaches the app unmodified — host admission still succeeds
- [ ] No CSP violations in the console across both themes and both languages

### What was actually driven, 2026-08-31

D16 asks for the two silent failures to be **observed**, not reasoned about, so
this was run against a real `next build` + `next start` on 5002 with the policy
enforcing. What each check proves, and what it does not:

| Check | Result |
| --- | --- |
| Header on the wire | One `Content-Security-Policy`, enforcing, on `/login` and on a `404` |
| Nonce reaches the renderer | Every `<script>` in the document — framework, bundle, flight — carries the **same** nonce as the header, and so does the `beforeInteractive` bootstrap descriptor in `<head>` |
| Fresh per request | Two requests, two different nonces |
| The app runs at all | React hydrated and rendered the screen, so `'strict-dynamic'` admits the whole bundle graph |
| **The theme bootstrap executes** | With `tenant_lang=ar`, `tenant_theme=light`, `tenant_density=comfortable` stored, the document came back with `lang="ar" dir="rtl"`, no `.dark`, and `style="--ui-scale: 1.1;"` on `<html>` — and **zero** `securitypolicyviolation` events |
| **The brand ramp applies** | `--color-brand-600` written with `element.style.setProperty` moved from the stylesheet's `oklch(56% .204 258)` to the written value and read back through `getComputedStyle`. This is D16's claim — CSSOM mutations are outside `style-src`'s scope — confirmed against the live enforcing header |
| `connect-src` | The Gateway path reached the server (a CSP block is a `TypeError`, not a `404`), and a same-origin `ws://` was constructed with no violation |
| `img-src` | The branding logo path was requested, not refused |
| Inline script with no nonce | Did not execute |

Two honest limits. The run had no Gateway behind it, so `applyBrandingTokens`
was driven through its CSP-relevant mechanism — the `setProperty` write on
`:root` — rather than from a live `/branding/public` response; and the served
`404` page carried no `style` attributes, so `style-src 'unsafe-inline'` was
not *exercised* here, only justified from the eight components that emit them.
