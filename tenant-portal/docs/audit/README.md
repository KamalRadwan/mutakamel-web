# Documentation Audit Evidence

Status: **current**

Last verified: **2026-07-25**

This directory records what was inspected and what kind of completeness has
actually been proven. It prevents route enumeration, semantic contract review,
frontend replacement, and live deployment verification from being reported as
the same thing.

## Evidence levels

| Level | Proven by | Does not prove |
| --- | --- | --- |
| Gateway route inventory | Typed Gateway contracts plus canonical ownership rules | DTO fields, controller behavior, frontend use |
| Semantic API guide | Gateway, controller/guards, DTOs/enums, service/response/tests | New Portal implementation or deployment |
| Old-web replacement inventory | Old route tree, feature clients, and tests | Correctness of old code or target architecture |
| New Portal implementation | Source plus unit/integration/browser tests | A live production rollout |
| Deployment verification | Running ingress/API/application checks | Future drift after the verification time |

## Current evidence

- [Generated tenant route inventory](../generated/tenant-api-routes.md) accounts
  for every current Gateway route owned by the tenant master for Core, CRM, and
  Trade.
- [API index](../api/README.md) maps those routes to semantic domain guides.
- [Replacement inventory](replacement-inventory.md) records the old-web and
  new-portal source baseline.
- [Coverage matrix](coverage-matrix.md) separates route, semantic, and
  implementation coverage.

## Reproduce

From `tenant-portal`:

```powershell
npm run docs:routes
npm run docs:check
```

`docs:routes` reads backend files only. It never changes backend source.

## Revision note

The exact frontend and backend revisions used for the generated extraction are
embedded in
[tenant-api-routes.json](../generated/tenant-api-routes.json). A `+dirty`
suffix means the source tree had tracked working-tree changes and the
inventory reflects that working tree, not only the named commit.
