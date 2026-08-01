# Contract Verification Procedure

Last verified: **2026-07-25**

## Goal

Prove a frontend contract from executable source without modifying backend.

## Route verification

1. Search the appropriate Gateway route-contract file by route key, legacy
   path, or controller fragment.
2. Record method, `pathPattern`, target app, route class, idempotency,
   permissions, body/timeout classes, and retry policy.
3. Derive the canonical tenant path using `gateway-api-path.ts` and
   `upstream-app.registry.ts`.
4. Verify public-route membership separately.
5. Verify route-contract tests when the route is security/write-sensitive.

Example search:

```powershell
rg -n "tenant.auth.login|/tenant/auth/login" `
  ..\backend\mutakamel-apps\api-gateway-app\src
```

## Controller verification

1. Locate `@Controller` and exact method decorator.
2. Record route-specific guards, permissions, scope decorators, status, cache,
   headers, and DTOs.
3. Read global guard/interceptor registration for the owner app.
4. Check controller tests for metadata and negative behavior.

## DTO verification

1. Follow every nested/imported DTO and enum.
2. Record validators and transforms.
3. Check DTO tests for implicit conversion, nullable rejection, normalization,
   array limits, decimal rules, and unknown-field behavior.
4. Record exact wire values from the source enum, not docs/mocks.

## Response/domain verification

1. Trace controller to service/response mapper.
2. Identify fields deliberately omitted/redacted.
3. Identify pagination and sort allowlists.
4. Identify domain errors and state conflicts.
5. Identify transactions, idempotency, locks, ETags/versions, and async
   operation IDs.
6. Verify that tests support each important claim.

## Frontend evidence

1. Search old-web API client and page.
2. Classify live, partial, mock, or absent.
3. Record compatibility behavior that should not be ported.
4. Search tests/E2E for exercised flows.

## Documentation output

Update:

- endpoint page metadata and source list;
- canonical and upstream paths;
- request/response/validation/permission/errors;
- new portal implementation status;
- capability and route maps;
- generated coverage classification.

## Review questions

- Could a browser use the documented path today?
- Did the Gateway allowlist prove it?
- Did global guards add constraints missing from the controller?
- Are DTO fields and enum values exact?
- Is the response projection proven rather than entity-derived?
- Is a planned feature clearly labelled?
- Could this text cause an agent to bypass Gateway, tenant scope, permission,
  entitlement, or idempotency?
- Is any secret or sensitive example present?

## Validation boundary

Source and tests prove code-level behavior. They do not prove DNS, ingress,
running containers, external providers, migrations, production data, or a live
deployment unless those are verified separately.
