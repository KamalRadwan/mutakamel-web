"use client";

import { useId } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { proseMeasure } from "../../lib/variants";

// One column is the floor at every width: two boxes side by side below `md`
// leaves neither wide enough for an Arabic label, and a wrapped label is a
// taller row than the column ever saved. Three only appears from `xl`, where
// the modal is genuinely wide.
//
// Each column is CAPPED at 20rem rather than taking an equal fraction of the
// row. A full-viewport modal leaves about 1600px of body on a desktop, and
// three equal fractions of that made a postal-code box 500px wide: every field
// looked the same size as every other, and the form read as a wall. 20rem is a
// field the size of what goes in it, and a bounded column lets a row end where
// its fields end. Written out in full because Tailwind reads these class names
// as text — an interpolated constant would generate nothing.
const sectionGrid = cva("grid gap-x-4 gap-y-3", {
  variants: {
    columns: {
      1: "grid-cols-1",
      2: "grid-cols-1 md:grid-cols-[repeat(2,minmax(0,20rem))]",
      3: "grid-cols-1 md:grid-cols-[repeat(2,minmax(0,20rem))] xl:grid-cols-[repeat(3,minmax(0,20rem))]",
    },
  },
  defaultVariants: { columns: 2 },
});

export interface FormSectionProps {
  /** Must match the `id` of the `FormModal` section that indexes it. */
  id: string;
  title: string;
  description?: string;
  columns?: 1 | 2 | 3;
  /** A control that belongs to the section rather than to one field — "Add contact". */
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * One titled group of fields inside a `FormModal`.
 *
 * `data-form-section` is the contract with the modal: it is how the index
 * finds this block to scroll to and how the scroll position resolves back to
 * an index entry. The heading takes `tabIndex={-1}` so a jump from the index
 * can land focus on it — a scroll alone moves the eye and leaves the keyboard
 * behind.
 *
 * A field that carries prose — a textarea, a long hint — spans the whole row
 * with `className="md:col-span-2 xl:col-span-3"` at the call site rather than
 * a prop here: only the call site knows which of its fields those are.
 */
export function FormSection({
  id,
  title,
  description,
  columns,
  action,
  className,
  children,
}: FormSectionProps) {
  const headingId = useId();

  return (
    <section
      data-form-section={id}
      aria-labelledby={headingId}
      // Clears the sticky header band when the index scrolls this into view.
      className={cn("scroll-mt-4", className)}
    >
      <div className="mb-3 flex items-start justify-between gap-3 border-b border-border pb-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3
            id={headingId}
            tabIndex={-1}
            className="text-sm font-semibold text-foreground outline-none"
          >
            {title}
          </h3>
          {description && (
            <p className={cn("text-xs text-muted-foreground", proseMeasure)}>{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={sectionGrid({ columns })}>{children}</div>
    </section>
  );
}
