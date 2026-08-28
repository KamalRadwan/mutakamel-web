# Phase 3 — Components

Written: **2026-08-27**

Build the design system. **No screen conversion in this phase** — build the
pieces, then convert in phase 4.

## 1. Radix dependencies

The install list is in
[../design/primitives.md](../design/primitives.md#dependencies-to-install).

## 2. The 21 primitives

`src/design-system/primitives/`, one file each. Exact specs in
[primitives.md](../design/primitives.md).

Build in dependency order:

1. `Button`, `Input`, `Textarea`, `Label`, `Field`
2. `Card`, `Badge`, `Separator`, `Skeleton`
3. `Select`, `Checkbox`, `RadioGroup`, `Switch`
4. `Dialog`, `AlertDialog`, `Sheet`
5. `Tabs`, `DropdownMenu`, `Popover`, `Tooltip`, `Avatar`, `ScrollArea`
6. `Table`

Two traps, both of which shipped in the sibling portal:

- **`Button` with `asChild` and `loading`** — render the spinner sibling only
  when **not** `asChild`. Radix `Slot` requires exactly one child element, and
  an unconditional sibling breaks it.
- **`Sheet` side** — the prop is logical (`start` / `end`) and resolves
  direction internally, so consumers never branch on `dir`.

## 3. Feedback

```bash
pnpm add sonner
```

`ToastProvider`, `useToast`, `AppToast`, `format-api-error`. Keep
`src/components/ui/ToastContext` as a thin re-export during conversion so
existing imports keep working; delete it at the end of phase 4.

The transport dispatches a window `CustomEvent("global-toast")` for 403s —
`ToastProvider` must still listen for it, or forbidden responses go silent.

## 4. The 12 patterns

`src/design-system/patterns/`, specs in
[patterns.md](../design/patterns.md).

`DataTable` is the large one. Build it first and build it properly — three
screens depend on it, and it owns server pagination, sorting, selection,
sticky headers, keyboard navigation and the loading skeleton.

## 5. The three views

`src/design-system/views/` — `BoardView`, `CardView`, `TableView`,
`ViewSwitcher`. Full contract in [views.md](../design/views.md).

These are generic and prop-driven. A view never fetches, never reads the
dictionary directly, and never knows which entity it is rendering.

`ViewSwitcher` replaces D10, the hue-coded switcher.

## 6. Shell

`AppShell`, `Sidebar`, `Topbar`, `MobileNav`, `nav-config.ts`,
`useNavTree.ts`, `useSidebar.ts`. Spec in [shell.md](../design/shell.md).

Introduces `--size-topbar`, which fixes D6's three conflicting heights.

Carry `canAccessCrmRoute`'s permission logic over from
`lib/navigation/tenant-routes.ts` **verbatim** — only its output shape changes,
from hook-computed booleans to data a sidebar iterates. Its tests carry over
unchanged, which is the proof you did not alter behavior.

## 7. Barrel

`src/design-system/index.ts` exports everything. Add the ESLint rule blocking
deep design-system imports **now**, so phase 4 cannot create violations.

## Gate

```bash
rm -rf .next && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Plus the per-component checklists at the end of
[primitives.md](../design/primitives.md) and
[patterns.md](../design/patterns.md).

Write tests as you build, not after:

- `Button` — loading state, and `asChild` composition
- `Field` — `htmlFor`, `aria-describedby`, `aria-invalid` wiring
- `Dialog` — focus trap, `Esc`, focus restoration
- `DataTable` — pagination and sort callbacks, empty and error states
- `ViewSwitcher` — keyboard navigation, `aria-checked`
- `StatusBadge` — unmapped value falls back rather than throwing
