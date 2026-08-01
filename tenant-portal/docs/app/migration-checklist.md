# Tenant Portal Migration Checklist

Status: **Current**

Last verified: **2026-07-25**

Use this checklist for every feature moved from
`mutakamel-web-app` to `tenant-portal`.

## Discovery

- [ ] Identify old routes, feature files, API clients, tests, and local storage keys.
- [ ] Identify every current Gateway route used or required.
- [ ] Verify controller, guards, DTOs, response types, services, and tests.
- [ ] Record backend, Gateway, old-web, new-portal, and documentation status.
- [ ] Separate live behavior from mocks, fallbacks, and future documentation.

## Contract

- [ ] Use `/api/tenant/{core|crm|trade}/v1/*`.
- [ ] Document upstream paths separately.
- [ ] Validate only documented request fields.
- [ ] Preserve exact enum values, decimal strings, IDs, and timestamps.
- [ ] Define response-envelope and pagination handling.
- [ ] Define stable error, conflict, rate-limit, and retry behavior.
- [ ] Define UUIDv7 idempotency-key lifetime where required.
- [ ] Define tenant, organization, permission, seat, and entitlement scope.

## Security

- [ ] Admit only a verified tenant host.
- [ ] Bind requests to the current auth generation.
- [ ] Strip or ignore caller-controlled trusted-context headers.
- [ ] Keep tokens and secrets out of URLs, logs, telemetry, and durable browser storage.
- [ ] Treat UI capability checks as advisory; preserve backend authorization.
- [ ] Test cross-tenant, cross-company, cross-branch, and unauthorized identifiers.
- [ ] Validate redirects, downloads, uploads, and rich content.

## Application

- [ ] Keep route modules thin.
- [ ] Place API/schema/hook logic in the owning feature.
- [ ] Use the shared API and error boundary.
- [ ] Represent loading, empty, forbidden, not-found, conflict, partial, and unavailable states.
- [ ] Support English and Arabic data/copy behavior and LTR/RTL semantics.
- [ ] Do not calculate financial, permission, or lifecycle truth locally.
- [ ] Handle unknown enum values without crashing.

## Validation

- [ ] Unit-test request adapters, schemas, permissions, and state transitions.
- [ ] Integration-test the shared Gateway client and refresh coordination.
- [ ] Browser-test success and important negative flows.
- [ ] Run Tenant Portal lint, typecheck, tests, and production build.
- [ ] Verify through the Gateway/API, not only mocks or rendered UI.
- [ ] Update API, AI, static-data, examples, and capability documentation.

## Cutover

- [ ] Confirm every old route is replaced, redirected, or explicitly retired.
- [ ] Confirm monitoring and correlation IDs are preserved.
- [ ] Confirm no mock/fallback can report false success.
- [ ] Confirm rollback routing remains possible.
- [ ] Mark the capability `tested` only after replacement acceptance.
