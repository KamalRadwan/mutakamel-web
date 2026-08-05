# Documentation Coverage

Status: **[Verified]**

Last source verification: **2026-07-30**

## Gateway inventory

| Scope | Routes | Coverage |
| --- | ---: | --- |
| Core route table, all masters | 443 | Source context only |
| Core Admin browser routes | 232 | Complete generated inventory |
| Write-sensitive Admin routes | 133 | Complete generated inventory |
| Explicit ANY-permission Admin routes | 1 | FQDN validation |

See the [generated route table](../generated/admin-core-api-routes.md).

## Semantic domain coverage

| Route-key domain | Routes | Primary guide |
| --- | ---: | --- |
| Auth | 8 | [Authentication](../api/auth.md) |
| Dashboard/reports | 6 | [Dashboard](../api/dashboard.md), [Reports](../api/reports.md) |
| Users/roles/permissions | 22 | [Users](../api/users.md), [Roles](../api/roles-permissions.md) |
| Database Servers | 10 | [Database Servers](../api/database-servers.md) |
| Storage registry/attestation/recovery | 22 | [Storage Servers](../api/storage-servers.md) |
| Tenants, tenant FQDNs, subscriptions, wallet, and payments | 81 | [Tenants](../api/tenants.md), [Tenant users](../api/tenant-users.md), [Operations](../api/tenant-operations.md), [Subscriptions](../api/subscriptions.md), [Wallet](../api/wallet.md), [Payments](../api/payments-reconciliation.md) |
| Provisioning governance | 32 | [Provisioning governance](../api/provisioning-governance.md) |
| Catalogue | 26 | [Catalogue](../api/catalog.md) |
| Invoices | 7 | [Invoices](../api/invoices.md) |
| Settings | 7 | [System settings](../api/system-settings.md) |
| Notifications | 14 | [Notifications](../api/notifications.md) |
| Logging | 6 | [Logging](../api/logging.md) |
| Control-plane audit | 2 | [Control-plane audit](../api/control-plane-audit.md) |

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
- Worker backup/restore routes remain outside the 232 Core Admin count and have
  their own guide.
