# Security Headers

Status: **App half built** (MASTER-PLAN 13.1) · **Nginx half still to configure**

Written: **2026-08-28** · CSP built and verified: **2026-08-31**

Ingress: **Nginx Proxy Manager**

Resolves [OPEN-QUESTIONS.md](../build/OPEN-QUESTIONS.md) Q1.

## The split — and why it is not "put it all in nginx"

| Header | Owner | Why |
| --- | --- | --- |
| `Strict-Transport-Security` | **NPM, only for an HTTPS deployment** | Omit it for the selected HTTP deployment |
| `X-Content-Type-Options` | **NPM** | Static, transport-level |
| `X-Frame-Options` | **NPM** | Static, transport-level |
| `Referrer-Policy` | **NPM** | Static, transport-level |
| `Permissions-Policy` | **NPM** | Static, transport-level |
| **`Content-Security-Policy`** | **the app** | **Requires a per-request nonce. nginx cannot generate one** |

That last row is the whole reason this is a split and not a one-line nginx
config.

### The nonce problem

`src/app/layout.tsx` renders an inline `<script>` — the
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

2. **Keep HSTS and preload disabled for the HTTP deployment.** They instruct
   browsers to upgrade to HTTPS and conflict with this transport choice.
   Previously cached HSTS policies can also upgrade a URL before it reaches
   the application.

3. **NPM's "Block Common Exploits" toggle is fine to leave on**, but it is not
   a substitute for any header above. It filters a small set of known-bad
   request patterns.

### SSL tab

- **Force SSL** — off for the selected HTTP deployment.
- **HTTP/2 Support** — only relevant if TLS is enabled later.
- **HSTS Enabled** — off; no HSTS header is set in the HTTP configuration.

## The app's CSP — built

`src/proxy.ts` mints the nonce and sets the policy. Until 2026-08-31 this
section described a mechanism nobody had built: there was no CSP string and no
nonce anywhere in that file, which is what
[DECISIONS.md#d16](../build/DECISIONS.md#d16--the-csp-policy-decided-against-what-actually-exists--assumed)
recorded and MASTER-PLAN 13.1 closed.

```ts
default-src 'self'
script-src 'nonce-<n>' 'strict-dynamic'          // + 'unsafe-eval' in dev only
style-src 'self' 'unsafe-inline'
img-src 'self' data: blob:
font-src 'self'
connect-src 'self'
frame-ancestors 'none'
base-uri 'self'
form-action 'self'
object-src 'none'
```

Six values are deliberate and worth not "simplifying":

- **`script-src` has no `'self'`** — and that absence is the deliberate part.
  `'strict-dynamic'` makes a browser ignore `'self'`, every host-source
  expression and `'unsafe-inline'` in that directive, so the two together
  state one policy and enforce another; Firefox reports it on every page load
  as `Ignoring "'self'" within script-src: 'strict-dynamic' specified`. The
  usual reason to keep it anyway is as a CSP2 fallback for a browser that does
  not know `'strict-dynamic'`, which would otherwise refuse webpack's lazily
  injected chunks. **That reason does not apply here**: Next 16 compiles for
  `chrome 111`, `edge 111`, `firefox 111`, `safari 16.4`, and Safari 15.4 was
  the last of those engines to gain `'strict-dynamic'`. Nothing needs a host
  allowance either — every `<script>` Next emits carries the nonce, lazy
  chunks are injected with `createElement("script")` and inherit trust, and
  the app loads no third-party script and constructs no Worker. `default-src
  'self'` is unaffected; this is only about the directive `'strict-dynamic'`
  governs. Added 2026-09-01, restoring what
  [D16](../build/DECISIONS.md#d16--the-csp-policy-decided-against-what-actually-exists--assumed)
  decided — `script-src 'nonce-<n>' 'strict-dynamic'`, with no `'self'` — from
  which the 13.1 implementation had drifted.
- **`font-src 'self'`** — no `fonts.gstatic.com`. `next/font` downloads Readex
  Pro and DM Mono at build time and serves them same-origin
  ([typography.md](../design/typography.md)). If you ever switch to a `<link>`
  to Google Fonts, this line has to change — which is a useful tripwire.
  **Superseded 2026-09-01:** the faces are now IBM Plex Sans, IBM Plex Sans
  Arabic and IBM Plex Mono. The directive and the reasoning are untouched —
  `next/font` still self-hosts at build time, so `'self'` still covers it and
  the tripwire still works; only the family names in this sentence aged.
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

**Superseded 2026-09-01:** `favicon.ico` was a hole in the matcher covering
nothing when this was written; it is now a real route handler
(`src/app/favicon.ico/route.ts`) that 308-redirects to `src/app/icon.svg`. The
exclusion is still right and the sentence still describes the matcher
accurately — that handler returns an empty body, so it has nothing for a policy
to protect. Its own header comment records the reasoning.

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
| Nonce reaches the renderer | Every `<script>` in the document — framework, bundle, flight — carries the **same** nonce as the header, and so does the inline theme bootstrap in `<head>` |
| Fresh per request | Two requests, two different nonces |
| The app runs at all | React hydrated and rendered the screen, so `'strict-dynamic'` admits the whole bundle graph |
| **The theme bootstrap executes** | With `tenant_lang=ar`, `tenant_theme=light`, `tenant_density=comfortable` stored, the document came back with `lang="ar" dir="rtl"`, no `.dark`, and `style="--ui-scale: 1.1;"` on `<html>` — and **zero** `securitypolicyviolation` events |
| **The brand ramp applies** | `--color-brand-600` written with `element.style.setProperty` moved from the stylesheet's `oklch(56% .204 258)` to the written value and read back through `getComputedStyle`. This is D16's claim — CSSOM mutations are outside `style-src`'s scope — confirmed against the live enforcing header |
| `connect-src` | The Gateway path reached the server (a CSP block is a `TypeError`, not a `404`), and a same-origin `ws://` was constructed with no violation |
| `img-src` | The branding logo path was requested, not refused |
| Inline script with no nonce | Did not execute |

This run still stands after the 2026-09-01 removal of `script-src 'self'`, and
is in fact the evidence for it: the header carried `'self'` at the time, but
every browser that honours `'strict-dynamic'` had already discarded it, so what
hydrated with zero violations was the policy that ships today.

Two honest limits. The run had no Gateway behind it, so `applyBrandingTokens`
was driven through its CSP-relevant mechanism — the `setProperty` write on
`:root` — rather than from a live `/branding/public` response; and the served
`404` page carried no `style` attributes, so `style-src 'unsafe-inline'` was
not *exercised* here, only justified from the eight components that emit them.

## SD-02 · `allowedDevOrigins` accepts any host (development only)

**Status: ACCEPTED · decided 2026-08-31 · owner: Kamal Radwan**

**Do not change this without an explicit decision.** In particular, do not
"simplify" the pattern — see the trap below, which is the whole reason this
section exists.

### What was decided

`next.config.ts` sets:

```ts
const ALLOWED_DEV_ORIGINS = ["**.*"];
```

Any multi-label host may load `/_next/*` and open the hot-reload WebSocket from
`next dev`.

### Why

Tenant workspaces are reached through customer-owned domains. The dev server is
loaded from whichever tenant host is being worked on — `mersany.mutakamel.ai`
today, others tomorrow — so the set cannot be enumerated in advance.

### The trap — read this before editing

`allowedDevOrigins: ["*"]` **does not work.** It is accepted by the config
schema, it reads as "allow everything", and it blocks every cross-origin host.
Next rejects a bare wildcard on purpose, in
`next/dist/server/app-render/csrf-protection.js`:

```js
// Prevent wildcards from matching entire domains (e.g. '**' or '*.com')
if (patternParts.length === 1 && (parts[0] === '*' || parts[0] === '**')) return false;
```

Measured against that matcher, not assumed:

| Pattern | `mersany.mutakamel.ai` |
| --- | --- |
| `"*"` | **blocked** |
| `"**"` | **blocked** |
| `"*.mutakamel.ai"` | allowed — but only this one domain |
| `"**.*"` | allowed, and any other multi-label host |

`localhost` and `*.localhost` are omitted deliberately: `blockCrossSiteDEV`
prepends both, plus the bound hostname, before consulting this list.

### Why it is guarded

Next has already tightened this matcher once. If a release rejects `"**.*"` too,
the failure is **silent** — HMR stops connecting and the app renders blank,
which is the exact symptom this setting was added to cure. So
`assertDevOriginsAreNotInert()` in `next.config.ts` checks the shipped pattern
against Next's own matcher at dev startup and throws with the reason if it has
gone inert. A missing internal module means the path moved and the check cannot
run; that degrades quietly rather than refusing to boot.

### What it costs — stated plainly

Almost nothing, and far less than backend SD-01, which it is often confused
with. They are different mechanisms on different sides:

| | SD-01 (Gateway) | SD-02 (this) |
| --- | --- | --- |
| Guards | tenant **API** requests | `next dev` internal assets + HMR socket |
| Runs in production | yes | **no** — `blockCrossSiteDEV` is dev-only |
| Gives up | one of three CSRF layers | a dev-machine-only origin check |

The exposure is that a page open in the same browser could read dev bundle
source or attach to the HMR socket of a developer's local server. There is no
production effect: `next build` / `next start` never call this code path.

### Revisit when

- Next's matcher changes and the startup assertion fires.
- A stable, small set of dev hosts emerges — then list them exactly and delete
  the wildcard.

### Related

- `next.config.ts` — `ALLOWED_DEV_ORIGINS`, `assertDevOriginsAreNotInert`
- Backend [SECURITY_DECISIONS.md](../../../../backend/docs/SECURITY_DECISIONS.md) — SD-01, the API-side origin decision

## SD-03 · HTTP deployment and cookie profiles

**Status: ACCEPTED · decided 2026-08-31 · owner: Kamal Radwan**

The user explicitly selected HTTP for the application, including deployments
beyond development. This supersedes the earlier HTTPS-only requirement.

### Cookie configuration

Gateway and Core must use the same `AUTH_COOKIE_SECURE` value. It defaults to
`true`; the selected HTTP deployment sets it to `false` in every environment.
No browser header selects the cookie profile.

| Profile | Tenant cookies | Secure attribute |
| --- | --- | --- |
| `true` (default) | `__Host-mutakamel-tenant-access`, `__Host-mutakamel-tenant-session`, `__Host-mutakamel-tenant-csrf` | yes |
| `false` (HTTP) | `mutakamel-http-tenant-access`, `mutakamel-http-tenant-session`, `mutakamel-http-tenant-csrf` | no |

Both profiles retain HttpOnly access/session credentials, host-only cookies,
`Path=/`, and session-bound double-submit CSRF. The browser reads only the CSRF
proof, preferring its page transport's profile and falling back when that proof
is absent. It never reads or stores bearer credentials. The HTTP profile uses
different names because browsers reject a `__Host-` cookie without `Secure`.

### Browser coordination and forms

The tenant client uses Web Locks when available. On HTTP hosts where the API
is unavailable, a per-tab queue serializes auth operations with the existing
10-second abort budget. A queued operation that expires never starts, and a
running operation retains its place until it settles. Existing refresh
single-flight, session-generation fences and cross-tab events remain enabled.
The fallback does not provide cross-tab mutual exclusion.

Login sends credentials in a same-origin JSON POST body. Credential forms also
declare `method="post"`: if JavaScript has not hydrated, native submission
must not serialize email/password fields into the address bar. This native
fallback does not replace the JavaScript authentication flow.

### Running the portal

Use `pnpm dev` on port `5002`, for example
`http://mersany.mutakamel.ai:5002`. Tenant host admission still applies. The
existing `DEV_TENANT_HOST` override only substitutes a configured tenant for a
loopback host during development; it does not bypass production host admission.

The optional `pnpm dev:https` script remains available with explicit certificate
and key files. Because both are supplied, Next uses them without generating or
installing a local certificate authority. No HTTPS redirect, HSTS policy, or
certificate installation is required for the HTTP deployment.

`DEV_API_TARGET` remains a server-side rewrite target. Production ingress must
route the same-origin `/api/*` namespace to Gateway and preserve the public
tenant Host.

### Transport risk

HTTP does not encrypt passwords or cookies and permits interception or
modification by someone on the network path. POST keeps credentials out of URLs;
HttpOnly and CSRF address other threats and do not provide transport encryption.
