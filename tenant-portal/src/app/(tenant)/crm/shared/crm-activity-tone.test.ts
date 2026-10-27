import { describe, expect, it, vi } from "vitest";
import { crmActivityState } from "./crm-activity-tone";

const now = new Date(2026, 9, 26, 12, 0, 0, 0);
const buckets = ["OVERDUE", "TODAY", "FUTURE"] as const;

describe("crmActivityState", () => {
  it.each([
    { label: "exactly local midnight", due: new Date(2026, 9, 26), expected: "TODAY" },
    { label: "exactly now", due: now, expected: "TODAY" },
    { label: "earlier today", due: new Date(2026, 9, 26, 9), expected: "TODAY" },
    { label: "one millisecond before midnight", due: new Date(2026, 9, 26, 0, 0, 0, -1), expected: "OVERDUE" },
    { label: "yesterday at 23:59", due: new Date(2026, 9, 25, 23, 59), expected: "OVERDUE" },
    { label: "one millisecond after now", due: new Date(now.getTime() + 1), expected: "FUTURE" },
    { label: "later today", due: new Date(2026, 9, 26, 15), expected: "FUTURE" },
    { label: "tomorrow at midnight", due: new Date(2026, 9, 27), expected: "FUTURE" },
  ])("classifies $label by the local day and cutoff", ({ due, expected }) => {
    expect(crmActivityState({ activityAt: due.toISOString() }, now)).toBe(expected);
  });

  it.each(buckets)("uses a valid timestamp ahead of the %s bucket", (bucket) => {
    expect(crmActivityState({ activityAt: new Date(2026, 9, 25).toISOString(), bucket }, now)).toBe("OVERDUE");
    expect(crmActivityState({ activityAt: new Date(2026, 9, 26, 9).toISOString(), bucket }, now)).toBe("TODAY");
    expect(crmActivityState({ activityAt: new Date(2026, 9, 26, 15).toISOString(), bucket }, now)).toBe("FUTURE");
  });

  it.each([null, undefined])("classifies an absent summary (%s) as NONE", (nextActivity) => {
    expect(crmActivityState(nextActivity, now)).toBe("NONE");
  });

  describe.each([undefined, null, "", "not-a-date"])("with an unusable activityAt (%s)", (activityAt) => {
    it.each(buckets)("falls back to the valid %s bucket", (bucket) => {
      expect(crmActivityState({ activityAt, bucket }, now)).toBe(bucket);
    });

    it.each([undefined, null, "", "NONE", "today", "UNKNOWN"])("returns NONE for bucket %s", (bucket) => {
      expect(crmActivityState({ activityAt, bucket }, now)).toBe("NONE");
    });
  });

  it("returns NONE for an empty summary", () => {
    expect(crmActivityState({}, now)).toBe("NONE");
  });

  it("does not mutate the supplied cutoff", () => {
    const cutoff = new Date(now.getTime());
    crmActivityState({ activityAt: new Date(2026, 9, 25).toISOString() }, cutoff);
    expect(cutoff.getTime()).toBe(now.getTime());
  });

  it("keeps one-argument callers compatible using the current time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      expect(crmActivityState({ activityAt: now.toISOString() })).toBe("TODAY");
      expect(crmActivityState({ activityAt: new Date(2026, 9, 26, 15).toISOString() })).toBe("FUTURE");
    } finally {
      vi.useRealTimers();
    }
  });
});
