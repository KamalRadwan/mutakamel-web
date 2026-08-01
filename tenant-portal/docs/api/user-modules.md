# Tenant user-module assignments API

> **Contract status:** Current
> **Last verified:** 2026-07-25
> **Backend owner:** Core (`core-app`)
> **Canonical browser prefix:** `/api/tenant/core/v1/users/:userId/modules`
> **Controller-relative prefix:** `/tenant/users/:userId/modules`
> **Tenant Portal status:** Planned. The legacy portal reads the current user's modules for navigation but has no complete assignment-management UI.
> **Documentation:** Hand-written and source-verified; not generated.

## Source of truth

- Gateway contracts: `../backend/mutakamel-apps/api-gateway-app/src/routing-proxy/route-contracts/core.route-contracts.ts`
- Controller/service/DTO: `../backend/mutakamel-apps/core-app/src/tenant/user-modules`
- Subscription seat logic: `../backend/mutakamel-apps/core-app/src/tenant/subscription`
- Legacy module use: `../backend/mutakamel-apps/mutakamel-web-app/src`

## Routes

| Method and canonical browser path | Permission | Result |
|---|---|---|
| `GET /api/tenant/core/v1/users/:userId/modules` | `users.user.read` | Active module assignments |
| `POST /api/tenant/core/v1/users/:userId/modules` | `users.user.update` | `201`, assign and consume a seat |
| `DELETE /api/tenant/core/v1/users/:userId/modules/:moduleKey` | `users.user.update` | `204`, unassign and release a seat |

Security requires tenant authentication, matching verified host, current session/subscription, permission, and effective scope over the target user. `userId` is UUIDv7.

POST accepts exactly:

Safe body example:

```json
{"moduleKey":"crm"}
```

`moduleKey` is required, maximum 64, and matches `^[a-z][a-z0-9_]*$`. There is intentionally no client-side static module enum: validity and subscription entitlement come from the Core catalogue/database. Treat module keys as opaque case-sensitive wire identifiers.

Core rejects unknown fields. Successes/errors use the normal Core envelopes, except `204` has no body. These mutations do not declare application-level idempotency; after an ambiguous failure, refetch assignments before deciding to retry.

Validation is DTO- and catalogue-driven. Responses are private user/licensing data and must not be shared-cached. Assignment/unassignment is synchronous from the portal contract; downstream access-policy refresh does not create a client-polled async job.

Expected errors include `TENANT_USER_NOT_FOUND`, `MODULE_NOT_FOUND`, `SUBSCRIPTION_NOT_FOUND`, `MODULE_NOT_SUBSCRIBED`, `SEAT_LIMIT_REACHED`, and `ASSIGNMENT_NOT_FOUND`.

## AI implementation rules

- Build available choices from server subscription/catalogue data, never a hard-coded marketing list.
- Display seat impact before assignment.
- Refetch both the user's assignments and subscription usage after a mutation.
- Do not treat a navigation module claim as proof that the actor may administer another user.
