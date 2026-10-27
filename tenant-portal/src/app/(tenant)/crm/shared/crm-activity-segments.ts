import type { CrmActivityState } from "./crm-activity-tone";

export interface CrmActivitySegment {
  state: CrmActivityState;
  count: number;
  percent: number;
}

const activityOrder: readonly CrmActivityState[] = ["FUTURE", "TODAY", "OVERDUE", "NONE"];

export function crmActivitySegments(states: readonly CrmActivityState[]): CrmActivitySegment[] {
  if (states.length === 0) return [{ state: "NONE", count: 0, percent: 100 }];

  const counts: Record<CrmActivityState, number> = { FUTURE: 0, TODAY: 0, OVERDUE: 0, NONE: 0 };
  for (const state of states) counts[state] += 1;

  // Allocate integer hundredths so rounding cannot leave a gap in the bar.
  const segments = activityOrder.filter((state) => counts[state] > 0).map((state) => {
    const scaledCount = counts[state] * 10_000;
    return {
      state,
      count: counts[state],
      units: Math.floor(scaledCount / states.length),
      remainder: scaledCount % states.length,
    };
  });
  const remaining = 10_000 - segments.reduce((total, segment) => total + segment.units, 0);
  const byRemainder = [...segments].sort((a, b) => b.remainder - a.remainder);
  for (const segment of byRemainder.slice(0, remaining)) segment.units += 1;

  return segments.map(({ state, count, units }) => ({ state, count, percent: units / 100 }));
}
