"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Opens the time grid at `hour` — once, when it mounts. After that the scroll
 * position is the user's, so switching between week and day keeps it.
 *
 * `hourRef` goes on the element that is exactly one day tall (the hour
 * gutter): its height over 24 is an hour in pixels at whatever root font size
 * the reader has, so no pixel constant is repeated here.
 */
export function useScrollToHour(hour: number) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const hourRef = useRef<HTMLDivElement>(null);
  const openingHour = useRef(hour);

  // A layout effect, so the grid never paints at midnight and then jumps. The
  // assignment is instant, not smooth: that is not motion the budget allows.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const day = hourRef.current;
    if (scroller && day) scroller.scrollTop = (day.offsetHeight / 24) * openingHour.current;
  }, []);

  return { scrollerRef, hourRef };
}
