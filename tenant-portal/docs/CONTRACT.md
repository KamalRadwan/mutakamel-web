# Documentation Contract

Last rebuild: **2026-08-27**

This file exists to stop documentation from quietly becoming a second, wrong
API definition. It defines what outranks what, what every page must state, and
what "verified" is allowed to mean.

## Source precedence

When two sources disagree, the higher one wins and the lower one gets fixed.

```text
1. API Gateway typed route contracts
     ../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/
     Owns: browser-visible method and path, route class, idempotency,
     ownership, transport policy.

2. The owning backend controller and its guards
     core-app / crm-app / trade-app
     Owns: upstream route, required permissions, parameters, HTTP status.

3. Request DTOs, response types, entities, services, and their tests
     Owns: validation rules, exact enum wire values, response shape,
     state transitions, error codes.

4. Installed @mutakamel/* package declarations
     e.g. crm-app/node_modules/@mutakamel/crm-app-common/dist/**/*.d.ts
     Owns: shared enums and permission catalogues actually compiled into
     the running service. Record the version you read.

5. Current tenant-portal source and its tests
     Owns: what the frontend does today. Not what it should do.

6. This documentation set.

7. Mocks, fixtures, comments, and UI labels — never contract evidence.
```

A frontend type file is a **guess** until checked against levels 1–4. A type
declaring a field does not mean a controller sends it.

## Every API page must state

- **Status** — one of `verified`, `partial`, `planned`, `deprecated`.
- **Last source verification** date.
- **Owning backend app**.
- **Canonical browser path** and the controller-relative upstream path.
- **Portal status** — `not-started`, `partial`, `live`, `tested`.
- **Exact source paths inspected**.

Backend status and portal status are independent. A route can be
`verified` upstream while the portal is `not-started`.

## Every endpoint entry must record

- Method and canonical browser path
- Gateway route key and route class
- Required permission, and whether scope suffixes apply
- Tenant / company / branch / owner scope
- Path, query, and body validation
- Enum values as **exact case-sensitive wire strings**
- Success status and response shape
- Pagination and envelope shape
- Proven error codes and state conflicts
- Idempotency and retry behavior

If a response field's shape cannot be proven from source, name the response
type and mark the field **unresolved**. Never derive a shape from a database
entity or a frontend mock.

## Status meanings

| Status | Meaning |
| --- | --- |
| `verified` | Checked against Gateway + owning source on the stated date |
| `partial` | Some routes or field shapes remain unverified |
| `planned` | Accepted target with no complete implementation |
| `deprecated` | Compatibility-only; new code must not adopt it |

## Evidence levels

Do not let these blur together. Each proves strictly less than the next.

| Level | Proven by | Does **not** prove |
| --- | --- | --- |
| Route inventory | Gateway contracts + ownership rules | DTO fields, controller behavior |
| Contract guide | Controller, guards, DTOs, enums, tests | That the portal implements it |
| Type-validated | `tsc --noEmit` green | Runtime correctness |
| Unit-tested | `vitest run` green | Integration or authenticated behavior |
| Live authenticated | Driving the running app in a real session | Behavior after future drift |

Never write "live" when you mean "compiles".

## Generated content

Files under `docs/generated/` must:

- carry a generated-file warning;
- name their generator;
- record frontend and backend revisions;
- be reproducible without modifying backend source;
- **never be hand-edited.**

Regenerate with `pnpm docs:routes`.

## Links and paths

- Repository-relative Markdown links inside `tenant-portal`.
- No `file:///` links.
- Backend paths shown in code formatting relative to
  `C:\mutakamel.ai\frontend`, beginning `../backend/`.
- Prefer symbol names over line numbers — line references rot.

## Definition of done for one documented feature

- Every Gateway-exposed route for the feature is accounted for.
- Controller, guards, DTOs, enums, response behavior and tests were inspected.
- Canonical browser paths are separated from upstream paths.
- Permissions, scope and failure states are explicit.
- Portal status is truthful.
- One valid and one failure example exist where the request is non-trivial.
- Every link resolves.
- No secret, credential, personal datum, or usable token appears anywhere.

## When documentation and source disagree

Stop using the documented claim immediately. Verify current source, fix the
document in the same change, and — if the gap is in the backend — record it in
[build/OPEN-QUESTIONS.md](build/OPEN-QUESTIONS.md). **Never edit backend source
to resolve a frontend problem.**
