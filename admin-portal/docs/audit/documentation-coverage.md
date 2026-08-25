# Documentation Coverage

Status: **[Verified]**

Last source verification: **2026-08-12**

## Gateway inventory

| Scope | Routes | Coverage |
| --- | ---: | --- |
| Core controller handlers | 445 | Compiler-backed source context |
| Gateway Core contracts | 439 | Gateway source context |
| Core Admin browser routes | 240 | Complete generated inventory |
| Non-GET Core Admin routes | 143 | Complete generated inventory |
| Explicit ANY-permission Admin routes | 1 | FQDN validation |

See the [generated route table](../generated/admin-core-api-routes.md).

## Semantic domain coverage

| Capability family | Routes | Primary guides |
| --- | ---: | --- |
| Application catalogue and pricing | 31 | [Catalogue](../api/catalog.md) |
| Billing and settlement | 27 | [Subscriptions](../api/subscriptions.md), [Wallet](../api/wallet.md), [Payments](../api/payments-reconciliation.md), [Invoices](../api/invoices.md) |
| Identity, RBAC, and sessions | 34 | [Authentication](../api/auth.md), [Users](../api/users.md), [Roles](../api/roles-permissions.md) |
| Infrastructure registries | 28 | [Database Servers](../api/database-servers.md), [Storage Servers](../api/storage-servers.md) |
| Operations and observability | 35 | [Dashboard](../api/dashboard.md), [Reports](../api/reports.md), [Notifications](../api/notifications.md), [Logging](../api/logging.md), [Audit](../api/control-plane-audit.md) |
| Tenant lifecycle and access | 44 | [Tenants](../api/tenants.md), [Tenant users](../api/tenant-users.md) |
| Tenant provisioning and governance | 41 | [Operations](../api/tenant-operations.md), [Provisioning governance](../api/provisioning-governance.md) |
| **Total** | **240** | **Every route is assigned** |

The generated table is the exhaustive method/path index. Hand-written guides
add DTO, state, security, and frontend status details and should not duplicate
the entire generated table.

## Cross-cutting coverage

| Concern | Document |
| --- | --- |
| Source precedence/status labels | [Documentation contract](../DOCUMENTATION_CONTRACT.md) |
| Canonical transport/errors | [HTTP and error contract](../architecture/http-and-error-contract.md) |
| Permissions/idempotency/state | [Permissions, idempotency, and state](../architecture/permissions-idempotency-and-state.md) |
| Current source gaps | [Frontend capability matrix](frontend-capability-matrix.md) |
| AI implementation workflow | [AI Start Here](../ai/START_HERE.md) |
| Regression/validation | [Test matrix](../ai/TEST_MATRIX.md) |

## Limitations

- Route inventory proves Gateway exposure, not DTO or runtime readiness.
- Source verification does not establish authenticated runtime or deployment.
- The working trees may be dirty; generated metadata records revisions and
  `+dirty` state.
- Worker backup/restore routes remain outside the 240 Core Admin count and have
  their own guide.
