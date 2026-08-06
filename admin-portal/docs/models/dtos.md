# DTO Reference

Status: **[Verified index]**

Last source verification: **2026-08-05**

DTO authority remains the owning backend DTO/controller and its domain API
guide. Browser code must validate every network payload as `unknown`, preserve
UUIDv7 and bigint/decimal strings, and submit only documented writable fields.

## Domain DTO guides

- [Application Catalogue](../api/catalog.md)
- [Database Servers](../api/database-servers.md)
- [Storage Servers](../api/storage-servers.md)
- [Backup and Restore](../api/backups-restores.md)
- [Tenants](../api/tenants.md)
- [Tenant operations](../api/tenant-operations.md)
- [Subscriptions](../api/subscriptions.md)
- [Wallet](../api/wallet.md)

Use [HTTP and error contracts](../architecture/http-and-error-contract.md) for
success envelopes, Gateway Problem Details, Core errors, and Worker errors.
Use [permissions, idempotency, and state](../architecture/permissions-idempotency-and-state.md)
for caller-owned command identities and exact ALL/ANY authorization behavior.
