# Integration 1A — state components

Written: **2026-08-30** · Owner: **Phase 1 state-components agent** ·
Status: **awaiting merge**

Covers MASTER-PLAN tasks **1.25, 1.26, 1.27, 1.29, 1.30, 1.31, 1.32, 1.33,
1.34**.

The components are built, tested and gate-clean, but three files they need to
be reachable through are owned by another agent and were deliberately **not**
touched:

- `src/design-system/index.ts` — the barrel
- `src/i18n/dictionaries/ar.ts` and `src/i18n/dictionaries/en.ts`

This page is the exact paste list for merging both in one pass.

---

## 1. Barrel export lines

Add to `src/design-system/index.ts`, in the patterns block. The order below
keeps the block alphabetical by directory.

```ts
export * from "./patterns/access-mode/ReadOnlyGate";
export * from "./patterns/ambiguous-outcome/AmbiguousOutcomePanel";
export * from "./patterns/async-job/AsyncJobState";
export * from "./patterns/bulk-actions/BulkActionBar";
export * from "./patterns/bulk-actions/BulkConfirmDialog";
export * from "./patterns/bulk-actions/BulkResultPanel";
export * from "./patterns/conflict-dialog/ConflictDialog";
export * from "./patterns/not-found-state/NotFoundState";
export * from "./patterns/reason-dialog/ReasonDialog";
```

What each line brings in, so a name collision is visible before the merge:

| Line | Exports |
| --- | --- |
| `access-mode/ReadOnlyGate` | `ReadOnlyGate`, `ReadOnlyGateProps`, `ReadOnlyGateLabels` |
| `ambiguous-outcome/AmbiguousOutcomePanel` | `AmbiguousOutcomePanel`, `AmbiguousOutcomePanelProps`, `AmbiguousOutcomeLabels` |
| `async-job/AsyncJobState` | `AsyncJobState`, `AsyncJobStateProps`, `AsyncJobStateLabels`, `AsyncJobStatus` |
| `bulk-actions/BulkActionBar` | `BulkActionBar`, `BulkActionBarProps`, `BulkActionBarLabels`, `BulkAction` |
| `bulk-actions/BulkConfirmDialog` | `BulkConfirmDialog`, `BulkConfirmDialogProps`, `BulkConfirmDialogLabels` |
| `bulk-actions/BulkResultPanel` | `BulkResultPanel`, `BulkResultPanelProps`, `BulkResultPanelLabels`, `BulkFailure` |
| `conflict-dialog/ConflictDialog` | `ConflictDialog`, `ConflictDialogProps`, `ConflictDialogLabels` |
| `not-found-state/NotFoundState` | `NotFoundState`, `NotFoundStateProps` |
| `reason-dialog/ReasonDialog` | `ReasonDialog`, `ReasonDialogProps`, `ReasonDialogLabels` |

### Three things that are NOT barrel exports

| Thing | Import path | Why |
| --- | --- | --- |
| `AccessMode`, `ACCESS_MODES`, `isAccessMode`, `accessModeCapabilities`, `AccessModeCapabilities` | `@/lib/access-mode` | `ReadOnlyGate` (design-system) and `useAccessMode` (hooks) both need it, and `design-system → hooks` is a forbidden direction — [file-architecture.md](../architecture/file-architecture.md#dependency-direction). `lib` is the shared spine both may import, exactly as `NormalizedApiError` already works. |
| `useAccessMode`, `AccessModeState` | `@/hooks/useAccessMode` | A hook, not a design-system piece |
| `useUnsavedChangesGuard`, `UnsavedChangesGuard` | `@/hooks/useUnsavedChangesGuard` | Same |

### `knip` will be red until this merge lands

Nothing imports the nine new pattern files yet, because the only legal import
path for feature code is the barrel. `pnpm knip` therefore reports them — and
both new hooks, and `src/lib/access-mode.ts` — as unused files. Adding the
lines above clears the pattern files; the two hooks and `src/lib/access-mode.ts`
clear when the first screen consumes them (phase 4).

`typecheck`, `lint`, `test` and `design:rtl` are already green on all of it.

---

## 2. Dictionary keys

Add to `ar.ts` first — it defines the `Dictionary` type that `en.ts` is checked
against. Arabic strings below are proposals: they are correct in meaning and
register, and the dictionary owner should still read them.

Every one of these is passed **into** a component as a `labels` prop. No
pattern in this batch imports `useI18n`.

### `conflict` — task 1.25

```ts
conflict: {
  yourChanges: "تغييراتك",
  theirChanges: "النسخة المحفوظة",
  reload: "إعادة التحميل وإعادة التطبيق",
  overwrite: "الكتابة فوق التغييرات",
  cancel: "إلغاء",
  title: "تغيّر هذا السجل أثناء تحريرك له",
  description: "حفظ شخص آخر تغييرات على السجل نفسه. اختر أي نسخة تبقى."
},
```

```ts
conflict: {
  yourChanges: "Your changes",
  theirChanges: "Saved version",
  reload: "Reload and reapply",
  overwrite: "Overwrite their changes",
  cancel: "Cancel",
  title: "This record changed while you were editing",
  description: "Someone else saved changes to the same record. Choose which version survives."
},
```

`title` and `description` are props, not part of `labels` — a screen with a
more specific wording passes its own.

### `ambiguousOutcome` — task 1.26

```ts
ambiguousOutcome: {
  title: "قد لا يكون هذا الحفظ قد تم",
  description: "أُرسل الطلب ولم تصل نتيجته. قد يكون طُبّق وقد لا يكون.",
  operation: "العملية",
  idempotencyKey: "مفتاح عدم التكرار",
  correlationId: "معرّف الارتباط",
  retry: "إعادة المحاولة بالمفتاح نفسه",
  dismiss: "تجاهل"
},
```

```ts
ambiguousOutcome: {
  title: "This write may not have applied",
  description: "The request was sent and no result came back. It may or may not have been applied.",
  operation: "Operation",
  idempotencyKey: "Idempotency key",
  correlationId: "Correlation ID",
  retry: "Retry with the same key",
  dismiss: "Dismiss"
},
```

`retry`'s wording is load-bearing: the retry **must** replay the same
idempotency key, and the label says so.

### `notFound` — task 1.27

```ts
notFound: {
  title: "لم يعد هذا السجل موجودًا",
  description: "قد يكون حُذف، أو أن الرابط الذي وصلت منه قديم.",
  back: "العودة إلى القائمة"
},
```

```ts
notFound: {
  title: "This record no longer exists",
  description: "It was deleted, or the link you followed is out of date.",
  back: "Back to the list"
},
```

There is deliberately **no** `retry` key here.

### `accessMode` — task 1.29

```ts
accessMode: {
  blockedTitle: "الوصول إلى مساحة العمل موقوف",
  blockedDescription: "لم يعد الاشتراك يسمح بالوصول. تواصل مع مالك الحساب.",
  readOnlyNotice: "للقراءة فقط: لا يسمح الاشتراك بإجراء تغييرات حاليًا.",
  dunningNotice: "توجد فاتورة مستحقة — التعديلات موقوفة حتى سدادها."
},
```

```ts
accessMode: {
  blockedTitle: "This workspace is blocked",
  blockedDescription: "The subscription no longer permits access. Contact the account owner.",
  readOnlyNotice: "Read-only: the subscription does not permit changes right now.",
  dunningNotice: "Payment overdue — changes are suspended until the invoice is settled."
},
```

### `bulk` — task 1.30

`selection` and `summary` take numbers, so they are **functions**, formatted by
the caller through `Intl` with an explicit locale — the pattern receives a
finished string.

```ts
bulk: {
  selection: (count: number) => `${count} محدد`,
  clear: "إلغاء التحديد",
  confirmCancel: "إلغاء",
  resultTitle: "انتهت العملية الجماعية",
  summary: (succeeded: number, total: number) => `نجح ${succeeded} من ${total}`,
  failuresHeading: "لم تنجح",
  retryFailed: "إعادة محاولة ما لم ينجح",
  dismiss: "تجاهل"
},
```

```ts
bulk: {
  selection: (count: number) => `${count} selected`,
  clear: "Clear selection",
  confirmCancel: "Cancel",
  resultTitle: "Bulk action finished",
  summary: (succeeded: number, total: number) => `${succeeded} of ${total} succeeded`,
  failuresHeading: "Did not succeed",
  retryFailed: "Retry the ones that failed",
  dismiss: "Dismiss"
},
```

`BulkConfirmDialog`'s `title`, `description` and `confirm` are per-action and
come from the screen's own keys.

### `reasonDialog` — task 1.31

```ts
reasonDialog: {
  reason: "السبب",
  reasonPlaceholder: "اذكر السبب",
  reasonHintRequired: "مطلوب، ويُحفظ مع الإجراء."
},
```

```ts
reasonDialog: {
  reason: "Reason",
  reasonPlaceholder: "State the reason",
  reasonHintRequired: "Required, and stored with the action."
},
```

`confirm` / `cancel` come from the calling screen — `t.common.cancel` already
exists. The character counter renders digits only and needs no key.

### `asyncJob` — task 1.32

```ts
asyncJob: {
  queued: "في قائمة الانتظار",
  running: "قيد التنفيذ",
  succeeded: "جاهز",
  failed: "تعذّر التنفيذ",
  artifactExpired: "انتهت صلاحية الملف",
  download: "تنزيل",
  retry: "تشغيل من جديد",
  cancel: "إلغاء"
},
```

```ts
asyncJob: {
  queued: "Queued",
  running: "In progress",
  succeeded: "Ready",
  failed: "Could not complete",
  artifactExpired: "The file expired",
  download: "Download",
  retry: "Run again",
  cancel: "Cancel"
},
```

### `unsavedChanges` — task 1.33

The hook owns no UI; the page renders `ConfirmActionModal` from
`isPrompting`. `t.common.discard*` is about closing a **drawer**, so leaving a
**page** gets its own wording rather than being stretched to cover both.

```ts
unsavedChanges: {
  title: "مغادرة الصفحة دون حفظ؟",
  description: "لم تُحفظ تغييراتك. المغادرة الآن ستفقدها.",
  confirm: "المغادرة دون حفظ",
  cancel: "البقاء في الصفحة"
},
```

```ts
unsavedChanges: {
  title: "Leave without saving?",
  description: "Your changes have not been saved. Leaving now will lose them.",
  confirm: "Leave without saving",
  cancel: "Stay on this page"
},
```

### `statusValues` — task 1.34

Appended to the existing `statusValues` record. Keys are
`` `${StatusKind}.${WIRE_VALUE}` ``, matching how `StatusBadge` looks them up.
Wire values are transcribed from
`../backend/mutakamel-apps/core-app/packages/common/src/enums/` and verified
2026-08-30 — see [../design/tokens.md](../design/tokens.md#status-mapping).

```ts
"TenantStatus.PROVISIONING": "قيد التجهيز",
"TenantStatus.PROVISIONING_FAILED": "فشل التجهيز",
"TenantStatus.ACTIVE": "نشط",
"TenantStatus.SUSPENDED": "موقوف",
"TenantStatus.DELETED": "محذوف",
"UserStatus.INVITED": "مدعو",
"UserStatus.ACTIVE": "نشط",
"UserStatus.SUSPENDED": "موقوف",
"UserStatus.DEACTIVATED": "معطّل",
"SubscriptionStatus.TRIAL": "فترة تجريبية",
"SubscriptionStatus.PENDING_ACTIVATION": "بانتظار التفعيل",
"SubscriptionStatus.ACTIVE": "نشط",
"SubscriptionStatus.PAST_DUE": "متأخر السداد",
"SubscriptionStatus.CANCELLED": "ملغى",
"AccessMode.FULL": "وصول كامل",
"AccessMode.DUNNING": "تحصيل مستحقات",
"AccessMode.READ_ONLY": "قراءة فقط",
"AccessMode.BLOCKED": "موقوف",
```

```ts
"TenantStatus.PROVISIONING": "Provisioning",
"TenantStatus.PROVISIONING_FAILED": "Provisioning failed",
"TenantStatus.ACTIVE": "Active",
"TenantStatus.SUSPENDED": "Suspended",
"TenantStatus.DELETED": "Deleted",
"UserStatus.INVITED": "Invited",
"UserStatus.ACTIVE": "Active",
"UserStatus.SUSPENDED": "Suspended",
"UserStatus.DEACTIVATED": "Deactivated",
"SubscriptionStatus.TRIAL": "Trial",
"SubscriptionStatus.PENDING_ACTIVATION": "Pending activation",
"SubscriptionStatus.ACTIVE": "Active",
"SubscriptionStatus.PAST_DUE": "Past due",
"SubscriptionStatus.CANCELLED": "Cancelled",
"AccessMode.FULL": "Full access",
"AccessMode.DUNNING": "Payment overdue",
"AccessMode.READ_ONLY": "Read-only",
"AccessMode.BLOCKED": "Blocked",
```

`statusValues` is typed `as Record<string, string>`, so these need no type
change — but `StatusKind` in
`src/design-system/patterns/status-badge/tone-map.ts` was already extended
with `TenantStatus`, `UserStatus`, `SubscriptionStatus` and `AccessMode`, and
that file **is** merged.

---

## 3. After the merge

1. `pnpm verify` — `knip` should now pass for the nine pattern files.
2. The two hooks and `src/lib/access-mode.ts` stay knip-unused until phase 4
   consumes them. If that is unacceptable before then, add
   `src/hooks/**` to `knip.json`'s `ignore` rather than deleting the work.
3. Two open questions were raised by this batch and must not be lost —
   **Q15** (a 202 job publishes no status enum) and **Q16** (access mode is not
   readable by a non-owner user) in
   [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md).
