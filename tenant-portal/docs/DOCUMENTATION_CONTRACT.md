# Tenant Portal Documentation Contract

Status: **Current**

Last verified: **2026-08-10**

Owner: **Tenant Portal**

## Purpose

This contract prevents documentation from becoming an alternative, stale API
definition. It defines source precedence, required metadata, implementation
labels, and the minimum evidence needed before a page may be called verified.

## Source precedence

Use this order for every endpoint or behavior:

1. API Gateway typed route contracts for the browser-visible method, route
   ownership, route class, idempotency, size/timeout policy, and required
   Gateway permissions.
2. The owning backend controller and applied global/module guards for upstream
   route, authentication, authorization, parameters, and HTTP status.
3. Request DTOs, response types, contracts, entities, services, and tests for
   validation, wire values, response shape, state transitions, and errors.
4. Current `tenant-portal` source and tests for currently exercised frontend
   behavior.
5. Explicitly dated historical consolidated-frontend evidence, when the
   referenced artifact is actually available. The absent
   `../backend/mutakamel-apps/mutakamel-web-app` workspace cannot prove current
   or live behavior.
6. Tenant Portal Markdown and examples.
7. Frontend mocks, fixtures, labels, and comments, which are never contract
   evidence.

Installed immutable package artifacts can differ from package source. When a
runtime app consumes a published `@mutakamel/*` contract, record the installed
version and verify its built declarations before relying on unreleased source.

## Required page metadata

Every API page must state:

- status: `verified-current`, `partial`, `stale`, `planned`, or `deprecated`;
- last source-verification date;
- owning backend app;
- canonical browser prefix and routes;
- controller-relative upstream path;
- new Tenant Portal status: `not-started`, `partial`, `live`, or `tested`;
- exact source paths inspected;
- whether the page is hand-written or generated.

## Required endpoint evidence

For each endpoint or coherent route family, record:

- method and canonical browser path;
- route key when it materially helps drift detection;
- access class and required permission or owner guard;
- tenant, company, branch, channel, team, or own/all scope;
- path, query, header, and body validation;
- enum values as exact case-sensitive wire values;
- success status and response data shape;
- relevant response envelope and pagination metadata;
- stable errors or state conflicts proven by source;
- idempotency, retry, caching, size, timeout, upload, or streaming behavior;
- asynchronous command/polling behavior;
- security or secret-handling restrictions;
- a safe example when it adds implementation value.

Do not infer undocumented fields from entity columns or frontend mock objects.
If response serialization is not provable, name the response type/source and
mark the field-level shape as unresolved.

## Status meanings

| Status | Meaning |
| --- | --- |
| `verified-current` | Checked against the current Gateway and owning source on the stated date |
| `partial` | Some routes or field-level details remain unverified |
| `stale` | The page conflicts with current source and must not guide implementation |
| `planned` | Accepted target behavior with no complete runtime implementation |
| `deprecated` | Compatibility-only behavior that new Tenant Portal code must not adopt |

Backend and frontend status are separate. A backend route can be
`verified-current` while the new Tenant Portal remains `not-started`.

## Current versus target behavior

Never mix current and planned behavior in one unlabelled table. Use explicit
sections:

- **Current backend**
- **Current replacement app**
- **Migration target**
- **Known gap**

The current browser topology is the split frontend workspace, including this
standalone `tenant-portal`. The previously documented consolidated
`mutakamel-web-app` is absent from the current checkout; retained references
are dated historical replacement context only, not current source, runtime
evidence, final architecture, or an API source of truth.

## Links and paths

- Use repository-relative Markdown links for files inside `tenant-portal`.
- Do not use `file:///` links.
- Show cross-repository backend paths in code formatting relative to
  `C:\mutakamel.ai\frontend`, beginning with `../backend/`.
- Prefer source symbols and paths over fragile line-number references.

## Generated content

Files under `docs/generated/` must:

- contain a generated-content warning;
- name the generator or extraction method;
- record frontend and backend source revisions;
- never contain hand-written architectural decisions;
- be reproducible without modifying backend source.

## Definition of done for one documented feature

- All Gateway-exposed routes for the feature are accounted for.
- Controller, guards, DTOs, enums, response behavior, and tests were inspected.
- Canonical browser paths are separated from upstream paths.
- Permission, tenant scope, entitlement, and failure states are explicit.
- Current frontend status is truthful.
- At least one valid and one failure example exist when requests are nontrivial.
- Links and referenced source paths resolve.
- No secret, production credential, personal data, or usable token appears.
