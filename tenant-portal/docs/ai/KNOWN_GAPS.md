# Known Gaps

Last verified: **2026-07-25**

Update this page only with evidence-backed gaps. Resolve entries by linking the
implementing files/tests and changing capability status.

## New Tenant Portal

- Root source remains the default Next bootstrap.
- Server-side tenant host admission is absent.
- Same-origin Gateway proxy is absent.
- The canonical client now provides cookie credentials, normalized Core/Gateway
  auth errors, UUIDv7 intent preservation, and one safe refresh replay; full
  per-app Core/CRM/Trade success parsing remains incomplete.
- Tenant login, `/auth/me` bootstrap, reusable refresh coordination, logout,
  cross-tab session events, and self-session list/revoke are source-integrated;
  authenticated runtime verification remains open.
- Public invite/reset routes are absent.
- `/auth/me` identity/permission bootstrap is integrated; organization,
  module, seat, and entitlement bootstrap remain absent.
- Core, CRM, and Trade feature routes are absent.
- Unit, integration, and browser-test runners are absent.
- Typecheck and documentation drift/link checks exist, but no application
  contract tests exist yet.
- Production security headers/CSP ownership is not implemented or verified.
- Deployment/cutover routing from old web to port `5002` is not verified.

## Documentation verification

- The pre-audit API pages were replaced with source-reviewed domain guides.
- The generated inventory covers 561 current tenant Gateway routes and
  `docs:routes:check` detects contract drift.
- Field-level response shapes that are not exported/mapped explicitly must be
  marked unresolved rather than entity-derived.
- Gateway and backend working trees are currently dirty; documentation must
  record the exact working-tree verification context, not imply a released
  deployment.

## Platform boundaries

- Legacy `/api/v1/*` compatibility exists; new portal must not depend on it.
- Realtime is accepted target documentation but not a running service.
- Backend package source can differ from exact locked/published artifacts.
- Production deployment, DNS, ingress, provider, and database state are not
  proven by source review.
- Some backend LLD documents contain target/future behavior; executable source
  must be rechecked.

## Verified API gaps and ambiguities

- Core implements business-letter listing, but Gateway does not expose the
  list route. A replacement list screen is blocked.
- Gateway declares two template assignment production-readiness routes with no
  matching Core controller handlers. They are unavailable and must not be
  called.
- Five CRM controller routes used by the old web app are absent from Gateway:
  customer-profile capabilities/contact creation, lead capabilities/contact
  options, and dashboard widget drill-down.
- CRM's advertised attachment policy conflicts with the actual upload/storage
  allowlist; implementation must follow the verified upload route until the
  backend contract is reconciled.
- Four Trade UOM CRUD controller routes are not Gateway-exposed. Only the
  routed UOM catalogue read is a Tenant Portal API.
- Several response/input projections are intentionally unresolved where source
  exposes opaque objects rather than a public DTO. Domain API pages name each
  case; do not derive schemas from entities or mocks.

## Replacement questions to resolve during implementation

- Exact final URL for Core workspace features absent from the old route tree.
- Whether every old consolidated `/trade/[view]` screen becomes an explicit
  route or a stable section route.
- Cutover and rollback ownership at ingress.
- Runtime schema library, server-state library, and browser-test framework,
  selected after checking workspace conventions and current Next compatibility.

## Not gaps

The following are intentional:

- no backend edits from this project;
- no direct Worker tenant HTTP API;
- no visual design documentation;
- no claim of live deployment verification.
