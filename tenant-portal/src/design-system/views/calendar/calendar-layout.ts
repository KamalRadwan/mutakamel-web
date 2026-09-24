import type { CalendarEntry } from "./calendar-grid";

export const DAY_MINUTES = 24 * 60;

// The shortest block the time grid draws. A point item, and anything briefer,
// is drawn half an hour tall: at 48px an hour that is 24px, the WCAG 2.2
// target floor, and the least that holds a line of text.
const MIN_DRAWN_MINUTES = 30;

export interface TimedPlacement<T> {
  entry: CalendarEntry<T>;
  // Minutes from the day's midnight, drawn — never outside [0, DAY_MINUTES].
  top: number;
  height: number;
  // Side-by-side lanes within one run of overlapping items: this block starts
  // in `lane`, of `lanes`, and is `span` lanes wide.
  lane: number;
  lanes: number;
  span: number;
}

type Segment<T> = Pick<TimedPlacement<T>, "entry" | "top" | "height">;

function hasDuration<T>(entry: CalendarEntry<T>): entry is CalendarEntry<T> & { end: Date } {
  return entry.end !== null && entry.end > entry.start;
}

// A span belongs to every day it touches, so a two-day visit shows on both; a
// point belongs to the day it falls on, and an item ending exactly at midnight
// does not spill into the next day.
export function overlapsDay<T>(entry: CalendarEntry<T>, dayStart: Date, dayEnd: Date): boolean {
  if (hasDuration(entry)) return entry.start < dayEnd && entry.end > dayStart;
  return entry.start >= dayStart && entry.start < dayEnd;
}

// Wall-clock minutes, clamped to the day. Not elapsed minutes: on a
// daylight-saving day the two differ by an hour, and the hour labels beside
// the grid are wall-clock.
export function minuteOfDay(time: Date, dayStart: Date, dayEnd: Date): number {
  if (time <= dayStart) return 0;
  if (time >= dayEnd) return DAY_MINUTES;
  return time.getHours() * 60 + time.getMinutes();
}

/**
 * Places one day's items in the time grid. Items that overlap share the width
 * as side-by-side lanes, first come first served, and a block widens into
 * lanes that nothing it overlaps is using.
 */
export function layoutDay<T>(
  entries: readonly CalendarEntry<T>[],
  dayStart: Date,
  dayEnd: Date,
): TimedPlacement<T>[] {
  const segments = entries
    .filter((entry) => overlapsDay(entry, dayStart, dayEnd))
    .map((entry): Segment<T> => {
      const top = minuteOfDay(entry.start, dayStart, dayEnd);
      const bottom = hasDuration(entry) ? minuteOfDay(entry.end, dayStart, dayEnd) : top;
      const height = Math.max(bottom - top, MIN_DRAWN_MINUTES);
      // Pinned inside the day, so a late point item keeps its full height
      // rather than running off the bottom of the column.
      return { entry, top: Math.min(top, DAY_MINUTES - height), height };
    })
    .sort((a, b) => a.top - b.top || b.height - a.height || a.entry.key.localeCompare(b.entry.key));

  // A cluster is a run of transitively overlapping blocks; lanes are shared
  // within one and never across two, so an early clash does not narrow the
  // rest of the day.
  const placements: TimedPlacement<T>[] = [];
  let cluster: Segment<T>[] = [];
  let clusterEnd = 0;
  for (const segment of segments) {
    if (cluster.length > 0 && segment.top >= clusterEnd) {
      placements.push(...placeCluster(cluster));
      cluster = [];
      clusterEnd = 0;
    }
    cluster.push(segment);
    clusterEnd = Math.max(clusterEnd, segment.top + segment.height);
  }
  if (cluster.length > 0) placements.push(...placeCluster(cluster));
  return placements;
}

function overlaps<T>(a: Segment<T>, b: Segment<T>): boolean {
  return a.top < b.top + b.height && b.top < a.top + a.height;
}

function placeCluster<T>(segments: readonly Segment<T>[]): TimedPlacement<T>[] {
  // Where each lane is next free, in minutes.
  const laneEnds: number[] = [];
  const laneOf = segments.map((segment) => {
    const free = laneEnds.findIndex((end) => end <= segment.top);
    const lane = free === -1 ? laneEnds.length : free;
    laneEnds[lane] = segment.top + segment.height;
    return lane;
  });
  const lanes = laneEnds.length;

  return segments.map((segment, index) => {
    const lane = laneOf[index];
    let span = 1;
    while (
      lane + span < lanes &&
      !segments.some((other, otherIndex) => laneOf[otherIndex] === lane + span && overlaps(other, segment))
    ) {
      span += 1;
    }
    return { ...segment, lane, lanes, span };
  });
}
