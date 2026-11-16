"use client";
import { useEffect, useState } from "react";

/** Refresh local applicability at a saved boundary, without polling the backend. */
export function usePricingClock(boundaries: readonly (string | null | undefined)[]) {
  const [now, setNow] = useState(() => Date.now());
  const key = boundaries.filter(Boolean).join("|");
  useEffect(() => {
    const dates = key.split("|").map(value => Date.parse(value)).filter(Number.isFinite);
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const current = Date.now();
      const next = dates.reduce((nearest, value) => value > current ? Math.min(nearest, value) : nearest, Infinity);
      timer = setTimeout(() => { setNow(Date.now()); schedule(); }, Math.max(1, Math.min(60_000, next - current + 1)));
    };
    schedule();
    return () => clearTimeout(timer);
  }, [key]);
  return now;
}
