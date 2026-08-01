# Tenant Portal Threat Model

Status: **Current**

Last verified: **2026-07-25**

## Protected assets

- tenant business and personal data;
- identity, session, invite, reset, and refresh material;
- permission, role, company, branch, channel, and module assignments;
- invoices, payments, wallet, pricing, and financial evidence;
- templates, documents, attachments, and generated files;
- audit/correlation evidence;
- provisioning, update, workflow, and recovery commands;
- backend service credentials and trusted headers.

## Trust boundaries

1. Browser and untrusted user input.
2. Tenant Portal server/runtime.
3. Ingress and API Gateway.
4. Core, CRM, and Trade application guards.
5. Per-tenant/control-plane databases.
6. RabbitMQ and Worker background execution.
7. External email, payment, storage, DNS, and rendering providers.

## Principal threats

| Threat | Required mitigation |
| --- | --- |
| Host-header tenant confusion | Trusted proxy configuration, strict normalization, database-backed FQDN resolution, token-host match |
| Cross-tenant IDOR | Backend tenant predicates and current trusted context; negative tests |
| Cross-branch/company/channel access | Guard and repository scope checks; never body-only scope |
| JWT audience confusion | Canonical master-to-audience binding in Gateway and owner apps |
| Stale/revoked session | Database session version plus monotonic rejection watermark |
| Refresh/login race | Generation-scoped session and coordinated refresh |
| Caller-forged trusted headers | Strip at Next/Gateway; inject only verified context |
| Permission or entitlement bypass | Independent owning-app checks and subscription/seat enforcement |
| Duplicate financial/lifecycle writes | Durable idempotency, exact replay fingerprints, concurrency locks |
| XSS/token theft | No unsafe HTML, restrictive CSP, narrow token exposure, dependency hygiene |
| Open redirect | Relative/allowlisted destinations; reject credential-bearing or external targets |
| Malicious upload/download | Size/type/key validation, content disposition, active-content isolation |
| Formula/CSV injection | Escape spreadsheet formula prefixes in exported user content |
| SSRF through URLs/templates | Backend allowlists; frontend never claims URL validation is sufficient |
| Sensitive error/log leakage | Stable safe errors, correlation ID, redaction |
| Clickjacking | Frame policy; permit only explicitly reviewed embedded content |
| Cache data leak | `no-store` for tenant/security/financial data and correct shared-cache headers |
| Supply-chain compromise | Lockfile review, exact packages, vulnerability and integrity checks |

## Abuse cases to test

- Send a valid token on another verified tenant host.
- Change tenant/company/branch/channel IDs in query/body/path.
- Reuse another user's resource UUID.
- Use a CRM-only account against Trade routes.
- Use a subscribed module without an assigned user seat.
- Replay a write key with changed body or actor.
- Refresh after logout-all or account replacement.
- Inject `x-tenant-id`, `x-user-id`, `x-permissions`, `x-forwarded-host`, or
  `x-service-token` from the browser.
- Load a protected page on unknown, unverified, suspended, or inactive hosts.
- Upload active SVG/HTML or a filename with path/control characters.
- Supply external redirect, image, webhook, template, or download URLs.
- Return malformed success/error envelopes and unknown enum values.

## Risk acceptance

Any accepted security exception must be recorded in `docs/ai/DECISIONS.md`
with owner, scope, expiration, mitigation, and test. A mock, TODO, or hidden UI
element is not a mitigation.
