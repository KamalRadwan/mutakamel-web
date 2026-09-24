"use client";

import { type MouseEvent, useMemo } from "react";
import { isSameDay, isSameMonth } from "date-fns";
import { cn } from "../../lib/cn";
import { Button } from "../../primitives/Button";
import { CalendarItem } from "./CalendarItem";
import { atMinute, dayKey, isToday, type CalendarEntry, type CalendarGridProps } from "./calendar-grid";
import { overlapsDay } from "./calendar-layout";
import { calendarDayStart } from "./calendar-range";
import { initialStop, useCalendarFocus, type FocusGrid } from "./useCalendarFocus";

// A month day shows this many items and folds the rest into "+N more", which
// opens the day. A fixed count keeps every week the same height.
const VISIBLE_ITEMS = 3;

// An empty month day has no time to click, so it proposes the start of the
// working day.
const MONTH_SLOT_MINUTE = 9 * 60;

interface MonthCell<T> {
  day: Date;
  key: string;
  shown: CalendarEntry<T>[];
  hidden: number;
}

// Clicks on a control in the cell belong to that control; only the cell's
// empty space proposes a new item.
function fromControl(event: MouseEvent<HTMLElement>): boolean {
  return event.target instanceof Element && event.target.closest("button") !== null;
}

// Six fixed weeks under a weekday header. Days outside the anchor's month are
// muted, today is marked by weight and a hairline ring — never a hue, the same
// rule as the date picker — and a full day folds into "+N more".
export function CalendarMonthGrid<T>({
  view,
  days,
  entries,
  now,
  format,
  titleId,
  create,
  onOpenDay,
}: CalendarGridProps<T>) {
  const cells = useMemo(
    () =>
      days.map((day): MonthCell<T> => {
        const onDay = entries
          .filter((entry) => overlapsDay(entry, day, calendarDayStart(day, 1)))
          .sort((a, b) => a.start.getTime() - b.start.getTime() || a.key.localeCompare(b.key));
        return {
          day,
          key: dayKey(day),
          shown: onDay.slice(0, VISIBLE_ITEMS),
          hidden: Math.max(onDay.length - VISIBLE_ITEMS, 0),
        };
      }),
    [days, entries],
  );

  const activatable = Boolean(view.onItemActivate);
  // Every day has its date button, so the arrows never meet an empty day here.
  const focusGrid = useMemo<FocusGrid>(
    () => ({
      days: cells.map((cell) => [
        { key: `date:${cell.key}`, position: 0 },
        ...(activatable ? cell.shown.map((entry) => ({ key: `item:${cell.key}:${entry.key}`, position: 0 })) : []),
        ...(cell.hidden > 0 ? [{ key: `more:${cell.key}`, position: 0 }] : []),
      ]),
      rowLength: 7,
      wrapsVertically: true,
    }),
    [cells, activatable],
  );
  const todayIndex = days.findIndex((day) => isToday(day, now));
  const startDay = todayIndex !== -1 ? todayIndex : Math.max(days.findIndex((day) => isSameDay(day, view.anchor)), 0);
  const focus = useCalendarFocus(focusGrid, initialStop(focusGrid, startDay, 0));

  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, week) => cells.slice(week * 7, week * 7 + 7));

  return (
    <div
      role="grid"
      aria-labelledby={titleId}
      onKeyDown={focus.onKeyDown}
      className="isolate flex h-full min-h-0 flex-col overflow-auto rounded-md border border-border bg-card"
    >
      <div role="row" className="sticky top-0 z-(--z-sticky-header) grid shrink-0 grid-cols-7 border-b border-border bg-card">
        {cells.slice(0, 7).map((cell) => (
          <div
            key={cell.key}
            role="columnheader"
            aria-label={format.weekdayLong(cell.day)}
            className="flex h-8 min-w-0 items-center px-2 text-xs text-muted-foreground"
          >
            <span className="truncate">{format.weekday(cell.day)}</span>
          </div>
        ))}
      </div>

      {weeks.map((week) => (
        <div key={week[0].key} role="row" className="grid min-h-34 flex-1 grid-cols-7 border-b border-border last:border-b-0">
          {week.map((cell) => {
            const today = isToday(cell.day, now);
            const outside = !isSameMonth(cell.day, view.anchor);
            return (
              <div
                key={cell.key}
                role="gridcell"
                aria-current={today ? "date" : undefined}
                // Pointer only, by design: the keyboard's way to the same
                // result is the date button, which opens the day and its
                // half-hour targets.
                onClick={
                  create
                    ? (event) => {
                        if (!fromControl(event)) create.activate(atMinute(cell.day, MONTH_SLOT_MINUTE));
                      }
                    : undefined
                }
                className={cn(
                  "flex min-w-0 flex-col gap-0.5 border-e border-border p-1 last:border-e-0",
                  outside && "bg-muted/40",
                  create && "cursor-pointer",
                )}
              >
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="xs"
                    aria-label={format.dayLabel(cell.day)}
                    onClick={() => onOpenDay(cell.day)}
                    className={cn(
                      "min-w-6 scroll-mt-8 px-1 font-normal tabular-nums",
                      outside && "text-muted-foreground",
                      today && "font-medium ring-1 ring-border ring-inset",
                    )}
                    {...focus.stopProps(`date:${cell.key}`)}
                  >
                    {format.dayNumber(cell.day)}
                  </Button>
                  {cell.day.getDate() === 1 && (
                    <span aria-hidden="true" className="truncate text-xs text-muted-foreground">
                      {format.monthShort(cell.day)}
                    </span>
                  )}
                </div>

                {cell.shown.map((entry) => (
                  <CalendarItem
                    key={entry.key}
                    view={view}
                    item={entry.item}
                    layout="month"
                    className="scroll-mt-8"
                    stop={focus.stopProps(`item:${cell.key}:${entry.key}`)}
                  />
                ))}

                {cell.hidden > 0 && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => onOpenDay(cell.day)}
                    className="scroll-mt-8 self-start px-1 font-normal text-muted-foreground"
                    {...focus.stopProps(`more:${cell.key}`)}
                  >
                    {view.labels.moreItems(cell.hidden)}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
