# Toast Contract

Status: **[Verified]**

Last source verification: **2026-08-26**

Owner: **Admin Portal**

## Purpose

The user's requirement was explicit: no success/failure card in the page
body — use a toaster instead. This document is the seam that keeps that
rule from silently breaking two things the app depends on: the transport's
own 403 handling, and the AGENTS.md requirement that ambiguous write
outcomes persist until an operator resolves them.

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
| Deterministic rejected write (409/422, unambiguous) | **Toast**, via `errorFromApi` | Carries `errorCode` + `correlationId` in the message so the evidence isn't lost |
| 403 on a write action | **The transport's toast only** | `dispatchForbiddenToast()` already fires on every non-public 403 — a `toast.error(...)` in the same catch block double-fires. The ESLint rule below flags this. |
| Ambiguous/unresolved write outcome | **`AmbiguousOutcomePanel` (Phase 12), in-body, persistent** | AGENTS.md: *"Persist only minimal, non-secret attempt evidence until the operator resolves an ambiguous outcome."* A 4s toast destroys the retry-exact affordance and the idempotency key. |
| Field validation error | **`Field` inline** (`aria-describedby`) | Must stay a programmatically associated, persistent target for the input |
| 403 gate on a whole section | **`PermissionGate` (Phase 12), in-body** | AGENTS.md: *"403 is not an empty state."* |
| Load failure | **`ErrorState` (Phase 12), in-body, with retry** | Needs a retry affordance a toast can't host |
| Empty result set | **`EmptyState` (Phase 12), in-body** | Not an error |
| Degraded / partial data | **`DegradedBanner` (Phase 12), in-body** | A persistent condition qualifying the data on screen, not a one-time event |

## Enforcement

- `eslint.config.mjs` flags `toast.error(...)` inside a `catch` block that
  also references `403` or `AUTHORIZATION` in the same block (warn-only
  today; confirmed live against the codebase, it already found 3 real
  candidate sites in `/users` — `InviteUserModal.tsx`,
  `useUserDetail.ts`, `useUsers.ts` — left for review during that route's
  Phase 16 conversion, not fixed blind here).
- Every primitive/pattern that renders one of the in-body surfaces above
  (Phase 9–13) must not import `useToast` — that pairing is a review smell,
  not currently machine-enforced.

## Known gap carried over unchanged

`dispatchForbiddenToast()`'s title/message (`"Access Denied"` / `"You do
not have permission to perform this action."`) are hard-coded English, not
localized through `useI18n()`. This is pre-existing behavior, not
introduced by the design-system migration; tracked for the Phase 23
content/i18n sweep, not fixed here.
