# AI Start Here

Last source verification: **2026-08-12**

## Mission

Maintain `admin-portal` source parity with all 240 browser-visible Core Admin
APIs while preserving working behavior and reporting authenticated-runtime,
deployment, Worker, mobile-auth, and release gates truthfully.

Do not edit backend files from an Admin Portal task.

## Read order

1. `admin-portal/AGENTS.md`
2. Relevant Next.js 16 documentation under `node_modules/next/dist/docs/`
3. [Documentation contract](../DOCUMENTATION_CONTRACT.md)
4. [Source of truth](SOURCE_OF_TRUTH.md)
5. [System context](SYSTEM_CONTEXT.md)
6. [HTTP and error contract](../architecture/http-and-error-contract.md)
7. [Permissions, idempotency, and state](../architecture/permissions-idempotency-and-state.md)
8. [Frontend capability matrix](../audit/frontend-capability-matrix.md)
9. The relevant [API domain guide](../api/README.md)
10. [Known gaps](KNOWN_GAPS.md)
11. [Implementation playbook](IMPLEMENTATION_PLAYBOOK.md)
12. [Test matrix](TEST_MATRIX.md)

## Non-negotiable rules

- Admin Portal runs on port `5001`.
- Browser calls use `/api/admin/core/v1/*` or the explicitly documented Worker
  prefix; never call Core directly.
- Protected requests use the shared client and `credentials: "include"`; the
  server infers the browser channel from trusted request metadata.
- Never store JWT access or refresh tokens in browser-readable storage.
- Preserve Core success envelopes and normalize Core/Gateway errors without
  discarding `correlationId`.
- Keep decimal money and byte strings as strings.
- A `+` permission list means ALL. Use ANY only where the route contract says
  ANY.
- A `403` is forbidden, never an empty collection.
- One exact write intent owns one UUIDv7 idempotency key across exact retries.
- Do not invent fields, enum values, prices, IDs, statuses, or successful
  transitions.
- For `202`, track the returned operation; for `204`, expect no response body.
- Nested tenant areas load independently according to their own permission.
- Backend authorization remains authoritative.
- Do not expose Storage migration or Admin Realtime as ready while their
  documented gates remain open.

## Fast feature workflow

1. Find the method/path in the generated Gateway inventory.
2. Read the owning controller, guards, DTOs, response/service code, and tests.
3. Inspect the current frontend route, hook, types, permissions, and mocks.
4. Update the domain API guide if source has drifted.
5. Implement a typed domain client and explicit state machine.
6. Add exact permission and idempotency behavior.
7. Add success and negative regression tests.
8. Run docs, unit, type, lint, and build validation.
9. Report live authenticated and deployment status separately.
