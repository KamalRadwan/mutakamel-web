# Tenant Portal Glossary

Last verified: **2026-08-10**

| Term | Meaning |
| --- | --- |
| Tenant | Customer workspace and isolation boundary |
| Tenant host/FQDN | Verified hostname mapped to one tenant |
| Master | Canonical Gateway audience namespace: `admin`, `tenant`, or `partner` |
| Target app | Gateway owner name such as `core`, `crm`, or `trade` |
| Canonical path | `/api/<master>/<app>/v<version>/*` browser/API address |
| Upstream path | Versioned controller path used between Gateway and owner app |
| Route contract | Typed Gateway allowlist/policy entry |
| Route class | Gateway transport/security category such as public, authenticated, or write-sensitive |
| Actor | Authenticated tenant user performing a request |
| Auth Session (`sid`) | Durable independently revocable login/device session that owns deadlines, counters, and a reusable opaque credential fingerprint |
| Auth epochs | Exact `securityEpoch`, `authorizationVersion`, `profileVersion`, and per-session `sessionEpoch` values carried by an access JWT and rechecked against PostgreSQL |
| Session generation | Frontend identifier binding browser work to one adopted login |
| Trusted context | Gateway-injected tenant/actor/organization/session headers |
| Access policy | Core projection of tenant lifecycle, subscriptions, features, and module readiness |
| Entitlement | Tenant subscription/tier allows a feature/module |
| Seat | Assignment allowing a specific user to use a subscribed module |
| Permission | Exact RBAC action string |
| Scope | Resource boundary such as own/team/all, company, branch, or channel |
| Operating context | Trade company/branch/channel selection validated for an actor |
| Control plane | Core-managed tenant, catalogue, billing, placement, and governance data |
| Tenant database | Tenant-specific application data store used by Core/CRM/Trade |
| Outbox | Persisted event/command record published after/with business commit |
| Worker | Background execution application; not a tenant browser API |
| Operation/attempt/job | Durable asynchronous work identity used for polling |
| Idempotency key | UUIDv7 identifying one exact user command intent |
| Exact replay | Same actor, key, normalized payload, and operation |
| Ambiguous outcome | Request may have reached server but client did not receive a result |
| ETag/version pin | Observed concurrency evidence required by a later write |
| Cursor | Opaque pagination evidence bound to a query/order |
| Envelope | Canonical success/error wrapper around HTTP payload |
| Correlation ID | UUID trace identity safe to provide to support |
| Current | Proven from executable source on the verification date |
| Planned | Accepted target without complete runtime behavior |
| Old web | Tenant implementation inside backend `mutakamel-web-app` being replaced |
| New portal | Standalone `frontend/tenant-portal` application |
