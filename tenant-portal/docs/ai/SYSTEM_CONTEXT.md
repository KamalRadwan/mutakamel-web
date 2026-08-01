# Compact System Context

Last verified: **2026-07-25**

## One-minute model

- Tenant Portal replaces tenant routes from the old combined web app.
- Host determines tenant context; token tenant must match host tenant.
- Browser calls Gateway only.
- Canonical API roots are Core, CRM, and Trade under the `tenant` master.
- Core owns auth, identity, workspace, access policy, billing, notifications,
  templates, activities, and tenant-visible provisioning/update state.
- CRM owns CRM resources and applies branch/own/team/all scope.
- Trade owns Trade resources and applies company/branch/channel operating scope.
- Worker performs background work; the browser polls the command owner.
- Module subscription, feature tier, user seat, permission, organization scope,
  and resource state all affect capability.
- Responses carry correlation IDs in app-specific bodies and/or headers.
- New portal is currently a bootstrap shell. Documentation is not
  implementation evidence.

## Protected request

```text
host admission
-> session generation
-> Next same-origin proxy
-> Gateway route/JWT/audience/session watermark/policy
-> trusted context injection
-> owner-app identity/session/tenant/permission/scope/subscription guards
-> DTO/domain validation
-> app-specific response contract
-> reject stale browser generation
```

## Public tenant request

Public auth still needs a valid tenant host. Suspended tenants can use the exact
approved pre-auth routes but cannot use ordinary tenant APIs.

## Key failure distinctions

| Condition | Meaning |
| --- | --- |
| `401` | Authentication/session is missing, invalid, stale, or mismatched |
| `403` | Authenticated but not authorized |
| `404` | Resource/route absent or intentionally hidden |
| `409` | Current state conflicts with command |
| `429` | Rate limited |
| `502/503/504` | Edge/upstream unavailable or timeout |
| Module absent | Tenant is not entitled |
| Seat absent | User cannot enter subscribed module |
| Scope absent | Company/branch/channel/team/resource is outside actor grant |

## Do not guess

Do not guess canonical route, DTO, enum, permission, response, error,
idempotency, cache policy, module readiness, or old-web implementation status.
