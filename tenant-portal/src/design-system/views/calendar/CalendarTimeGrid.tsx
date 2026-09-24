"use client";

import { type CSSProperties, useMemo } from "react";
import { isSameDay } from "date-fns";
import { cn } from "../../lib/cn";
import { Button } from "../../primitives/Button";
import { CalendarItem } from "./CalendarItem";
import { atMinute, dayKey, isToday, type CalendarGridProps } from "./calendar-grid";
import { DAY_MINUTES, layoutDay, minuteOfDay, type TimedPlacement } from "./calendar-layout";
import { calendarDayStart } from "./calendar-range";
import { initialStop, useCalendarFocus, type FocusGrid, type FocusStop } from "./useCalendarFocus";
import { useScrollToHour } from "./useScrollToHour";

const SLOT_MINUTES = 30;
const SLOT_STARTS = Array.from({ length: DAY_MINUTES / SLOT_MINUTES }, (_, index) => index * SLOT_MINUTES);
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

// Where the grid opens when today is not on screen: the start of a working day.
const DEFAULT_OPENING_HOUR = 7;

// Hour labels are read off a fixed date on which no time zone changes its
// clocks, so a daylight-saving day cannot skip or repeat a label.
const LABEL_DAY = new Date(2000, 0, 1);

// Stops at or under the sticky header and gutter scroll clear of them, so a
// focused control is never hidden behind the chrome that stays put
// (WCAG 2.2 focus-not-obscured). The two sizes are the header's h-12 and the
// gutter's w-14.
const CLEAR_OF_STICKY = "scroll-mt-12 scroll-ms-14";

const percentOfDay = (minutes: number) => `${(minutes / DAY_MINUTES) * 100}%`;

function placementStyle<T>(placement: TimedPlacement<T>): CSSProperties {
  return {
    top: percentOfDay(placement.top),
    height: percentOfDay(placement.height),
    // Logical, so side-by-side lanes mirror with the page.
    insetInlineStart: `${(placement.lane / placement.lanes) * 100}%`,
    // A hairline short, so two blocks side by side read as two.
    width: `calc(${(placement.span / placement.lanes) * 100}% - 2px)`,
  };
}

// Week and day: 48px an hour under a sticky day header, beside a sticky hour
// gutter. Items are placed by their start and end (clamped to the day), and
// overlapping ones share the width as lanes. A week that does not fit
// scrolls sideways rather than squeezing seven columns under a readable width.
export function CalendarTimeGrid<T>({
  view,
  days,
  entries,
  now,
  format,
  titleId,
  create,
  onOpenDay,
}: CalendarGridProps<T>) {
  const isWeek = days.length > 1;
  const columns = useMemo(
    () => days.map((day) => ({ day, key: dayKey(day), placements: layoutDay(entries, day, calendarDayStart(day, 1)) })),
    [days, entries],
  );

  const todayIndex = days.findIndex((day) => isToday(day, now));
  const openingHour = todayIndex !== -1 && now ? now.getHours() : DEFAULT_OPENING_HOUR;
  const { scrollerRef, hourRef } = useScrollToHour(openingHour);

  const creatable = create !== undefined;
  const activatable = Boolean(view.onItemActivate);
  const focusGrid = useMemo<FocusGrid>(
    () => ({
      days: columns.map((column) => {
        const stops: FocusStop[] = [];
        if (isWeek) stops.push({ key: `head:${column.key}`, position: -1 });
        if (creatable) {
          for (const minute of SLOT_STARTS) stops.push({ key: `slot:${column.key}:${minute}`, position: minute });
        }
        if (activatable) {
          // Half a minute after the slot it starts in, so Down from that slot
          // lands on the item before the next slot.
          for (const placement of column.placements) {
            stops.push({ key: `item:${column.key}:${placement.entry.key}`, position: placement.top + 0.5 });
          }
        }
        return stops.sort((a, b) => a.position - b.position);
      }),
      rowLength: days.length,
      wrapsVertically: false,
    }),
    [columns, days.length, isWeek, creatable, activatable],
  );
  const startColumn = todayIndex !== -1 ? todayIndex : Math.max(days.findIndex((day) => isSameDay(day, view.anchor)), 0);
  // In a week the tab stop starts on a day's heading, which the sticky header
  // keeps in view; in a day it starts where the grid opened.
  const focus = useCalendarFocus(focusGrid, initialStop(focusGrid, startColumn, isWeek ? -1 : openingHour * 60));

  const columnWidth = isWeek ? "min-w-28" : "min-w-0";

  return (
    <div
      ref={scrollerRef}
      role="grid"
      aria-labelledby={titleId}
      onKeyDown={focus.onKeyDown}
      className="isolate h-full min-h-0 overflow-auto rounded-md border border-border bg-card"
    >
      <div className="flex w-max min-w-full flex-col">
        <div role="row" className="sticky top-0 z-(--z-sticky-header) flex h-12 border-b border-border bg-card">
          <div aria-hidden="true" className="sticky start-0 z-(--z-sticky-cell) w-14 shrink-0 border-e border-border bg-card" />
          {columns.map((column) => {
            const face = (
              <>
                <span className="text-muted-foreground">{format.weekday(column.day)}</span>
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-sm tabular-nums",
                    isToday(column.day, now) && "font-medium ring-1 ring-border ring-inset",
                  )}
                >
                  {format.dayNumber(column.day)}
                </span>
              </>
            );
            return (
              <div
                key={column.key}
                role="columnheader"
                // In a week the heading is a button that names the day itself.
                aria-label={isWeek ? undefined : format.dayLabel(column.day)}
                className={cn("flex flex-1 items-center border-e border-border px-1 last:border-e-0", columnWidth)}
              >
                {isWeek ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={format.dayLabel(column.day)}
                    onClick={() => onOpenDay(column.day)}
                    className="w-full justify-start gap-1 px-1.5 font-normal"
                    {...focus.stopProps(`head:${column.key}`)}
                  >
                    {face}
                  </Button>
                ) : (
                  <div className="flex items-center gap-1 px-1.5 text-xs">{face}</div>
                )}
              </div>
            );
          })}
        </div>

        <div role="row" className="flex">
          <div ref={hourRef} aria-hidden="true" className="sticky start-0 z-(--z-sticky-cell) w-14 shrink-0 border-e border-border bg-card">
            {HOURS.map((hour) => (
              <div key={hour} className="relative h-12">
                {/* Centred on the line it names. Midnight's would be cut off by
                    the header, and the first line needs no name. */}
                {hour > 0 && (
                  <span className="absolute end-2 top-0 -translate-y-1/2 text-xs whitespace-nowrap text-muted-foreground">
                    {format.hour(atMinute(LABEL_DAY, hour * 60))}
                  </span>
                )}
              </div>
            ))}
          </div>

          {columns.map((column) => {
            const today = isToday(column.day, now);
            return (
              <div
                key={column.key}
                role="gridcell"
                aria-current={today ? "date" : undefined}
                className={cn("relative flex-1 border-e border-border last:border-e-0", columnWidth)}
              >
                {/* Items first: they are what the day holds, so a screen reader
                    reaches them before the empty half-hours. Being positioned,
                    they still paint above the slots that follow. */}
                {column.placements.map((placement) => (
                  <CalendarItem
                    key={placement.entry.key}
                    view={view}
                    item={placement.entry.item}
                    layout="timed"
                    style={placementStyle(placement)}
                    className={CLEAR_OF_STICKY}
                    stop={focus.stopProps(`item:${column.key}:${placement.entry.key}`)}
                  />
                ))}

                {create
                  ? SLOT_STARTS.map((minute) => {
                      const start = atMinute(column.day, minute);
                      return (
                        <Button
                          key={minute}
                          variant="ghost"
                          aria-label={create.label(start)}
                          onClick={() => create.activate(start)}
                          className={cn(
                            "block h-6 w-full rounded-none p-0 focus-visible:ring-inset focus-visible:ring-offset-0",
                            CLEAR_OF_STICKY,
                            minute % 60 === SLOT_MINUTES && minute < DAY_MINUTES - SLOT_MINUTES && "border-b border-border",
                          )}
                          {...focus.stopProps(`slot:${column.key}:${minute}`)}
                        />
                      );
                    })
                  : HOURS.map((hour) => <div key={hour} className={cn("h-12", hour < 23 && "border-b border-border")} />)}

                {today && now && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 h-0.5 -translate-y-1/2 bg-foreground"
                    style={{ top: percentOfDay(minuteOfDay(now, column.day, calendarDayStart(column.day, 1))) }}
                  >
                    <span className="absolute -start-1 top-1/2 size-2 -translate-y-1/2 rounded-full bg-foreground" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
