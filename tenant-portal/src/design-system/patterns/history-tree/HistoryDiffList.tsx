"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import type { HistoryDiffRow } from "./history-tree-types";

export interface HistoryDiffListProps {
  rows: HistoryDiffRow[];
  /** Shown when `rows` is empty and no `footer` alone suffices. */
  emptyMessage?: string;
  /** Optional trailing note (e.g. audit reason line). */
  footer?: ReactNode;
  className?: string;
}

function renderSide(value: ReactNode, side: "before" | "after"): ReactNode {
  if (typeof value === "string" || typeof value === "number") {
    return (
      <span
        className={
          side === "before"
            ? "break-words text-danger-600 line-through dark:text-danger-300"
            : "break-words text-foreground"
        }
        dir="auto"
      >
        {value}
      </span>
    );
  }
  return value;
}

/**
 * Canonical field-level diff list shared across all History & Audit surfaces.
 *
 * Keeps chronological `before > after` order LTR even inside RTL pages while
 * letting each individual value resolve its own text direction via `dir="auto"`.
 */
export function HistoryDiffList({
  rows,
  emptyMessage,
  footer,
  className,
}: HistoryDiffListProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {rows.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {rows.map((row) => {
            const showTransition = row.showTransition ?? true;
            return (
              <div
                key={row.key}
                className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-xs"
              >
                <span className="font-semibold text-foreground">{row.label}:</span>
                {showTransition ? (
                  <span className="flex flex-wrap items-baseline gap-1.5" dir="ltr">
                    {renderSide(row.before, "before")}
                    <span className="text-muted-foreground">&gt;</span>
                    {renderSide(row.after, "after")}
                  </span>
                ) : (
                  <span className="flex flex-wrap items-baseline gap-1.5">
                    {renderSide(row.after, "after")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : emptyMessage ? (
        <span className="text-xs text-muted-foreground">{emptyMessage}</span>
      ) : null}

      {footer ? <span className="text-xs text-foreground">{footer}</span> : null}
    </div>
  );
}
