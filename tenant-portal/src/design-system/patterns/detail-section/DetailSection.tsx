"use client";

import { cn } from "../../lib/cn";
import { Card, CardContent, CardHeader, CardTitle } from "../../primitives/Card";

export interface DetailField {
  /** Already translated. */
  label: string;
  /** Rendered as-is. A `Money`, `DateTime`, `StatusBadge` or `CopyButton` node belongs here. */
  value: React.ReactNode;
  /** Spans both columns — an address, a long note. */
  wide?: boolean;
}

export interface DetailSectionProps {
  title: string;
  description?: string;
  fields?: DetailField[];
  /** Rendered under the fields — a contacts list, an `AttachmentList`, a `Timeline`. */
  children?: React.ReactNode;
  /** Rendered in the header, opposite the title. At most one small `ghost`/`outline` control. */
  action?: React.ReactNode;
  /** Placeholder for a field with no value. Already translated; never a raw dash decided here. */
  emptyValueLabel?: string;
  columns?: 1 | 2;
  className?: string;
}

/**
 * A labelled field group for read-mostly detail bodies.
 *
 * A definition list, not a table: these are attributes of one record, and a
 * `<table>` would announce row and column positions that carry no meaning.
 * Labels are `text-xs` muted, values `text-xs` weight 400 — the density
 * `DESIGN-SYSTEM.md#74-detail-screens` specifies.
 *
 * A field whose value is `null` or `undefined` still renders its label, with
 * `emptyValueLabel`. Hiding the row would leave the reader unable to tell
 * "not recorded" from "this record has no such field".
 */
export function DetailSection({
  title,
  description,
  fields,
  children,
  action,
  emptyValueLabel,
  columns = 2,
  className,
}: DetailSectionProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {fields && fields.length > 0 && (
          <dl className={cn("grid gap-3", columns === 2 && "sm:grid-cols-2")}>
            {fields.map((field, index) => (
              <div
                key={`${field.label}-${index}`}
                className={cn("min-w-0", field.wide && columns === 2 && "sm:col-span-2")}
              >
                <dt className="text-xs text-muted-foreground">{field.label}</dt>
                <dd className="mt-0.5 break-words text-xs text-foreground">
                  {field.value ?? (
                    <span className="text-muted-foreground">{emptyValueLabel}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
