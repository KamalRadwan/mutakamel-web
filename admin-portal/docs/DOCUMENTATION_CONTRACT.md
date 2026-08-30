# Admin Portal Documentation Contract

Status: **[Verified]**

Last source verification: **2026-07-30**

Owner: **Admin Portal**

## Purpose

This contract keeps the documentation subordinate to current source. It also
separates backend capability, frontend implementation, test/build evidence,
authenticated runtime evidence, and deployment readiness.

## Source precedence

Use this order whenever sources disagree:

1. API Gateway typed route contracts for the browser-visible method, path,
   route class, idempotency, transport policy, and permission metadata.
2. The owning Core or Worker controller and its global/module guards.
3. DTOs, response contracts, services, entities, repositories, and tests for
   validation, wire values, projections, transitions, and stable errors.
4. Current Admin Portal API client, types, hooks, components, and tests for
   frontend behavior.
5. Markdown under `docs/`.
6. Mock objects, labels, fixtures, and comments, which are never API evidence.

Core source is authoritative if a frontend type or this documentation differs.
Backend files are read-only in Admin Portal work.

## Canonical browser ownership

- Core Admin: `/api/admin/core/v1/*`
- Worker Admin backup/restore: `/api/admin/worker/v1/*`
- API Gateway is the only browser edge.
- Controller-relative `/admin/*` and upstream `/api/v1/admin/*` paths are not
  frontend URLs.

## Frontend work labels

| Label | Meaning |
| --- | --- |
| `DONE` | A real API is integrated with substantially correct source behavior |
| `PARTIAL` | Some real API behavior exists, but important states or actions are absent |
| `BROKEN` | The frontend uses a nonexistent/wrong contract or reports non-authoritative success |
| `MISSING` | Gateway/Core capability exists with no frontend implementation |
| `GATED` | Source exists but safe exposure, release, runtime, or deployment evidence is missing |
| `REFACTOR` | Behavior exists but its typing, errors, permissions, state model, or tests are weak |

These labels describe source integration, not deployment.

## Evidence levels

Every completion report must state each level independently:

| Evidence | What it proves |
| --- | --- |
| Source-complete | Requested source and documentation are present |
| Unit-tested | Relevant automated tests passed |
| Type-validated | TypeScript validation passed |
| Lint-validated | Zero-error/warning lint command passed |
| Build-validated | Production frontend build completed |
| Live authenticated | A real authorized browser/API session exercised the flow |
| Deployment-verified | The released version is running in its target environment |
| Design-target approved | A future-state visual/interaction contract was reviewed; it does not prove implementation |
| UI runtime verified | Representative workflows were exercised for theme, direction, viewport, and interaction state |
| Accessibility smoke-tested | Keyboard, focus, names, announcements, zoom, contrast, and screen-reader smoke checks were recorded |
| Responsive verified | Required widths and coarse-pointer behavior were exercised without hidden or obscured capability |

Never use source, tests, or a build as proof of live authentication or
deployment.

Likewise, do not use lint, a static RTL utility guard, screenshots, or an
approved design target as proof of keyboard, assistive-technology, responsive,
or authenticated-runtime conformance.

## Required API evidence

Each API page or coherent route family should record:

- owning app and canonical browser path;
- method, route class, and required permissions;
- whether multiple permissions use ALL or ANY semantics;
- path, query, header, and request-body validation;
- exact case-sensitive enum values;
- response status, envelope, pagination, and safe public projection;
- stable validation, forbidden, conflict, and unavailable behavior;
- idempotency/retry, concurrency, polling, streaming, or `204` handling;
- secret-handling and operator-safety restrictions;
- current frontend label and source evidence;
- source paths and verification date.

## Generated content

Files under `docs/generated/` are source-derived inventories. They must:

- contain a generated warning;
- identify their generator and source revisions;
- be reproducible without editing backend source;
- contain transport evidence only, not hand-written implementation claims.

The generated Admin inventory is exhaustive for the 240 Core Admin Gateway
routes. Domain guides add DTO and behavior context.

## Definition of done for one documented feature

- All Gateway routes in scope are accounted for.
- Controller/guards, DTOs, response behavior, and relevant frontend source were
  inspected.
- Browser and upstream paths are separated.
- Permissions, idempotency, data states, decimal/byte handling, and async
  behavior are explicit.
- Current frontend status is truthful.
- No mock is presented as live data.
- All local documentation links resolve and the generated inventory is current.

For a design-system or UI-quality change, definition of done additionally
requires the applicable target contract, current-source divergence, bilingual
and theme behavior, focus/keyboard behavior, responsive widths, operational
states, and evidence level to be recorded independently.
