import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { ACTIVITY_TYPES } from "./activity-contract";
import {
  activityFormDurationMinutes,
  countModifiedActivityFields,
  createActivityForm,
  isActivityFieldModified,
  withActivityDatePreset,
  withActivityDurationMinutes,
} from "./activity-form";
import { isHttpUrl, validateActivityForm } from "./activity-form-rules";
import {
  activityCreateModalTitle,
  activityDurationMinutes,
  activityPriorityPillClasses,
  activityStatusPillClasses,
  activityTargetTypeBadgeClasses,
  activityTypePalette,
  computeOpenAgendaCounts,
} from "./activity-presentation";

describe("activityCreateModalTitle", () => {
  it.each([
    ["company lead", en.activities.title, "Acme Trading", "Activities · Acme Trading"],
    ["individual lead", en.activities.title, "Kamal Radwan", "Activities · Kamal Radwan"],
    ["Arabic lead", ar.activities.title, "شركة النور", "الأنشطة · شركة النور"],
  ])("names the %s in the create heading", (_case, title, recordName, expected) => {
    expect(activityCreateModalTitle(title, recordName)).toBe(expected);
  });

  it("uses the workspace title until a record is selected", () => {
    expect(activityCreateModalTitle(en.activities.title)).toBe("Activities");
  });
});

describe("activityTypePalette & semantic pill classes", () => {
  it("provides distinct semantic swatch palettes for all 7 activity types", () => {
    const badges = new Set(ACTIVITY_TYPES.map((type) => activityTypePalette(type).badge));
    expect(badges.size).toBe(ACTIVITY_TYPES.length);
    expect(activityTypePalette("UNKNOWN_TYPE").badge).toContain("bg-muted");
  });

  it("returns active semantic classes for status, priority, and target types", () => {
    expect(activityStatusPillClasses("PLANNED", true)).toContain("border-info/40");
    expect(activityStatusPillClasses("IN_PROGRESS", true)).toContain("border-swatch-purple/45");
    expect(activityStatusPillClasses("DONE", true)).toContain("border-success/45");
    expect(activityStatusPillClasses("CANCELLED", true)).toContain("border-destructive/45");
    expect(activityStatusPillClasses("PLANNED", false)).toContain("bg-transparent");

    expect(activityPriorityPillClasses("LOW", true)).toContain("swatch-slate");
    expect(activityPriorityPillClasses("NORMAL", true)).toContain("border-info/40");
    expect(activityPriorityPillClasses("HIGH", true)).toContain("border-warning/45");
    expect(activityPriorityPillClasses("URGENT", true)).toContain("border-destructive/45");

    expect(activityTargetTypeBadgeClasses("LEAD", true)).toContain("swatch-indigo");
    expect(activityTargetTypeBadgeClasses("CUSTOMER_PROFILE", true)).toContain("swatch-green");
    expect(activityTargetTypeBadgeClasses("OPPORTUNITY", true)).toContain("swatch-purple");
  });
});

describe("computeOpenAgendaCounts & activityDurationMinutes", () => {
  it("classifies open activities into overdue, due today, and upcoming buckets", () => {
    const now = new Date(2026, 9, 15, 12, 0, 0).getTime();
    const counts = computeOpenAgendaCounts(
      [
        { status: "PLANNED", dueAt: new Date(2026, 9, 15, 9, 0, 0).toISOString(), endsAt: null },
        { status: "IN_PROGRESS", dueAt: new Date(2026, 9, 15, 16, 0, 0).toISOString(), endsAt: null },
        { status: "PLANNED", dueAt: new Date(2026, 9, 16, 10, 0, 0).toISOString(), endsAt: null },
        { status: "DONE", dueAt: new Date(2026, 9, 14, 10, 0, 0).toISOString(), endsAt: null },
      ],
      now,
    );
    expect(counts).toEqual({ total: 3, overdue: 1, today: 1, upcoming: 1 });
  });

  it("computes duration in minutes for windowed activities", () => {
    expect(activityDurationMinutes("2026-10-15T10:00:00Z", "2026-10-15T11:30:00Z")).toBe(90);
    expect(activityDurationMinutes("2026-10-15T10:00:00Z", null)).toBeNull();
    expect(activityDurationMinutes("2026-10-15T10:00:00Z", "2026-10-15T09:00:00Z")).toBeNull();
  });
});

describe("activity form presets, diffing, and validation", () => {
  it("applies duration presets and date presets while preserving duration", () => {
    const start = new Date(2026, 9, 15, 10, 0, 0);
    const initial = createActivityForm({ type: "MEETING", start });
    expect(activityFormDurationMinutes(initial)).toBe(60);

    const extended = withActivityDurationMinutes(initial, 90);
    expect(activityFormDurationMinutes(extended)).toBe(90);

    const moved = withActivityDatePreset(extended, "tomorrowMorning", start);
    expect(moved.startDate).toBe("2026-10-16");
    expect(moved.startTime).toBe("10:00");
    expect(activityFormDurationMinutes(moved)).toBe(90);
  });

  it("tracks modified fields and unsaved change count against seed", () => {
    const seed = createActivityForm({ type: "TODO", start: new Date(2026, 9, 15, 10, 0, 0) });
    const edited = { ...seed, subject: "Follow up on quotation", priority: "HIGH" };
    expect(isActivityFieldModified(edited, seed, "subject")).toBe(true);
    expect(isActivityFieldModified(edited, seed, "priority")).toBe(true);
    expect(isActivityFieldModified(edited, seed, "description")).toBe(false);
    expect(countModifiedActivityFields(edited, seed)).toBe(2);
  });

  it("validates meetingUrl scheme and domain rules", () => {
    expect(isHttpUrl("https://meet.google.com/abc-defg-hij")).toBe(true);
    expect(isHttpUrl("HTTPS://meet.google.com/abc")).toBe(false);
    expect(isHttpUrl("https://localhost")).toBe(false);

    const form = createActivityForm({
      type: "MEETING",
      start: new Date(Date.now() + 3_600_000),
      target: { app: "CRM", type: "LEAD", id: "01950000-0000-7000-8000-000000000001", label: "Acme" },
    });
    const invalidErrors = validateActivityForm({ ...form, subject: "Demo", meetingUrl: "not-a-url" }, { mode: "create" });
    expect(invalidErrors.meetingUrl).toBe("invalidUrl");
  });
});
