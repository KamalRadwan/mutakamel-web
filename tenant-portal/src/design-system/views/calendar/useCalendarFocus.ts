"use client";

import { type KeyboardEvent, useState } from "react";
import { useDirection } from "@/i18n/useLanguage";

// One focusable control in a day, and where it sits: minutes from midnight in
// the time grid (-1 for a day's heading), 0 throughout the month grid, where a
// day's controls simply stack.
export interface FocusStop {
  key: string;
  position: number;
}

// Spread onto every stop. The key is the stop's address for the arrow keys;
// only the active stop carries tabIndex 0.
export interface CalendarStopProps {
  "data-calendar-stop": string;
  tabIndex: number;
  onFocus: () => void;
}

export interface FocusGrid {
  // Each day's stops, top to bottom, in the order the range runs.
  days: readonly (readonly FocusStop[])[];
  // Days per drawn row: 7 in the month and the week, 1 in a day.
  rowLength: number;
  // The month's Up and Down run on into the week above or below; the time
  // grid is a single row and stops at its edges.
  wrapsVertically: boolean;
}

const NAVIGATION_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"] as const;
type NavigationKey = (typeof NAVIGATION_KEYS)[number];

function isNavigationKey(key: string): key is NavigationKey {
  return NAVIGATION_KEYS.some((candidate) => candidate === key);
}

// Moving sideways keeps the time of day: the first stop at or after the one
// being left, else the day's last.
function stopNear(stops: readonly FocusStop[], position: number): string {
  return (stops.find((stop) => stop.position >= position) ?? stops[stops.length - 1]).key;
}

// The first day from `day`, stepping by `step` inside [lower, upper), that has
// anything to focus. An empty day in the time grid is passed over, not landed on.
function scan(grid: FocusGrid, day: number, step: 1 | -1, position: number, lower = 0, upper = grid.days.length) {
  for (let index = day; index >= lower && index < upper; index += step) {
    const stops = grid.days[index];
    if (stops.length > 0) return stopNear(stops, position);
  }
  return undefined;
}

/** Where the grid's single tab stop sits before the user has moved it. */
export function initialStop(grid: FocusGrid, day: number, position: number): string | undefined {
  return scan(grid, day, 1, position) ?? scan(grid, day, -1, position);
}

function nextStop(grid: FocusGrid, key: string, command: NavigationKey, rtl: boolean): string | undefined {
  const day = grid.days.findIndex((stops) => stops.some((stop) => stop.key === key));
  if (day === -1) return undefined;
  const stops = grid.days[day];
  const index = stops.findIndex((stop) => stop.key === key);
  const { position } = stops[index];
  const rowStart = day - (day % grid.rowLength);
  const rowEnd = rowStart + grid.rowLength;

  switch (command) {
    case "ArrowUp": {
      if (index > 0) return stops[index - 1].key;
      const above = grid.wrapsVertically ? grid.days[day - grid.rowLength] : undefined;
      return above?.[above.length - 1]?.key;
    }
    case "ArrowDown": {
      if (index < stops.length - 1) return stops[index + 1].key;
      return grid.wrapsVertically ? grid.days[day + grid.rowLength]?.[0]?.key : undefined;
    }
    case "ArrowLeft":
    case "ArrowRight": {
      // Arrows follow the screen, not the calendar: in Arabic the next day is
      // the one to the left.
      const step = (command === "ArrowRight") !== rtl ? 1 : -1;
      return scan(grid, day + step, step, position);
    }
    case "Home":
      return scan(grid, rowStart, 1, position, rowStart, rowEnd);
    case "End":
      return scan(grid, rowEnd - 1, -1, position, rowStart, rowEnd);
  }
}

/**
 * A roving tab stop over the grid: one Tab reaches it, arrows move within it,
 * and the next Tab leaves. A week offers hundreds of half-hour targets; as tab
 * stops they would make everything after the calendar unreachable.
 *
 * Returns the props every stop spreads, and the grid element's key handler.
 */
export function useCalendarFocus(grid: FocusGrid, fallback: string | undefined) {
  const rtl = useDirection() === "rtl";
  const [active, setActive] = useState<string | null>(null);
  // A stop that left the grid (an item reloaded away, another period) hands
  // the tab stop back to the default rather than leaving the grid unreachable.
  const current =
    active !== null && grid.days.some((stops) => stops.some((stop) => stop.key === active)) ? active : fallback;

  function stopProps(key: string): CalendarStopProps {
    return {
      "data-calendar-stop": key,
      tabIndex: key === current ? 0 : -1,
      onFocus: () => setActive(key),
    };
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || !isNavigationKey(event.key)) return;
    if (!(event.target instanceof HTMLElement)) return;
    const from = event.target.dataset.calendarStop;
    if (from === undefined) return;
    // Handled here even at an edge, so an arrow never falls through to
    // scrolling the grid out from under the focused control.
    event.preventDefault();
    const next = nextStop(grid, from, event.key, rtl);
    if (next === undefined) return;
    for (const node of event.currentTarget.querySelectorAll<HTMLElement>("[data-calendar-stop]")) {
      if (node.dataset.calendarStop === next) {
        node.focus();
        return;
      }
    }
  }

  return { stopProps, onKeyDown };
}
