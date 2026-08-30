# Component Specification: `FormDrawer`

Status: **[Approved target; current implementation partial]**

Last source verification: **2026-08-29**

## Purpose

`FormDrawer` is the shared create/edit sheet for focused forms that should keep
the parent page visible. Complex mobile workflows may render the same form as a
full-screen step flow.

## Target API shape

```typescript
export interface FormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  titleEn: string;
  titleAr: string;
  subtitleEn?: string;
  subtitleAr?: string;
  children: React.ReactNode;
  footerActions?: React.ReactNode;
  width?: "sm" | "md" | "lg" | "xl"; // 400 / 540 / 720 / 900px
  isDirty?: boolean;
  isSubmitting?: boolean;
  errorSummary?: React.ReactNode;
}
```

## Layout and motion

- Opens from the logical end edge and mirrors under RTL.
- Uses the semantic modal scrim; decorative backdrop blur is not allowed.
- Width is constrained on desktop and full-width on narrow screens.
- Header and footer remain reachable while the form body owns vertical scroll.
- Footer padding respects mobile safe-area insets.
- Motion uses transform/opacity, completes in 150–250ms, and renders the stable
  end state under reduced motion.

## Forms and focus

- Opening focuses the heading or first appropriate field.
- Closing returns focus to the invoking control.
- `Escape` or close invokes the dirty-state guard when `isDirty` is true.
- The close control has a localized accessible name.
- Validation remains inline; multi-field failures render a focusable summary and
  focus that summary; a single field failure focuses the field.
- During submission, duplicate submission is disabled while Cancel remains
  available only when cancellation is safe.
- Ambiguous outcomes use the persistent operational recovery pattern rather than
  a disappearing toast.

## Action hierarchy

The footer has one filled primary action. Cancel is secondary/ghost. Additional
actions move to a contextual menu or separate decision surface.
