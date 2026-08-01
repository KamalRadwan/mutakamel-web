# Tenant Portal Security

Status: **Required replacement security contract**

Last verified: **2026-07-25**

New Tenant Portal status: **Not implemented**

## Security objective

The Tenant Portal must prevent one tenant, user, browser tab, organization
scope, or subscribed module from accessing another's data or actions. It must
also preserve backend authorization, financial, and lifecycle authority rather
than recreating those decisions in the browser.

## Documents

- [Threat model](threat-model.md)
- [Tenant isolation](tenant-isolation.md)
- [Browser and session security](browser-and-session-security.md)
- [Content, files, and redirects](content-files-and-redirects.md)
- [Security verification](security-verification.md)
- [Host resolution](../architecture/tenant-host-resolution.md)
- [Authorization and entitlements](../architecture/authorization-and-entitlements.md)

## Mandatory controls

- Resolve a verified database-backed tenant host before rendering.
- Use canonical API Gateway routes only.
- Verify tenant JWT audience and current session in backend applications.
- Never trust browser tenant, actor, permission, company, branch, or channel
  headers.
- Bind every request/response to the current auth generation.
- Keep secrets and tokens out of URLs, logs, telemetry, HTML, and durable
  caches.
- Treat UI capability checks as advisory.
- Preserve backend idempotency and concurrency evidence.
- Validate uploaded/downloaded and rich content.
- Fail closed on unknown host, auth uncertainty, and tenant-context mismatch.

## Current gap

The new application currently contains only the default page/layout and has no
host gate, session client, API proxy, security headers, authorization boundary,
or security tests. This documentation defines required behavior; it does not
claim those controls are implemented.
