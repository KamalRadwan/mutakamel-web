"use client";

import { createContext, useContext } from "react";

/**
 * What a `Field` publishes to the control inside it.
 *
 * `Field` used to push these onto its direct child with `cloneElement`, which
 * silently did nothing whenever the direct child was not the focusable
 * element: a Radix context component that renders no DOM (`Select.Root`), a
 * positioning wrapper (`<div className="relative">` around a password input),
 * or a feature component that never forwarded what it was handed. The label
 * then pointed at an id that either did not exist or landed on a `<div>`.
 *
 * Inverting it fixes the whole family at once — the CONTROL finds the field
 * rather than the field guessing which child is the control, so it works at
 * any depth and through any wrapper.
 */
export interface FieldControlContextValue {
  /**
   * The id `Field`'s `<Label htmlFor>` points at. Exactly one control may take
   * it. A button is a labelable element, so this names a Radix select trigger
   * or a composite's trigger as directly as it names an `<input>` — no
   * `aria-labelledby` indirection needed.
   */
  controlId: string;
  /** Hint and error ids, already filtered to the text that actually renders. */
  describedBy?: string;
  invalid: boolean;
  required?: boolean;
  readOnly?: boolean;
}

const FieldControlContext = createContext<FieldControlContextValue | null>(null);

export function FieldControlProvider({
  value,
  children,
}: {
  value: FieldControlContextValue;
  children: React.ReactNode;
}) {
  return <FieldControlContext.Provider value={value}>{children}</FieldControlContext.Provider>;
}

/**
 * Everything below this point is **not** the enclosing `Field`'s control.
 *
 * Two uses, and they are the same rule seen from both sides:
 *
 * 1. Inside a composite (`Combobox`, `MultiSelect`) whose popover holds its own
 *    search `<Input>`. The composite has already claimed the field for its
 *    trigger; without this the search box would claim the same id a second time
 *    and `htmlFor` would resolve to whichever came first in the document.
 * 2. At a call site where one label covers two controls — a day picker beside a
 *    time input. The label names the primary one; the secondary carries its own
 *    `aria-label` and opts out here.
 */
export function FieldControlBoundary({ children }: { children: React.ReactNode }) {
  return <FieldControlContext.Provider value={null}>{children}</FieldControlContext.Provider>;
}

/**
 * The raw field, for a composite that needs `invalid` / `readOnly` as behaviour
 * (styling, whether the popover may open) and not only as ARIA.
 */
export function useFieldControlContext(): FieldControlContextValue | null {
  return useContext(FieldControlContext);
}

/**
 * The subset of a control's own props the merge looks at. Deliberately mirrors
 * React's own `AriaAttributes` types (`Booleanish`, not `boolean`) so any DOM
 * prop bag is accepted whole — every consumer passes `props` straight in.
 */
export interface FieldControlOwnProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  "aria-required"?: React.AriaAttributes["aria-required"];
  "aria-readonly"?: React.AriaAttributes["aria-readonly"];
  readOnly?: boolean;
}

export type FieldControlAria = FieldControlOwnProps;

export interface FieldControlOptions {
  /**
   * Also resolve the **native** `readOnly` attribute. Only `<input>` and
   * `<textarea>` have one — putting it on a button element (a Radix select trigger,
   * a switch) renders a meaningless `readonly=""`, so those take `aria-readonly`
   * alone.
   */
  nativeReadOnly?: boolean;
}

function joinIds(...ids: (string | undefined)[]): string | undefined {
  const parts = ids.filter(Boolean).join(" ").split(" ").filter(Boolean);
  return parts.length > 0 ? [...new Set(parts)].join(" ") : undefined;
}

/**
 * Claims the enclosing `Field` for this control and returns the props to spread
 * onto its focusable element.
 *
 * The control's own props always win, so a call site can still override any
 * single wire without losing the rest. Returns own props unchanged when there
 * is no `Field` above, which is what makes every one of these primitives usable
 * standalone — in a `FilterBar`, a toolbar, a table cell.
 */
export function useFieldControl(
  own: FieldControlOwnProps = {},
  { nativeReadOnly = false }: FieldControlOptions = {},
): FieldControlAria {
  const field = useContext(FieldControlContext);
  if (!field) return own;

  const readOnly = own.readOnly ?? field.readOnly;

  return {
    id: own.id ?? field.controlId,
    "aria-describedby": joinIds(own["aria-describedby"], field.describedBy),
    "aria-invalid": own["aria-invalid"] ?? field.invalid,
    "aria-required": own["aria-required"] ?? field.required,
    "aria-readonly": own["aria-readonly"] ?? (readOnly || undefined),
    ...(nativeReadOnly ? { readOnly } : {}),
  };
}
