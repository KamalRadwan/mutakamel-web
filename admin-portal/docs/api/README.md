# Admin Portal API Reference

Status: **[Verified]**

Last source verification: **2026-08-05**

Feature documents use canonical browser paths through API Gateway. They are
source contracts, not authenticated runtime or deployment evidence.

## Operational APIs

- [Backup and Restore](backups-restores.md) — Worker-owned policies, bounded
  evidence, durable run-command identity, restore verification, and promotion.
- [Database Servers](database-servers.md) — Core-owned registry, lifecycle,
  generated principals, activation, and hard destroy.
- [Dashboard](dashboard.md) — permission-filtered operational report groups.
- [Storage Servers](storage-servers.md) — Core-owned registry, write-only
  credentials, lifecycle, durable probes, and freshness-gated placement.
- [Tenants](tenants.md) — tenant registry and provisioning entry points.

All write-sensitive idempotent routes require a caller-owned UUIDv7
`x-idempotency-key`. Follow each feature document for exact permissions, DTOs,
response projections, and retry rules.

Shared visual presentation, feedback, freshness, confirmation, and recovery
behavior is defined in
[Operational UX](../design-system/operational-ux.md). That document does not
override endpoint, permission, DTO, enum, or retry contracts in this directory.
