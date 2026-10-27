import { describe, expect, it } from "vitest";
import type { Activity } from "./activity-contract";
import { activityToForm, createActivityForm } from "./activity-form";
import { buildCreateActivityBody, buildUpdateActivityBody, validateActivityForm } from "./activity-form-rules";
import { parseActivity } from "./activity-parsers";

const id = "019f0000-0000-7000-8000-000000000001";
const activity: Activity = {
  id, type: "TODO", subject: "Follow up", description: null, direction: null,
  priority: "NORMAL", status: "PLANNED", dueAt: "2099-10-19T12:01:00.000Z", endsAt: null,
  reminderOffsetMinutes: 1, reminderSentAt: null, location: null, meetingUrl: null,
  completedAt: null, cancelledAt: null, outcome: null, assigneeUserId: id,
  assigneeName: null, createdByUserId: id, createdByName: null, branchId: id, companyId: id,
  version: 1, createdAt: "2026-10-19T10:00:00.000Z", updatedAt: "2026-10-19T10:00:00.000Z", targets: [],
};

describe("activity reminders", () => {
  it("sends enabled reminder minutes on create, including zero", () => {
    const values = createActivityForm({ target: { app: "CRM", type: "LEAD", id, label: "Lead" } });
    expect(buildCreateActivityBody(values)).not.toHaveProperty("reminderOffsetMinutes");
    expect(buildCreateActivityBody({ ...values, reminderOffsetMinutes: "1" })).toHaveProperty("reminderOffsetMinutes", 1);
    expect(buildCreateActivityBody({ ...values, reminderOffsetMinutes: "0" })).toHaveProperty("reminderOffsetMinutes", 0);
    expect(buildCreateActivityBody({ ...values, status: "DONE", reminderOffsetMinutes: "1" }))
      .not.toHaveProperty("reminderOffsetMinutes");
  });

  it("preserves configuration on edit and sends null only when the user clears it", () => {
    const seed = activityToForm(activity);
    expect(seed.reminderOffsetMinutes).toBe("1");
    expect(buildUpdateActivityBody(seed, seed, activity)).toEqual({});
    expect(buildUpdateActivityBody({ ...seed, reminderOffsetMinutes: "" }, seed, activity))
      .toEqual({ reminderOffsetMinutes: null });
  });

  it.each(["-1", "0.5", "no", "2147483648"])("rejects invalid offset %s", (value) => {
    expect(validateActivityForm({ ...activityToForm(activity), reminderOffsetMinutes: value }, { mode: "edit" }))
      .toHaveProperty("reminderOffsetMinutes", "invalidReminderOffset");
  });

  it("parses reminder settings and sent evidence without accepting impossible states", () => {
    expect(parseActivity(activity)).toMatchObject({ reminderOffsetMinutes: 1, reminderSentAt: null });
    expect(parseActivity({ ...activity, reminderOffsetMinutes: 0 })).toHaveProperty("reminderOffsetMinutes", 0);
    expect(parseActivity({ ...activity, reminderSentAt: activity.updatedAt })).toHaveProperty("reminderSentAt", activity.updatedAt);
    expect(() => parseActivity({ ...activity, reminderOffsetMinutes: "1" })).toThrow();
    expect(() => parseActivity({ ...activity, reminderOffsetMinutes: null, reminderSentAt: activity.updatedAt })).toThrow();
    expect(parseActivity({ ...activity, reminderOffsetMinutes: undefined, reminderSentAt: undefined }))
      .toMatchObject({ reminderOffsetMinutes: null, reminderSentAt: null });
  });
});
