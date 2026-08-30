# Component Specification: `ConfirmActionModal`

Status: **[Shared source implemented; runtime conformance pending]**

Last source verification: **2026-08-29**

## Purpose

`ConfirmActionModal` confirms significant, high-impact, or destructive operator
commands. It presents domain evidence; it does not invent DTO fields,
permissions, idempotency behavior, or audit requirements.

Use the relevant API guide and
[Operational UX](../design-system/operational-ux.md#confirmation-levels) to
choose the risk level.

## Current API shape

```typescript
export interface ConfirmActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  confirmTextEn?: string;
  confirmTextAr?: string;
  variant?: "danger" | "warning" | "info";
  requiredConfirmationText?: string;
  isLoading?: boolean;
  icon?: LucideIcon;
  iconClassName?: string;
  extraToggle?: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  };
  loadingLabel?: string;
}
```

The icon and toggle options preserve domain-specific presentation while the
shared AlertDialog owns focus, dismissal, pending, and typed-confirmation
behavior. They are not permission or backend payloads.

## Safety contract

- Name the affected resource and exact scope.
- Explain reversibility, retention blockers, and permanent consequences that the
  linked domain contract actually defines.
- The confirm label names the action; generic “Confirm” is reserved for truly
  generic low-risk cases.
- Typed confirmation preserves and compares the exact required string,
  including case, whitespace, and punctuation.
- Do not request or persist a reason unless the linked API contract requires it.
- Do not add a client `confirm` DTO field when the backend does not define one.
- Duplicate submission is disabled while pending.
- Ambiguous results leave the modal or route in a persistent recovery state with
  exact-retry/reconciliation evidence.

## Accessibility and responsive behavior

- Use alert-dialog semantics for high-risk confirmation.
- Initial focus goes to the safest context-appropriate control, normally Cancel.
- Escape cancels only while cancellation is safe.
- Closing returns focus to the invoking control unless the resource/navigation
  changed.
- Error feedback remains in the dialog and receives focus when submission fails.
- On narrow screens, consequences and evidence scroll while actions remain
  reachable above the safe-area inset.
- Motion follows reduced-motion preferences.

## Current conformance status

Typed confirmation now compares the entered value with the required value
exactly, including case, leading/trailing whitespace, punctuation, and Unicode
content. Focused component coverage rejects normalized near-matches and accepts
only the displayed string. Remaining evidence is runtime-dependent: verify
initial focus, focus return, narrow safe-area behavior, bilingual copy, and
submission failure recovery inside authenticated workflows.
