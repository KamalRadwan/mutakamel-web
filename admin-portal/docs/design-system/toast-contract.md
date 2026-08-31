# Toast Contract

Status: **[Verified current API; approved feedback hierarchy added]**

Last source verification: **2026-08-29**

Owner: **Admin Portal**

## Purpose

This document defines the toast API and prevents transient notification from
replacing persistent task recovery. Toast is appropriate for brief confirmation
or a nonblocking event. Validation, blocked workflows, load failures, degraded
data, permission states, and ambiguous writes retain contextual in-body
feedback according to [Operational UX](operational-ux.md#feedback-hierarchy).

## API

`useToast()` (`src/components/ui/ToastContext.tsx`, re-exporting
`src/design-system/feedback/useToast.tsx`) is unchanged in shape from before
the migration:

```ts
toast.success(title: string, message?: string, duration?: number): void
toast.error(title: string, message?: string, duration?: number): void
toast.info(title: string, message?: string, duration?: number): void
toast.warning(title: string, message?: string, duration?: number): void
toast.errorFromApi(title: string, error: NormalizedApiError, duration?: number): void // new, additive
```

`duration <= 0` means permanent (no auto-dismiss); omitted defers to the
Toaster's 4000ms default. `message` supports `\n` (rendered
`whitespace-pre-line`). `toast.saved()` from the old API is not carried
over — it had zero call sites.

Rendering moved from hand-rolled `useState` to `sonner`
(`src/design-system/feedback/ToastProvider.tsx` + `AppToast.tsx`), mounted
in the root layout exactly where the old `ToastProvider` was. The
transport's `dispatchForbiddenToast()` (`axiosClient.ts`) still dispatches
a `window` `CustomEvent("global-toast")`; `ToastProvider` still listens for
it and renders through the same `AppToast` path `useToast()` uses.

## Where a result belongs

| Situation | Surface | Why |
|---|---|---|
| Successful write | **Toast** | Transient confirmation |
| Deterministic non-field command rejection | **Toast** or persistent form/dialog alert, via normalized error | Use a persistent local alert when the operator must act before continuing; preserve `errorCode` + `correlationId` safely |
| 403 on a write action | **Transport toast + persistent action-context permission feedback when the workflow remains blocked** | `dispatchForbiddenToast()` already fires on every non-public 403, so feature code must not emit a second toast. Persistent context is not a duplicate toast. |
| Ambiguous/unresolved write outcome | **`AmbiguousOutcomePanel` (Phase 12), in-body, persistent** | AGENTS.md: *"Persist only minimal, non-secret attempt evidence until the operator resolves an ambiguous outcome."* A 4s toast destroys the retry-exact affordance and the idempotency key. |
| Field validation error | **`Field` inline** (`aria-describedby`) | Must stay a programmatically associated, persistent target for the input |
| Multi-field validation error | **Focusable error summary + inline `Field` errors** | Focus the summary; it links to every invalid field |
| Authentication failure | **Persistent form-level error and applicable inline error** | A disappearing toast cannot be the sole explanation for a blocked login |
| 403 gate on a whole section | **`PermissionGate` (Phase 12), in-body** | AGENTS.md: *"403 is not an empty state."* |
| Load failure | **`ErrorState` (Phase 12), in-body, with retry** | Needs a retry affordance a toast can't host |
| Empty result set | **`EmptyState` (Phase 12), in-body** | Not an error |
| Degraded / partial data | **`DegradedBanner` (Phase 12), in-body** | A persistent condition qualifying the data on screen, not a one-time event |

The broader feedback hierarchy, background-refresh behavior, notification-center
role, and operational recovery rules live in
[Operational UX](operational-ux.md#feedback-hierarchy).

## Enforcement

- `eslint.config.mjs` treats the transport-owned-403 double-toast pattern as an
  error. The selector is intentionally conservative; extract a shared
  `isForbiddenError()` helper when mutually exclusive branches would otherwise
  match it rather than disabling the rule.
- Every primitive/pattern that renders one of the in-body surfaces above
  (Phase 9–13) must not import `useToast` — that pairing is a review smell,
  not currently machine-enforced.

## Known gap carried over unchanged

`dispatchForbiddenToast()`'s title/message (`"Access Denied"` / `"You do
not have permission to perform this action."`) are hard-coded English, not
localized through `useI18n()`. This is pre-existing behavior, not
introduced by the design-system migration and remains a target gap.

Toast titles, messages, action names, dismiss controls, and screen-reader
announcements must be localized. Toasts use one appropriately prioritized live
region, do not repeatedly announce duplicate transport/UI errors, and pause
dismissal while hovered or keyboard-focused.
