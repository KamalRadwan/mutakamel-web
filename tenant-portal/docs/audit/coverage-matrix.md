# Documentation and Replacement Coverage

Status: **current**

Last verified: **2026-07-25**

## API route coverage

| Owning app | Gateway tenant routes | Generated inventory | Semantic guides | New Portal |
| --- | ---: | --- | --- | --- |
| Core | 198 | Complete | Source-reviewed domain pages | Not started |
| CRM | 137 | Complete | Source-reviewed domain pages | Not started |
| Trade | 226 | Complete | Source-reviewed domain pages | Not started |
| Worker | 0 direct tenant routes | Correctly excluded | Async boundary documented | Never a direct browser client |
| **Total** | **561** | **Complete** | See caveats below | **Not started** |

The count is generated from the current typed Gateway route contracts and the
tenant-master ownership rules. See the
[full route table](../generated/tenant-api-routes.md).

Of the 561 tenant-master routes, 559 are Tenant Portal APIs. Core's public FQDN
validation route is a platform-validation endpoint, and the public payment
webhook is an external callback; both remain inventoried but are explicitly
marked `DO_NOT_CALL`.

## What “semantic guides” means

The hand-written Core, CRM, and Trade pages inspect current controllers,
guards, DTOs/enums, service/response behavior, tests, and old-web clients where
useful. They intentionally mark unresolved field-level projections or
controller-only gaps instead of inventing a shape.

The generated table remains the exhaustive method/path index. Domain guides
group coherent operations so AI agents do not need one Markdown file per
route.

## Cross-cutting coverage

| Concern | Documentation | Status |
| --- | --- | --- |
| Replacement boundary and old routes | `docs/app/` and replacement audit | Current |
| Canonical request lifecycle | `docs/architecture/` | Current |
| Authentication/session/host | Architecture, Core API, security, examples | Current backend contract; frontend absent |
| Request/response/state validation | `docs/validation/`, `docs/dtos.md` | Current conventions; endpoint pages own narrow rules |
| Permissions/scopes/features | `docs/rbac-matrix.md`, authorization architecture | Current catalogue and guard model |
| Static wire data | `docs/static-data.md` plus domain static-data pages | Current verified set |
| Security | `docs/security/` | Threat and implementation requirements documented |
| Async operations | Architecture and examples | Browser ownership documented; no direct Worker API |
| AI build context | `docs/ai/` and root `AGENTS.md` | Current |
| Safe examples | `docs/examples/` plus domain examples | Current, non-secret |
| Visual design | Excluded by scope | Intentionally absent |

## Known limitations

- Source review is not live deployment verification.
- The backend and frontend source trees were dirty at extraction time; generated
  metadata records that fact.
- A generated route entry proves Gateway exposure and transport policy, not
  every response field.
- Core Gateway/controller mismatches, five controller-only CRM gaps, four
  unrouted Trade UOM CRUD routes, and source ambiguities are recorded in the
  owning API indexes.
- No application capability is replacement-complete until server-backed source
  and proportional tests exist in this new Portal.
