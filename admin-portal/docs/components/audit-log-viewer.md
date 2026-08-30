# Component Specification: `AuditLogViewer`

Status: **[Approved target; component not built]**

Last source verification: **2026-08-29**

## Purpose and boundaries

`AuditLogViewer` is a future shared presentation for immutable audit evidence,
entity history, and operational event history. Current audit screens use
domain-specific rendering; there is no reusable `AuditLogViewer` implementation
or public import today.

Domain guides remain authoritative for endpoint existence, permissions,
redaction, item shape, pagination, and retention. Do not infer a history
endpoint from this component target. Relevant contracts include:

- [Control-plane audit](../api/control-plane-audit.md)
- [Database Servers](../api/database-servers.md)
- [System settings](../api/system-settings.md)
- [Logging](../api/logging.md)
- [Tenant operations](../api/tenant-operations.md)

## Target modes

1. **Table:** dense comparison of time, action, actor, entity, evidence, and
   correlation references.
2. **Timeline:** chronological detail for a bounded resource or operation.
3. **Diff:** field-level previous/next comparison where the domain projection
   safely exposes it.

Modes share filters, freshness, pagination, accessible names, and evidence
formatting. They do not expose raw payloads merely because the backend stores
them.

## State contract

- Initial loading reserves the viewer layout.
- Background refresh preserves evidence, filters, pagination, expansion, and
  focus.
- Empty and filtered-empty are distinct.
- Forbidden is not empty.
- Partial or stale evidence remains visible with a persistent qualifier and last
  authoritative update.
- Load failure retains safe prior evidence and provides retry.

## Evidence presentation

- Timestamps use explicit locale and timezone.
- IDs, emails, IPs, correlation IDs, and operation IDs are direction-isolated
  and copyable.
- Previous/next values use semantic removal/addition treatment plus text or icon;
  never red/green alone.
- Sensitive or redacted values show an explicit redaction label, not blank text.
- Actor and source labels distinguish human, system, and unavailable identity
  without inventing names.
- Expandable details are keyboard operable and preserve focus.

## Accessibility and responsive behavior

- Table mode follows the shared [DataTable contract](data-table.md).
- Timeline markers are decorative when each event has a visible status/action
  label.
- Narrow layouts prioritize time, action, entity, and result; additional
  evidence moves into labelled disclosure rather than disappearing.
- Horizontal comparison regions are named and focusable.
- Live updates use one concise status rather than announcing every new row.

## Implementation gate

Before building this component, reverify every proposed domain source. The
previous documentation incorrectly claimed a Storage Server history endpoint
and a reusable implementation that do not exist in current source.
