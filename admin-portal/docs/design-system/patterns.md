# Patterns

Status: **[Verified inventory; approved target contracts linked]**

Last source verification: **2026-08-29**

Owner: **Admin Portal**

Source: `src/design-system/patterns/*` (15 directories). A pattern composes
primitives into something a route uses directly — a table, a drawer, a page
header — and, unlike a primitive, usually carries real product behavior
(server pagination, dirty-state guards, idempotency evidence).

Where a written functional spec exists under `docs/components/`, that spec
is the authoritative contract the pattern implements — this page only maps
spec to implementation and adds what the spec doesn't cover.

All patterns also follow:

- [Operational UX](operational-ux.md) for states, feedback, permissions, and
  recovery;
- [Data experiences](data-experiences.md) for filters, tables, and charts;
- [Accessibility, responsive behavior, and localization](accessibility-responsive-and-localization.md)
  for interaction-quality requirements.

| Pattern | Implementation | Spec |
| --- | --- | --- |
| `DataTable` | `patterns/data-table/DataTable.tsx` + `useDataTable.ts` | [data-table.md](../components/data-table.md) |
| `FilterBar` | `patterns/filter-bar/` | [filter-bar.md](../components/filter-bar.md) |
| `FormDrawer` | `patterns/form-drawer/FormDrawer.tsx` + `useFormDrawer.ts` | [form-drawer.md](../components/form-drawer.md) |
| `ConfirmActionModal` | `patterns/confirm-action/` | [confirm-action-modal.md](../components/confirm-action-modal.md) |
| `StatusBadge` | `patterns/status-badge/` | [status-badge.md](../components/status-badge.md) |
| `OperationTimeline` | `patterns/operation-timeline/OperationTimeline.tsx` | [operation-timeline.md](../components/operation-timeline.md) |
| `AmbiguousOutcomePanel` | `patterns/ambiguous-outcome/` | none — see below |
| `PermissionGate` | `patterns/permission-gate/` | none — see below |
| `PageHeader` | `patterns/page-header/` | none |
| `Pagination` | `patterns/pagination/Pagination.tsx` | none |
| `EmptyState` | `patterns/empty-state/` | none |
| `ErrorState` | `patterns/error-state/` | none |
| `DegradedBanner` | `patterns/degraded-banner/` | none |
| `StatCard` / `StatGrid` | `patterns/kpi/` | none |
| `CodeRef` | `patterns/code-ref/` | none |

## The two constraint-critical patterns

**`AmbiguousOutcomePanel`** exists because of AGENTS.md's highest-consequence
failure mode: *"Persist only minimal, non-secret attempt evidence until the
operator resolves an ambiguous outcome."* It pairs with
`usePersistedCommandAttempt`, renders the idempotency-key evidence and a
retry-exact affordance, and — unlike a toast — does not auto-dismiss. Every
site that used to render this kind of evidence as an ad hoc in-body banner
(one existed per route family before this migration) was reviewed
individually during that route's conversion phase, not converted by a blind
codemod, because getting one wrong silently destroys an operator's evidence
that a write may or may not have happened. See
[toast-contract.md](toast-contract.md#where-a-result-belongs).

**`PermissionGate`** absorbed the pre-migration `RequirePermission.tsx`,
keeping its discriminated-union permission API byte-identical and only
restyling the fallback. AGENTS.md: *"403 is not an empty state"* — a gate
renders a distinct, labeled in-body state, never `EmptyState`.

## Cross-cutting target contracts

`PageHeader`, `Pagination`, `EmptyState`, `ErrorState`, `DegradedBanner`,
`StatCard`/`StatGrid`, and `CodeRef` do not yet have individual
`docs/components/*.md` files. Their source props describe the implementation
API, but no longer count as the complete UX specification: focus, live status,
refresh preservation, responsive behavior, and localization are governed by
the cross-cutting target contracts above.

`AmbiguousOutcomePanel`, `PermissionGate`, `ErrorState`, and `DegradedBanner`
are constraint-critical operational patterns. Their route composition must
preserve authoritative evidence and must not be replaced with generic toast or
empty-state behavior.

## Composing patterns from primitives, not the other way around

A pattern's implementation reaches into `src/design-system/primitives/*`
directly (it's inside the design system), but feature code building a new
screen should reach for a pattern first and drop to a bare primitive only
when no pattern fits — e.g. a route's table always wants `DataTable`, not a
hand-assembled `Table`+`Pagination`+`FilterBar` unless that route's table has
requirements `DataTable` genuinely can't express.
