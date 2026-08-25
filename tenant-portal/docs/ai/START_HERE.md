# AI Start Here

Last verified: **2026-08-10**

## Mission

Build the standalone `tenant-portal` in the current split frontend workspace.
The previously inventoried consolidated
`../backend/mutakamel-apps/mutakamel-web-app` path is absent from the current
checkout; references to it are dated historical migration context, not current
source or runtime evidence.

Do not modify backend files. Read them to verify contracts.

Visual design documentation is outside scope. Application behavior,
accessibility semantics, bilingual behavior, API correctness, validation,
security, failure states, and tests are in scope.

## Read order before coding

1. `tenant-portal/AGENTS.md`
2. Relevant Next.js 16 guide under `tenant-portal/node_modules/next/dist/docs/`
3. `docs/DOCUMENTATION_CONTRACT.md`
4. `docs/ai/SOURCE_OF_TRUTH.md`
5. `docs/ai/SYSTEM_CONTEXT.md`
6. `docs/app/replacement-scope.md`
7. `docs/app/application-architecture.md`
8. The relevant API page and static data
9. `docs/security/README.md`
10. `docs/validation/README.md`
11. `docs/ai/IMPLEMENTATION_PLAYBOOK.md`
12. `docs/ai/TEST_MATRIX.md`

## Non-negotiable rules

- Tenant Portal runs on port `5002`.
- Browser API calls use `/api/tenant/{core|crm|trade}/v1/*`.
- API Gateway is the only public backend edge.
- Unknown/unverified tenant hosts fail before UI rendering.
- Suspended tenant admins retain approved pre-auth/login access.
- Core owns tenant identity and control-plane foundation.
- CRM and Trade independently authorize their resources.
- Worker is never a direct Tenant Portal HTTP API.
- Never trust user-provided tenant, actor, permission, company, branch, channel,
  service, session, or forwarded-host headers.
- Never invent DTO fields, enum values, permissions, response shapes, or errors.
- Never treat old-web mocks/comments as contracts.
- Never calculate financial, entitlement, permission, or lifecycle truth in the
  browser.
- Preserve exact decimal strings, UUIDs, cursors, ETags, version/checksum pins,
  and idempotency keys.
- Do not report a feature live until its server-backed behavior and tests exist
  in the new portal.

## Source precedence

```text
Gateway typed route contract
-> owning controller and global/module guards
-> DTOs, response/service/contracts, entities, tests
-> current tenant-portal source/tests
-> explicitly dated historical consolidated-frontend evidence, if available
-> Tenant Portal docs
-> mocks/comments
```

See [SOURCE_OF_TRUTH.md](SOURCE_OF_TRUTH.md).

## Fast feature workflow

1. Find the route in Gateway contracts.
2. Convert it to the canonical tenant browser namespace.
3. Read controller, guards, DTOs, service/response types, and tests.
4. Check module entitlement and organization scope.
5. Check current `tenant-portal` source/tests, then consult explicitly dated
   historical consolidated-frontend evidence only when it is available.
6. Update/verify the API page.
7. Create feature API/types/schema/hook/page code using shared boundaries.
8. Add success, invalid, unauthenticated, forbidden, conflict, and unavailable
   tests as applicable.
9. Update capability/route status and AI known gaps.
10. Run the validation matrix.

## If documentation conflicts

Stop using the conflicting claim. Verify current source, fix the documentation
in the same frontend change, and record a backend gap without editing backend.
