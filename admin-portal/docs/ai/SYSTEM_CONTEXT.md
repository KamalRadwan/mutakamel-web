# System Context

Last source verification: **2026-07-30**

## Ownership

| App | Admin Portal responsibility |
| --- | --- |
| `admin-portal` | Browser UI, typed browser projections, permissions for exposure, state/error handling, and client tests |
| `api-gateway-app` | Only public browser edge; canonical route ownership, cookie/auth edge behavior, idempotency enforcement, and Problem Details |
| `core-app` | Primary Admin control plane: auth, users, roles, tenants, infrastructure, catalogue, billing, settings, notifications, logging, audit, and provisioning |
| `worker-app` | Separate Admin backup/restore execution routes |
| `realtime-app` | Admin Realtime source foundation; not activated by this documentation |
| `crm-app` / `trade-app` | Tenant-product APIs; not direct Admin Portal sources unless Gateway adds an Admin route |

## Request flow

```text
Admin browser
  -> Admin Portal shared authenticated client
  -> API Gateway /api/admin/{core|worker}/v1/*
  -> owning backend controller
  -> canonical success or error response
```

The browser must not supply trusted actor, role, permission, tenant, internal
service, or forwarded-host headers.

## Authentication boundary

Admin Portal uses HttpOnly cookie mode. Browser-readable storage may retain
only non-secret session timing/generation and a validated profile projection.
Protected `401` handling coordinates one refresh and one exact request retry.

## Asynchronous boundary

Tenant creation, provisioning commands, verification, reconciliation, and
other accepted operations remain asynchronous when the backend returns `202`.
The UI must render and reconcile the returned operation state instead of
optimistically reporting a terminal success.

## Release boundaries

Source presence is not release readiness. Storage migration, Admin Realtime,
recovery evidence, and any other default-off or operator-unsafe foundation stay
`GATED` until their domain guide names sufficient release and runtime evidence.
