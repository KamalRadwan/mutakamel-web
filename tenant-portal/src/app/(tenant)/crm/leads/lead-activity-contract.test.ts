import { describe, expect, it } from "vitest";
import {
  LEAD_ACTIVITIES_PATH,
  buildLeadActivityRequest,
  leadPlannedActivitiesQuery,
  parseCreatedLeadActivity,
  parseLeadPlannedActivities,
  validateLeadActivityForm,
  type LeadActivityForm,
} from "./lead-activity-contract";

const LEAD_ID = "01900100-0000-7000-8000-000000000001";
const ACTIVITY_ID = "01900100-0000-7000-8000-0000000000b1";

const HOUR = 60 * 60 * 1000;

function localInput(offsetMs: number): string {
  const at = new Date(Date.now() + offsetMs);
  return new Date(at.getTime() - at.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const form: LeadActivityForm = {
  type: "CALL",
  subject: "  Ring the buyer  ",
  dueAt: localInput(24 * HOUR),
  priority: "HIGH",
  description: "  Ask about the second site  ",
};

function activityRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ACTIVITY_ID,
    subject: "Ring the buyer",
    type: "CALL",
    priority: "HIGH",
    dueAt: "2026-09-06T09:00:00.000Z",
    ...overrides,
  };
}

describe("lead activity contract", () => {
  // Activities are CORE's. `/api/tenant/crm/v1/activities` files DONE rows —
  // a log of what happened — and pointing this dialog at it would record
  // planned work as already finished.
  it("targets Core's activities route, not CRM's", () => {
    expect(LEAD_ACTIVITIES_PATH).toBe("/api/tenant/core/v1/activities");
  });

  // The three filter names are the controller's own, and `LEAD` is the
  // `targetType` example it documents. Getting one of them wrong returns the
  // whole tenant's activities rather than this lead's, with no error anywhere.
  it("asks only for this lead's PLANNED work, soonest first", () => {
    const query = new URLSearchParams(leadPlannedActivitiesQuery(LEAD_ID));
    expect(Object.fromEntries(query)).toEqual({
      page: "1",
      limit: "25",
      sortBy: "dueAt",
      sortDir: "ASC",
      status: "PLANNED",
      targetApp: "CRM",
      targetType: "LEAD",
      targetId: LEAD_ID,
    });
  });

  it("refuses to build a query for anything that is not a lead id", () => {
    expect(() => leadPlannedActivitiesQuery("not-a-uuid")).toThrow();
  });

  it("reads the rows out of the list body and leaves its counts alone", () => {
    expect(parseLeadPlannedActivities({ items: [activityRow()], total: 1 })).toEqual([
      {
        id: ACTIVITY_ID,
        subject: "Ring the buyer",
        type: "CALL",
        priority: "HIGH",
        dueAt: "2026-09-06T09:00:00.000Z",
      },
    ]);
  });

  // A type or a priority this build has never heard of must not blank the
  // half: the dialog falls back to the raw key, which is visible rather than
  // silently swallowed.
  it("carries an unknown type or priority through as a string", () => {
    expect(
      parseLeadPlannedActivities({ items: [activityRow({ type: "SITE_SURVEY" })] })[0].type,
    ).toBe("SITE_SURVEY");
  });

  it("rejects a list body of the wrong shape", () => {
    expect(() => parseLeadPlannedActivities({ items: {} })).toThrow();
    expect(() => parseLeadPlannedActivities([activityRow()])).toThrow();
    expect(() => parseLeadPlannedActivities({ items: [activityRow({ subject: "" })] })).toThrow();
    expect(() =>
      parseLeadPlannedActivities({ items: [activityRow({ dueAt: "not-a-date" })] }),
    ).toThrow();
  });

  // `runCrmWrite` hands its parser the RAW response body, and a Core route
  // answers inside an envelope. Reading the row straight off it would give the
  // dialog the envelope's own keys and throw on every successful create.
  it("unwraps Core's envelope on the created row, and copes without one", () => {
    expect(
      parseCreatedLeadActivity({ success: true, data: activityRow(), correlationId: "x" }).id,
    ).toBe(ACTIVITY_ID);
    expect(parseCreatedLeadActivity(activityRow()).id).toBe(ACTIVITY_ID);
  });

  describe("the create body", () => {
    it("carries the lead as the target and trims what it sends", () => {
      const body = buildLeadActivityRequest(LEAD_ID, form);
      expect(body.target).toEqual({ app: "CRM", type: "LEAD", id: LEAD_ID });
      expect(body.subject).toBe("Ring the buyer");
      expect(body.description).toBe("Ask about the second site");
      expect(body.type).toBe("CALL");
      expect(body.priority).toBe("HIGH");
      expect(typeof body.dueAt).toBe("string");
    });

    // `assigneeUserId` is optional on `CreateActivityDto` and the service
    // falls back to the acting user. Sending nothing is what keeps this
    // dialog free of the eligible-assignee fetch the activities screen needs.
    it("names no assignee, so the service books it for whoever is scheduling", () => {
      expect(buildLeadActivityRequest(LEAD_ID, form)).not.toHaveProperty("assigneeUserId");
    });

    // An empty string is not "no description" on the wire — it is a value,
    // and `@MaxLength` would accept it as one.
    it("omits an empty description rather than sending a blank one", () => {
      expect(
        buildLeadActivityRequest(LEAD_ID, { ...form, description: "   " }),
      ).not.toHaveProperty("description");
    });

    it("refuses a target that is not a lead id", () => {
      expect(() => buildLeadActivityRequest("not-a-uuid", form)).toThrow();
    });
  });

  describe("validation, as a mirror of the server", () => {
    it("passes a complete form", () => {
      expect(validateLeadActivityForm(form)).toEqual({});
    });

    it("names an empty subject and an empty due date", () => {
      expect(validateLeadActivityForm({ ...form, subject: "   ", dueAt: "" })).toEqual({
        subject: "required",
        dueAt: "required",
      });
    });

    it("bounds the subject at the DTO's own 180", () => {
      expect(validateLeadActivityForm({ ...form, subject: "x".repeat(181) })).toEqual({
        subject: "maxLength",
      });
    });

    // `ActivitiesService.create` runs `assertFutureDueAt`, so a past date is a
    // round trip and an idempotency key spent on a rejection.
    it("stops a due date in the past before it costs a request", () => {
      expect(validateLeadActivityForm({ ...form, dueAt: localInput(-HOUR) })).toEqual({
        dueAt: "past",
      });
    });
  });
});
