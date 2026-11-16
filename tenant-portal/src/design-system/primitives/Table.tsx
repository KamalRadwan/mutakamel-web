"use client";

import { forwardRef } from "react";
import { cn } from "../lib/cn";
import { useSettingsPresentation } from "../shell/settings-presentation";

// Bare semantic wrappers. Feature code does not use these directly — a
// screen's table is DataTable (src/design-system/patterns/data-table/).
// These exist for DataTable to build on and for the rare genuinely-static
// table.

export const Table = forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => {
    const settings = useSettingsPresentation();
    return (
      <div className="relative w-full overflow-x-auto">
        <table ref={ref} className={cn("w-full caption-bottom text-sm", className, settings && "text-xs")} {...props} />
      </div>
    );
  },
);
Table.displayName = "Table";

export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("border-b border-border bg-muted [&_tr]:border-b-0", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
TableBody.displayName = "TableBody";

export const TableRow = forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => {
    const settings = useSettingsPresentation();
    return (
      <tr
        ref={ref}
        className={cn(
          "h-(--size-row) border-b border-border odd:bg-row-zebra transition-colors hover:bg-accent data-[state=selected]:bg-accent",
          settings && "h-9",
          className,
        )}
        {...props}
      />
    );
  },
);
TableRow.displayName = "TableRow";

export const TableHead = forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => {
  const settings = useSettingsPresentation();
  return (
    <th
      ref={ref}
      className={cn(
        "h-9 px-4 text-start align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground",
        "rtl:normal-case rtl:tracking-normal [&:has([role=checkbox])]:pe-0",
        className,
        settings && "h-8 px-2.5 font-medium normal-case tracking-normal",
      )}
      {...props}
    />
  );
});
TableHead.displayName = "TableHead";

export const TableCell = forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => {
  const settings = useSettingsPresentation();
  return (
    <td
      ref={ref}
      className={cn("px-4 py-3 align-middle font-normal text-foreground [&:has([role=checkbox])]:pe-0", settings && "px-2.5 py-1", className)}
      {...props}
    />
  );
});
TableCell.displayName = "TableCell";
