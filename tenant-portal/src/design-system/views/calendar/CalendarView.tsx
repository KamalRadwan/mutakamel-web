"use client";

import { useId, useMemo } from "react";
import { startOfDay } from "date-fns";
import { useLanguage } from "@/i18n/useLanguage";
import { cn } from "../../lib/cn";
import { EmptyState } from "../../patterns/empty-state/EmptyState";
import { ErrorState } from "../../patterns/error-state/ErrorState";
import { Skeleton } from "../../primitives/Skeleton";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { CalendarTimeGrid } from "./CalendarTimeGrid";
import { CalendarToolbar } from "./CalendarToolbar";
import { calendarFormat } from "./calendar-format";
import { rangeDays, shiftAnchor, type CalendarEntry, type CalendarGridProps, type SlotCreation } from "./calendar-grid";
import { overlapsDay } from "./calendar-layout";
import { calendarRange, type CalendarMode } from "./calendar-range";
import type { CalendarViewProps } from "./types";
import { useNow } from "./useNow";

// Shaped like the grid it stands in for, at the pane's full height, so
// nothing moves when the items arrive.
const SKELETON: Record<CalendarMode, { cells: number; className: string }> = {
  month: { cells: 42, className: "grid-cols-7 grid-rows-6" },
  week: { cells: 7, className: "grid-cols-7" },
  day: { cells: 1, className: "grid-cols-1" },
};

function CalendarSkeleton({ mode }: { mode: CalendarMode }) {
  const { cells, className } = SKELETON[mode];
  return (
    <div aria-hidden="true" className={cn("grid h-full gap-1", className)}>
      {Array.from({ length: cells }, (_, index) => (
        <Skeleton key={`calendar-skeleton-${index}`} className="h-full rounded-sm" />
      ))}
    </div>
  );
}

// Month, week and day over one list of items. Generic and prop-driven like the
// other views: it never fetches, never reads the dictionary and never owns a
// mutation — the screen fetches `calendarRange(mode, anchor, weekStartsOn)`
// and hands over whatever it got. See docs/design/views.md#calendar-view.
export function CalendarView<T>(props: CalendarViewProps<T>) {
  const {
    mode,
    onModeChange,
    anchor,
    onAnchorChange,
    weekStartsOn,
    items,
    itemKey,
    itemStart,
    itemEnd,
    onSlotActivate,
    isLoading,
    error,
    onRetry,
    emptyState,
    toolbarEnd,
    labels,
    className,
  } = props;
  // Formatting, not copy — the allowance Calendar and FilterBar take too.
  const language = useLanguage();
  const now = useNow();
  const titleId = useId();

  const format = useMemo(() => calendarFormat(language), [language]);
  const range = useMemo(() => calendarRange(mode, anchor, weekStartsOn), [mode, anchor, weekStartsOn]);
  const days = useMemo(() => rangeDays(range), [range]);
  const entries = useMemo(
    () => items.map((item): CalendarEntry<T> => ({ item, key: itemKey(item), start: itemStart(item), end: itemEnd(item) })),
    [items, itemKey, itemStart, itemEnd],
  );

  const slotLabel = labels.slotLabel;
  const create: SlotCreation | undefined =
    onSlotActivate && slotLabel ? { activate: onSlotActivate, label: slotLabel } : undefined;

  function openDay(day: Date) {
    onAnchorChange(day);
    onModeChange("day");
  }

  const grid: CalendarGridProps<T> = { view: props, days, entries, now, format, titleId, create, onOpenDay: openDay };
  const isEmpty = !entries.some((entry) => overlapsDay(entry, range.start, range.end));

  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-2", className)}>
      <CalendarToolbar
        mode={mode}
        onModeChange={onModeChange}
        title={format.title(mode, anchor, range)}
        titleId={titleId}
        onStep={(step) => onAnchorChange(shiftAnchor(mode, anchor, step))}
        onToday={() => onAnchorChange(startOfDay(new Date()))}
        end={toolbarEnd}
        labels={labels}
      />

      {/* Every state owns the full height of the pane, as on the board: a
          calendar that collapsed while loading would move everything under
          it twice. */}
      <div className="relative min-h-0 flex-1">
        {isLoading ? (
          <CalendarSkeleton mode={mode} />
        ) : error ? (
          <ErrorState
            title={labels.errorTitle}
            onRetry={onRetry}
            retryLabel={labels.retry}
            className="h-full rounded-md border border-border bg-card"
          />
        ) : (
          <>
            {mode === "month" ? <CalendarMonthGrid {...grid} /> : <CalendarTimeGrid {...grid} />}
            {/* Over the grid, not instead of it: an empty week is still a week
                to plan into, and a grid that stays put does not jump as the
                user pages between empty and busy periods. Only the notice
                itself takes the pointer. */}
            {isEmpty && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
                <div role="status" className="pointer-events-auto rounded-md border border-border bg-card shadow-pop">
                  {emptyState ?? <EmptyState title={labels.emptyTitle} />}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
