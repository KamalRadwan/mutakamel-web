# The state contract

Status: **Specification**

Written: **2026-08-31**

Every screen that reads or writes server data renders **eleven** states, not
one. This page is the checklist; the components that implement each state are
specified in [patterns.md](patterns.md) and [primitives.md](primitives.md).

## Why this page exists

Phases 4–12 build roughly seventy screens. Each one was going to rediscover
the same list, badly, and the evidence that it would is already in the tree:
five list pages shipped with the error state stacked underneath the empty
state, four shipped an error banner with no retry, and one reported "no
pipeline is configured" — a setup gap — as a red failure.

Those are not seventy different bugs. They are one omission, repeated. **State
coverage is a gate item, not a polish pass.**

## The eleven states

| # | State | Surface | The mistake it prevents |
| --- | --- | --- | --- |
| 1 | **Loading** | `DataTableSkeleton`, or `Skeleton` shaped like the content | A spinner over a blank page, or worse, the empty state flashing before data arrives |
| 2 | **Empty** | `EmptyState` — one icon, one line, one action | "No results" when the truth is "nothing was asked" |
| 3 | **Error + retry** | `ErrorState` with a **real** `onRetry` | A dead-end banner. An error the user cannot act on is a bug report they have to write instead |
| 4 | **403** | `PermissionGate` | An empty list. "There is nothing here" and "this is not yours" are different sentences |
| 5 | **Read-only** | `ReadOnlyGate`, and `Field readOnly` | `disabled`, which says "come back later" about something that will never be editable here |
| 6 | **Offline** | The shell's offline banner | A generic network error per request, seven times |
| 7 | **Optimistic pending** | The pending dot, `aria-busy` | A frozen UI, or a change that looks committed before it is |
| 8 | **Optimistic rollback** | The row reverts **and** a toast says why | A silent revert. The user saw it work and now it did not, with no explanation |
| 9 | **Conflict (409)** | `ConflictDialog` — refetch, show both, let the user choose | Last-write-wins, silently discarding someone else's edit |
| 10 | **Not found (404)** | `NotFoundState` — **no retry** | A retry button on a record that is gone. Pressing it can never work |
| 11 | **Partial failure** | `DegradedBanner`, plus whatever did load | All-or-nothing: one failed sub-request blanking a screen whose other three succeeded |

## The rules behind the table

### Error replaces empty; it never stacks with it

A failed load has no rows, so a naive screen renders the error banner *and*
"No results". The user reads the second one, concludes their filter is wrong,
and never retries. `DataTable` resolves this in order — loading, then error,
then empty — and a screen must pass its **real** error object in rather than
`error={null}` plus a separate banner.

### Every error surface carries a retry

The only exception is state 10: a 404 means the request **succeeded** and the
answer was "this does not exist". A retry cannot change that, and offering one
tells the user to keep pressing a button that cannot work.

### "Nothing is configured" is an empty state, not an error

A missing pipeline, an unpopulated catalogue, a tenant that has not set up
lead stages — nothing failed. Render `EmptyState` with the action that fixes
it, or, where that screen is not built yet, a description that names the step
and who performs it. A red banner for a setup gap trains people to ignore red
banners.

### Partial failure needs `Promise.allSettled`

A screen that fetches a list, its capabilities and its catalogue under
`Promise.all` loses all three when any one rejects — and a capabilities `403`
is a perfectly ordinary answer. Use `allSettled`, degrade per source, and say
which part is missing.

The inverse mistake is just as bad: `useCustomerProfilesCapabilities`
originally reported *any* capabilities failure as "no permission", so a network
blip and a real `403` were indistinguishable. **A question that could not be
asked is not an answer.**

### 403 is never an empty state

Stated in `AGENTS.md`, repeated here because it is the one most often gotten
wrong under time pressure. Route admission comes from `/auth/me`; **action**
admission comes from the CRM `capabilities` endpoints, which account for branch
and owner scope.

### Rate limiting and idempotency are outcomes, not failures

Four more results that read as "it failed" if they share one message, each
needing a different action. Classification lives in
[`src/lib/api/outcomes.ts`](../../src/lib/api/outcomes.ts), with every code
cited to backend source:

| Result | Means | The user's next step |
| --- | --- | --- |
| `429` / `GW.RATE.LIMIT_EXCEEDED` | Over the limit | Wait, then the same action |
| `GW.RATE.UNAVAILABLE` (503) | The limiter itself is down; the Gateway fails **closed** | Wait. **Not** a permission problem — do not send them to an administrator |
| `Idempotency-Replayed: true` | The write ran **once**; this is its stored result | Nothing. It worked |
| `GW.IDEM.IN_FLIGHT` / `IDEMPOTENCY_REQUEST_PROCESSING` (409) | The first attempt is still running | Wait and refresh — **do not** resend |
| `GW.IDEM.MISMATCH` / `IDEMPOTENCY_BODY_MISMATCH` (422) | Same key, different request | Reload and start over |

## Pagination is real or absent

A `page` object built from `limit: items.length` with a no-op `onPageChange`
renders working-looking controls over a single page that can never advance.
Either wire real server paging, or pass the honest total and let the control
render its one page — never fabricate the shape.

## Per-screen checklist

Run this before calling a screen done. It belongs in every phase-4-to-12 gate.

- [ ] **Loading** — skeleton shaped like the content, not a spinner
- [ ] **Empty** — distinguishes "no data yet" from "no match for this filter"
- [ ] **Error** — real error object reaches the view, and it **replaces** empty
- [ ] **Retry** — present on every error surface except `NotFoundState`
- [ ] **403** — `PermissionGate`, never `EmptyState`
- [ ] **Read-only** — full text contrast, `aria-readonly`, a reason line
- [ ] **Offline** — the screen degrades rather than erroring per request
- [ ] **Optimistic pending** — visible, and `aria-busy` where it is a region
- [ ] **Optimistic rollback** — reverts **and** explains
- [ ] **Conflict** — 409 refetches and shows both values
- [ ] **Not found** — `NotFoundState`, no retry
- [ ] **Partial failure** — `allSettled`, per-source degradation, named
- [ ] **Rate limit / idempotency** — routed through `describeApiOutcome`
- [ ] **Pagination** — real, or honestly absent
- [ ] Every one of the above reviewed in **both languages** and **both themes**

## Where each surface lives

| State | Component |
| --- | --- |
| Loading | `DataTableSkeleton`, `Skeleton` |
| Empty | `EmptyState` |
| Error | `ErrorState` |
| 403 | `PermissionGate` |
| Read-only | `ReadOnlyGate`, `Field readOnly` |
| Offline | shell banner |
| Optimistic pending | `StatusBadge` pending dot, `aria-busy` |
| Optimistic rollback | caller state + `useToast` |
| Conflict | `ConflictDialog` |
| Not found | `NotFoundState` |
| Partial failure | `DegradedBanner` |
| Ambiguous write | `AmbiguousOutcomePanel` |
