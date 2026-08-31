# Operational UX

Status: **[Representative source migrations implemented; product-wide verification pending]**

Design approval: **2026-08-29**

Current-source audit: **2026-08-29**

Owner: **Admin Portal**

## Purpose and boundaries

This document defines how the Admin Portal communicates data state, permission,
mutation progress, destructive scope, recovery evidence, and asynchronous
outcomes. It governs frontend presentation and interaction only.

Canonical permission semantics, idempotency rules, response envelopes, and
error shapes remain authoritative in:

- [Permissions, idempotency, and data state](../architecture/permissions-idempotency-and-state.md)
- [HTTP and error contract](../architecture/http-and-error-contract.md)
- The relevant domain guide under `docs/api/`

The UI must not infer a successful operation from a closed dialog, optimistic
row update, elapsed timer, or disappearing toast.

The shared operational primitives and representative route integrations are in
source. This contract still describes the required product-wide outcome; it
does not assert that every server-backed surface has completed the state and
authenticated-runtime matrix.

## Page and query state model

Every server-backed surface explicitly handles the states that apply to it.

| State | Required presentation | Forbidden shortcut |
| --- | --- | --- |
| Initial loading | Reserved layout, named loading status, skeleton or progress | Blank page or spinner with no context |
| Background refresh | Keep current data and controls; announce concise status | Replacing rows, pagination, or focused control |
| Loaded data | Data, freshness evidence, relevant actions | Hiding partial or stale qualifiers |
| Loaded empty | Explain that no records exist and offer a valid next action | Treating empty as an error |
| Filtered empty | Preserve filters and offer clear/reset actions | Showing the first-use empty state |
| Partial/degraded | Keep safe data and show a persistent qualifying banner | Toast-only warning |
| Stale | Show last successful update and stale reason when known | Presenting old data as current |
| Offline/reconnecting | Persistent connection state and recovery behavior | Silent retry loop |
| Forbidden | Permission-specific state; do not query or expose forbidden actions | Empty state or not-found copy |
| Validation failure | Inline field errors plus summary when multiple fields fail | Toast-only failure |
| Conflict/stale version | Explain competing change and refetch/review options | Silent overwrite |
| Ambiguous/in-flight write | Persistent evidence and retry-exact/reconcile affordance | Auto-dismissed message or a new intent key |
| Terminal async failure | Operation identity, failure reason, evidence, and valid recovery | Generic “Something went wrong” |

Use a single polite live region for meaningful background status updates. Do not
turn every changing count or badge into a competing announcement.

## Data freshness

Freshness labels distinguish three different clocks:

- **Data as-of:** an authoritative domain field such as dashboard `asOf`;
- **Evidence time:** the time a probe, audit event, or operation observation was
  produced;
- **Last client fetch:** when the browser last received a successful response.

An envelope `timestamp` or client-fetch time must never be relabelled as data
as-of. Every operational projection with meaningful staleness exposes only the
clocks its domain contract actually provides, plus:

- the last authoritative update time;
- whether the value is live, polling, cached, delayed, or stale;
- the active refresh cadence when automatic refresh exists;
- a manual refresh action with loading and completion feedback;
- the last successful update if a refresh fails;
- the timezone used for the timestamp.

Background refresh must preserve visible rows, filters, page, expanded content,
scroll position, and keyboard focus. Selection is reconciled against returned
identities and current action eligibility: valid selections remain; removed or
newly ineligible selections are dropped with a contextual announcement. Initial
loading and refreshing are different states and must not share destructive
rendering logic.

Auto-refresh pauses on observable disruption conditions: active editing or text
selection inside the owned region, focus on a control explicitly marked
`data-refresh-disruptive-focus`, an open modal/menu, a caller-supplied active-call
signal, a hidden page, or an explicit operator pause. Ordinary button, tab, and
navigation focus does not pause refresh because the background update preserves
mounted controls and focus. The product does not attempt to detect
assistive-technology usage. A paused state is visible and resumable.

Implementation note (representative, not product-wide): the shared operator
refresh guard and the admin dashboard are the first owned-region/overlay
reference. Active-call support is a typed integration signal on the shared hook,
but the dashboard does not currently supply that signal. Product-wide call-state
wiring remains pending. The tenant core/provisioning pollers, logging live
transport, and notification dropdown were audited but retain their existing
domain-specific scheduling until each surface receives its own owned-region and
overlay/call signals.
Logging's hidden-page privacy stop remains a separate, stricter transport rule.

## Mutation lifecycle

One operator intent follows this lifecycle:

1. Review the exact scope and prerequisites.
2. Submit once with duplicate submission disabled.
3. Show pending progress without hiding the affected resource.
4. Resolve from an authoritative response or operation projection.
5. Reconcile or refetch when the authoritative projection may have changed.
6. Present persistent evidence for ambiguous, in-flight, partial, or failed
   outcomes.

An idempotency key belongs to the exact actor, method, path, query, and body.
Changing intent creates a new key. Retrying an identical unresolved intent
reuses the existing key according to the architecture contract.

## Feedback hierarchy

| Situation | Surface |
| --- | --- |
| Field validation | Inline error associated with the field |
| Multi-field submission failure | Error summary plus inline errors; focus the summary and provide links to every invalid field |
| Brief successful write | Toast plus visible state change when applicable |
| Deterministic command rejection | Persistent form/dialog error when the operator must act; toast only when no local recovery is needed |
| Load failure | In-body `ErrorState` with retry |
| Forbidden section or action | `PermissionGate` or explicit disabled reason |
| Transport-owned write `403` | Keep the transport toast as the only toast; also keep persistent action-context permission feedback when the workflow remains blocked |
| Degraded or stale data | Persistent banner near the qualified data |
| Ambiguous write | Persistent `AmbiguousOutcomePanel` |
| Long-running operation | In-body operation status/timeline and optional notification on completion |
| Asynchronous cross-page event | Notification center; toast may announce arrival |

An error that blocks or requires recovery never exists only in a temporary
toast. A nonblocking rejection with no local recovery may be toast-only.
Transport-owned `403` handling must not be duplicated by a second UI toast.
Correlation IDs and safe operation references remain copyable without exposing
secrets or sensitive payloads.

## Permission-aware interaction

- Navigation and route visibility derive from the canonical permission-filtered
  route tree.
- A control is hidden when its existence reveals a forbidden capability and
  there is no useful explanatory value.
- A control is disabled when the user can understand the capability but a
  temporary state, prerequisite, selection, or policy prevents execution.
- Disabled controls expose a nearby reason; a tooltip alone is insufficient for
  touch and keyboard users.
- A `403` response is never rendered as empty or not found.
- UI gating supplements backend authorization; it never replaces it.

## Confirmation levels

| Risk | Required pattern |
| --- | --- |
| Reversible, low impact | Direct action plus visible success and optional undo |
| Significant but recoverable | Confirmation dialog naming resource and consequence |
| High impact or broad scope | Dialog with affected count/scope, prerequisites, and explicit confirm label |
| Irreversible or destructive | Exact case-sensitive typed confirmation, permanent consequence, and audit reason when required |
| Ambiguous/non-replayable | Pre-submit warning plus persistent post-submit recovery evidence |

Typed confirmation comparison preserves and compares the exact required string,
including case, whitespace, and punctuation. The UI must not claim “exact” while
normalizing any of those values behind the scenes.

## Bulk selection and actions

- Bulk behavior exists only for domains with an explicit authoritative bulk
  action contract. The UI must not synthesize a bulk command by fanning out
  per-row mutations.
- Explicit-ID selection is the default and may span only the identities the
  client can represent safely.
- “All matching results” is offered only when the action/API contract supports a
  query-scoped bulk intent with an authoritative query fingerprint, total, and
  exclusion model.
- The selected count and scope remain visible in a persistent action bar.
- Eligibility is evaluated per action. Mixed selections explain which records
  are excluded before submission.
- Selection survives safe pagination. Refresh reconciles identities and action
  eligibility, preserving valid selections and announcing any dropped records.
  A query/filter change clears incompatible selection with an announcement.
- Bulk destructive confirmation states the total affected count and query scope.
- When the authoritative response exposes per-item results, partial completion
  reports succeeded, failed, skipped, and unresolved records separately, with
  downloadable or copyable evidence where volume requires it. The UI does not
  fabricate per-item certainty from a single aggregate response.
- Row-level actions remain available for isolated work; repetitive operations
  must not require editing every row individually.

## Auditability and recovery

For high-impact operations, show the operator-safe subset of:

- actor and permission context;
- resource identity and affected scope;
- submitted time and current state;
- operation, correlation, and idempotency references;
- last authoritative reconciliation time;
- permitted recovery or retry-exact action.

Never display or persist secrets, raw credential material, sensitive request
bodies, or hidden permission data as recovery evidence.

## Acceptance criteria

The criteria below remain product-level acceptance gates. Current automated
evidence covers the shared patterns and representative integrations, not every
matching production consumer. In particular, no `ALL_MATCHING` selection or
bulk-action behavior is claimed without an authoritative domain contract.

- Every server-backed page has a reviewed state matrix.
- Refresh never destroys focus or current data without a route transition.
- Every mutation has authoritative pending, success, rejection, and ambiguous
  behavior.
- Permission absence cannot masquerade as empty data.
- Every irreversible action communicates exact scope and uses exact typed
  confirmation when required.
- Bulk actions expose selection scope and partial results.
