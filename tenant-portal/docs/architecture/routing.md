# Routing

Status: **verified against current source**

Last source verification: **2026-08-27**; host admission's pre-activation
states re-verified **2026-10-11** against Core
`src/tenant/tenant-host/tenant-host-status.service.ts`.

## Route groups

```text
src/app/
  layout.tsx              <html>, fonts, theme bootstrap. No providers.
  (auth)/
    layout.tsx            host admission + minimal providers, NO shell
    login/page.tsx
  (tenant)/
    layout.tsx            host admission + providers + AppShell
    page.tsx              workspace home
    crm/…
    core/authentication/…
    unavailable/page.tsx
```

`(auth)` and `(tenant)` are Next route groups — they shape the layout tree
without appearing in the URL. `/login` renders with no shell chrome; every
tenant route renders inside `AppShell`.

Both groups run host admission. An unknown tenant host must fail **before**
the login form renders, not after.

## Host admission — server-side, fails closed

`src/shared/tenancy/tenant-host-admission.server.ts`, called from
`TenantHostAdmission` in both group layouts.

1. Read the original `Host` header via `next/headers`.
2. Normalize and validate it: lowercase, single colon, valid port range, no
   IP literals, at most 253 characters total, and every DNS label must start
   and end with a lowercase alphanumeric, contain only lowercase
   alphanumerics and hyphens between those, and be 1–63 characters long.
   Anything else yields `null`. The exact pattern is `DNS_LABEL` in
   `src/shared/tenancy/tenant-host-admission.server.ts`.

3. Call Core's public host-status route through the **server-only** Gateway
   origin, with a 2s timeout and `redirect: "error"`.
4. `null` → `notFound()`. `ACTIVE` → render. `SUSPENDED` → the suspension
   boundary. `PROVISIONING` → the "workspace is being prepared" screen.
   `PROVISIONING_FAILED` → the "setup could not be completed" screen. Core
   answers `404 TENANT_HOST_NOT_FOUND` for an unknown, unverified or released
   host — every host of a deleted tenant included — and that, any other
   status value and any failure stay `null`.

```text
TENANT_GATEWAY_INTERNAL_ORIGIN   required by `next start`; server-only.
                                 Origin only — no path, query, fragment or
                                 credentials. Validated at use.
DEV_API_TARGET                   development fallback, default
                                 http://localhost:9000
```

Never expose the Gateway origin through `NEXT_PUBLIC_*`.

### Development API forwarding — verified 2026-09-12

`src/app/api/[...path]/route.ts` forwards canonical tenant Core/CRM/Trade v1
requests through `src/lib/api/dev-gateway-proxy.server.ts` in development only.
It connects to the fixed `DEV_API_TARGET` origin while preserving the browser's
`Host`, including port `5002`. Gateway derives tenant authority from this Host
and passes it to Core; caller-supplied forwarded headers are discarded.

Next's built-in external rewrite changes Host to the destination service. That
made page admission succeed but browser API calls fail with
`TENANT_NOT_RESOLVABLE`. The Node HTTP forwarder preserves streamed bodies,
Origin, CSRF headers, cookies, response status and separate Set-Cookie headers.
It does not follow upstream redirects. Production `/api` routing remains the
external ingress's responsibility. The loopback `DEV_TENANT_HOST` override
applies only to page admission; use the real tenant host for authentication.

**Suspended tenants keep pre-authentication access.** A suspended tenant's
administrator must still be able to reach `/login` — the boundary shows the
suspension state without removing the form. Everything else renders the
suspension screen.

**A tenant that is not active yet admits nothing — verified 2026-10-11.** Until
its first provisioning finishes, Core's `FqdnTenantResolverGuard` answers every
tenant route, sign-in included, with `503 TENANT_INACTIVE`. So
`TenantHostStateBoundary` renders its screen on every path, `/login` and the
invite and reset screens too, and never renders the app beneath it:

| Host status | Screen | Re-check |
| --- | --- | --- |
| `PROVISIONING` | Workspace is being prepared; signing in waits until it is ready | Automatic and bounded (`useHostStatusRecheck`): every 15 s four times, every 30 s four times, then every minute twelve times — 15 minutes, past Core's 10-minute provisioning p95 target. A hidden tab holds its next check until it is shown. Then the checks stop and the screen says so; **Check again** checks at once and starts a fresh bounded run |
| `PROVISIONING_FAILED` | Setup could not be completed; contact support, who can resume it | Manual only — **Check again** — because only an operator's retry can change it |

A check is `router.refresh()`: it re-renders the route's server components, so
`TenantHostAdmission` reads the host status again and the boundary receives the
new one in place. Nothing navigates or redirects, so there is no loop; once the
status is `ACTIVE` the requested page renders, and `TenantAuthGuard` takes over
from there. A check that cannot reach Core fails admission closed like any page
load, and the root not-found screen replaces the waiting screen. Both screens
carry the language and theme toggles, as the fence screens do, because nothing
else on the page can change them.

## The release allowlist

`src/proxy.ts` (Next 16's proxy, formerly middleware) matches `/crm/:path*`
and `/core/:path*` and redirects anything outside the allowlist in
`src/lib/navigation/tenant-routes.ts` to `/unavailable`.

This is a **release boundary**, not an authorization boundary. It exists so a
bookmarked or guessed URL lands on a truthful "not available yet" screen
instead of a mock. It is not a substitute for backend authorization.

It also rejects non-`GET`/`HEAD` methods with `405`.

After phase 1 deletes the sealed routes the allowlist shrinks to the live set,
and `isSupportedTradePath` is deleted with the Trade tree — update
`src/proxy.test.ts` and `tenant-routes.test.ts` in the same commit.

## Client auth guard

`TenantAuthGuard` handles the browser-side redirect once the session bootstrap
resolves:

- loading → full-screen spinner
- unauthenticated on a private route → `replace("/login")`
- authenticated on `/login` → `replace("/")`
- `DEGRADED` (bootstrap failed, but not a definitive auth failure) → a retry
  screen that explicitly says the user has **not** been logged out

That `DEGRADED` state matters: a transient network failure must not look like
a logout, or users re-enter credentials unnecessarily.

## Provider order

```tsx
<TenantHostAdmission>          {/* server: fails closed before anything renders */}
  <I18nProvider>               {/* lang + dir, from the bootstrap script */}
    <DirectionBridge>          {/* feeds dir into Radix */}
      <ThemeProvider>
        <ToastProvider>
          <TenantAuthProvider>
            <TenantRealtimeProvider>
              <TenantAuthGuard>
                <AppShell>{children}</AppShell>
```

The order is load-bearing. I18n wraps everything that renders text; auth wraps
realtime because the realtime connection is fenced to the auth generation;
the guard is innermost so providers exist before it redirects.

## Route table

| Route | Group | Access |
| --- | --- | --- |
| `/login` | `(auth)` | public — reachable while suspended |
| `/` | `(tenant)` | authenticated |
| `/crm/leads` | `(tenant)` | `crm.leads.read` + `crm.lead_stages.read` |
| `/crm/customer-profiles` | `(tenant)` | `crm.customer_profiles.read` |
| `/crm/opportunities` | `(tenant)` | `crm.opportunities.read` + `crm.pipelines.read` |
| `/crm/lead-stages` | `(tenant)` | `crm.lead_stages.read` |
| `/crm/acquisition-sources` | `(tenant)` | `crm.acquisition_sources.read` |
| `/crm/tags` | `(tenant)` | `crm.tags.read` |
| `/crm/custom-fields` | `(tenant)` | `crm.custom_fields.read` |
| `/crm/settings` | `(tenant)` | `crm.settings.read` |
| `/crm/static-data-catalogue` | `(tenant)` | `crm.settings.read` |
| `/core/authentication` | `(tenant)` | authenticated |
| `/unavailable` | `(tenant)` | authenticated |

Full permission semantics: [../reference/permissions.md](../reference/permissions.md).

## Renames

| Old | New | Handling |
| --- | --- | --- |
| `/crm/pipeline` | `/crm/opportunities` | redirect |
| `/crm/customer-profiles` | unchanged | — |

The screen lists opportunities; a pipeline is the grouping axis selected
within it. Any changed user-facing URL gets a redirect, never a silent break.

## Route file rules

A route file may parse params, run server-only admission, pick a feature entry
point, and declare metadata. It may not hold API clients, permission logic, DTO
validation, or stateful components. See
[file-architecture.md](file-architecture.md#route-files).

## URL state

Filters, page, sort, view and branch live in the URL — see
[state.md](state.md). A filtered board must be reproducible from its link
alone.
