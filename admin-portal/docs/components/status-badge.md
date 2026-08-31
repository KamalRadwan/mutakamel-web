# Component Specification: `StatusBadge`

Status: **[Domain maps implemented; runtime conformance pending]**

Last source verification: **2026-08-29**

## Purpose

`StatusBadge` maps backend wire states to localized text and a small set of
semantic outcome treatments. Action blue is not a lifecycle-status color.

## Semantic treatments

| Treatment | Meaning | Visual reinforcement |
| --- | --- | --- |
| `success` | Domain explicitly reports success, health, completion, or verification | Emerald text/tint and stable success icon/dot |
| `progress` | Domain explicitly reports pending or in-progress work | Cobalt `info` tint, dashed structure, pulsing dot |
| `warning` | Domain explicitly reports degraded or attention-required state | Amber text/tint and warning icon/dot |
| `danger` | Domain explicitly reports failure, critical condition, or destructive result | Red text/tint and danger icon/dot |
| `neutral` | Pre-state or deliberately-not-run only — `DRAFT`, `SKIPPED`, unknown values | Ink text/tint and neutral icon/dot |

When reduced motion is active, progress pulse stops. The label, the cobalt
tint, and the static dashed treatment remain sufficient.

`progress` carries the `info` role rather than neutral ink. 18 statuses
resolve to this tone — `RUNNING`, `PROVISIONING`, `PENDING`, `QUEUED`, and
`TRIAL` among them — so leaving it grey meant the most common states in the
product had no colour to read. The dashed border remains the structural
marker separating it from every other tone, and colour is additive to the
label, the border, and the pulse rather than replacing any of them.

## Mapping contract

- The applicable API/domain enum is authoritative.
- Wire labels such as `OFFLINE` and `RUNNING` have no universal tone across
  domains; each enum map assigns its own.
- `ACTIVE` is `success` in every domain. This is a deliberate reversal: it was
  previously `neutral` on the argument that a lifecycle row being active is not
  evidence that the thing is *healthy*. That distinction is real but it was
  carried by the most common status in the product, so operators read tables in
  which almost every row was grey and no status was legible at a glance. Health
  that contradicts the lifecycle row is reported by the domain's own status
  (`DEGRADED`, `OFFLINE`, `SUSPENDED`), which still outranks it.
- Every supported wire value receives English and Arabic copy plus one semantic
  treatment.
- `enumType` selects a complete mapping; it is not accepted and then ignored.
- An unknown wire value renders localized “Unknown status” plus a safely
  inspectable raw code. The raw value is never the only Arabic label.
- Color never appears without the visible status label.
- A semantic status may not be recolored to match a module or chart palette.

## Target API shape

```typescript
export interface StatusBadgeProps {
  status: string;
  enumType?:
    | "tenant"
    | "user"
    | "subscription"
    | "invoice"
    | "operation"
    | "db-server"
    | "application"
    | "backup-artifact";
  customLabelEn?: string;
  customLabelAr?: string;
  showDot?: boolean;
  size?: "sm" | "md";
}
```

Custom labels are permitted only when the domain state is still accurately
represented. They do not create a new semantic tone.

## Typography and access

- Badge text is at least 13px in both languages.
- Arabic uses normal casing and zero tracking.
- Icons are decorative when the text already names the state.
- Status changes announced live use one contextual message, not a bare badge or
  number update.

## Current conformance gaps

`enumType` now selects complete frontend maps for the documented tenant, user,
subscription, invoice, tenant-operation, database-server/binding, application
lifecycle, and backup-artifact enums.
Unknown values render a localized unknown label plus an isolated LTR raw code.

Terminal negative states carry `danger` (`DELETED`, `DISABLED`, `DEACTIVATED`,
`OFF`) and deliberately-ended states carry `warning` (`CANCELLED`, `VOID`);
both were `neutral` before. Only `DRAFT` and `SKIPPED` remain neutral, because
neither describes an outcome.

The dot is painted from the `*-vivid` roles, not the filled `--success` /
`--warning` / `--destructive` roles. Those resolve to the `-700`/`-800` steps,
which the filled variants need for AA against white but which render a status
dot as dark and desaturated. Because the badge always renders its text label,
the dot is reinforcement rather than the sole carrier of meaning, so it answers
to the 3:1 graphics bar and can sit on the far more saturated mid steps
(`success-600` is C 0.170 against C 0.118 for `success-800`).

Remaining conformance work is runtime-dependent: verify status changes and live
announcements with an authenticated session, both languages/themes, common
color-vision deficiencies, and reduced motion. Backend enum additions still
require an explicit frontend map update; the generic compatibility vocabulary
is not authority for a domain-specific status.
