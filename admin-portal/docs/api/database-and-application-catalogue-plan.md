# Database Servers and Application Catalogue Documentation Plan

Status: **[Verified]**

Last source verification: **2026-08-05**

## Objective and boundary

This plan covers documentation for exactly two Admin Portal domains:

1. Database Servers, including dynamic per-Application bindings and secret-free credential operations.
2. Application Catalogue V1, including Application identity, publication,
   lifecycle, technical readiness, database policy, manifests, tiers, features,
   grants, graduated pricing, audit, and managed currency rates.

It does not authorize frontend feature implementation, backend changes, route changes, generated-route baseline acceptance, package publication, migrations, or deployment. Backend and Gateway source are the contract authority; current frontend code is evidence only for implementation status and gaps.

## Collected backend modules

### Database Servers

The public browser contract contains 15 routes under
`/api/admin/core/v1/database-servers`:

- registration and connectivity;
- list, detail, history, update, lifecycle, and deletion;
- per-server Application binding reads;
- secret-free bulk bootstrap and single-Application bootstrap;
- manual password regeneration and exact-candidate reconciliation.

Static contract data to document:

- Database Server status, SSL mode, history action, and Application binding status enums;
- server, history, connectivity, binding, bootstrap receipt, and mutation receipt projections;
- create, update, list, history, credential, SSL, parameter, and connectivity DTOs;
- all six Database Server permissions and ALL semantics for permission pairs;
- UUIDv7 idempotency for every mutation;
- password non-disclosure and `Cache-Control: no-store` boundaries;
- lifecycle, revision fencing, rotation, reconciliation, and safe-error behavior.

### Application Catalogue V1

The implemented public browser contract now contains 31 routes:

- 14 Application-root routes for list, detail, manifests, technical readiness,
  deterministic technical-identity adoption, controlled primary-component
  binding, create, update, delete, database policy, publish, activate,
  deprecate, and disable;
- 4 tier routes;
- 4 feature routes;
- 2 tier-feature grant routes;
- 2 graduated price-ladder routes;
- 2 catalogue audit routes;
- 3 managed currency-rate routes.

Static contract data to document:

- Application type, commercial mode, visibility, lifecycle, publication,
  database-access, command-operation, and billing-cycle enums;
- Application, policy, manifest, mutation receipt, tier, feature, grant,
  price-bracket, currency-rate, and audit projections;
- every Application, tier, feature, grant, pricing, audit, and currency DTO;
- `admin.applications.*`, `admin.catalog.*`, and billing-currency permissions;
- catalogue/publication/policy revision fencing, attributable publication,
  publication-aware activation and tenant selection, immutable Application
  key and stored runtime target, durable idempotency, and full replacement
  semantics;
- the distinction between public `Application` terminology and internal
  physical `modules`, `module_tiers`, and `module_id` storage names.

## Backend-to-frontend comparison

| Area | Backend contract | Current Admin Portal evidence | Documentation action |
| --- | --- | --- | --- |
| Database route client | All 15 routes exist | All 15 methods exist in the active API client | Document full contract and separate API coverage from UI coverage |
| Database UI | Full server and credential operations are available | List/create/detail/lifecycle/bulk bootstrap/rotate/reconcile render | Record missing edit, history rendering, Add Application UI, independent error states, and runtime evidence |
| Application root client | All 14 routes exist | All 14 methods exist, including deterministic technical adoption, derived primary-component binding, and publish | Document exact DTOs, permissions, revision fences, and idempotency |
| Application root UI | Publication, lifecycle, policy, readiness, and manifests are independent authorities | List/detail/create/filter/adoption/binding/publish/lifecycle/policy/readiness/manifests render; activation fails closed | Keep authenticated runtime evidence separate from source integration |
| Tiers | Four routes exist | API, hooks, and commercial control rail are integrated | Document current source integration |
| Features | Four routes exist | API, hooks, and commercial control rail are integrated | Document current source integration |
| Tier grants | Two routes exist | Complete-replacement UI is integrated | Document full-replacement semantics |
| Pricing | Two routes exist | Monthly/annual ladder UI is integrated | Document exact decimal-string behavior |
| Catalogue audit | Two routes exist | Global and Application-scoped audit UI are integrated | Document pagination and evidence boundaries |
| Currency rates | Three routes exist | List, single upsert, and batch upsert are integrated | Document exact permissions and decimal strings |
| Legacy Modules UI | `/admin/modules` public routes are removed | Old `/modules` pages are deleted; `src/types/module.ts` is unused legacy source | Remove stale documentation claims and use `/applications-catalogue` |

Current Application Catalogue evidence must still retain these boundaries:

- source integration and focused tests are not authenticated browser evidence;
- lifecycle, publication, technical readiness, and tenant-selection
  eligibility must never be collapsed into one status;
- the browser submits no runtime target, principal, component key, or contract
  version; Core derives them during fenced DRAFT adoption/binding and the UI
  treats the returned/refetched server projection as authority;
- metadata changes invalidate publication and never auto-publish;
- Arabic/English source coverage is complete; authenticated deployment and
  operational release gates stay explicit.

## Documentation implementation matrix

| Document | Required change |
| --- | --- |
| `docs/api/database-servers.md` | Cover all 15 routes with permissions, status, idempotency, exact DTOs/enums, request examples, complete success envelopes, 204 behavior, errors, security boundary, and frontend gaps |
| `docs/api/catalog.md` | Maintain one coherent Application Catalogue V1 guide covering all 31 routes and both technical and commercial halves |
| `docs/models/enums.md` | Add exact Application and binding enums; retain billing-cycle and Database Server enums |
| `docs/models/interfaces.md` | Add Application/policy/manifest/receipt models and complete Database/binding/commercial projections |
| `docs/models/dtos.md` | Add Application, Database Server, tier, feature, grant, price, currency, audit, and parameter DTO validation |
| `docs/rbac/permissions.md` | Add exact `admin.applications.*`; correct catalogue critical overlays and Database credential permissions |
| `docs/api/README.md` | Describe Application Catalogue as one domain and correct its current source status |
| `docs/frontend-integration-guide.md` | Replace `/modules` routes and false-live claims with `/applications-catalogue` and current gaps |
| `docs/audit/frontend-capability-matrix.md` | Record the source-integrated Application identity, publication, technical-readiness, audit, pricing, currency, tier, feature, and grant surfaces |
| `docs/guides/sidebar-navigation.md` | Replace stale Modules navigation with Application Catalogue navigation |

The generated Admin Core route inventory is current at 240 routes. It remains
transport evidence; controller, DTO, service, and test source remain the
behavioral authority.

## API example standard

Every route entry must show:

1. HTTP method and canonical browser path.
2. required permissions and ONE/ALL semantics;
3. HTTP success status and idempotency requirement;
4. path, query, header, and body DTOs with validation;
5. a request example, or an explicit statement that there is no body;
6. the complete real Core success envelope, including pagination `meta` when
   applicable;
7. `204 No Content` without a JSON body where applicable;
8. relevant Core and Gateway error codes and the required frontend state.

The actual Core success body is:

```ts
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
  correlationId: string;
  timestamp: string;
}
```

HTTP status is documented outside the JSON body. Core success responses do not
contain a universal `status` or `code` property, so the examples must not
invent either field. Core failures contain `statusCode` and `errorCode`;
Gateway Problem Details contain `status` and `code`.

## Execution phases

1. Collect controller, Gateway, DTO, entity, enum, service, test, and existing
   documentation evidence.
2. Compare backend routes and static contracts with active frontend code and
   Markdown.
3. Replace the Database Servers guide with the complete 15-route contract.
4. Replace the stale Modules guide with the complete 30-route Application
   Catalogue V1 contract.
5. Update shared static-model, RBAC, navigation, integration, index, and
   capability documents.
6. Search for stale `/modules` public Admin routes and false-live catalogue
   claims.
7. Run Markdown checks and targeted route/contract comparisons.

## Acceptance criteria

- All 15 Database Server and all 31 Application Catalogue routes appear once
  with exact canonical browser paths.
- Every route has method, status, permission, idempotency, request, and full
  response evidence.
- Every referenced DTO, enum, projection, and receipt is defined.
- No example exposes an Application password, encrypted credential reference,
  certificate material, or internal trusted header.
- No document calls `/api/admin/core/v1/modules` or `/modules` the active
  Application Catalogue contract.
- Pricing and tiers are explicitly retained as nested Application Catalogue
  resources.
- Current frontend API coverage, rendered UI coverage, missing functionality,
  and runtime/release evidence are stated separately.
- Documentation checks pass, or any unrelated repository-wide gate is reported
  without silently changing its baseline.
