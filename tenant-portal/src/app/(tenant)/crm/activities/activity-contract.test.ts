import { describe, expect, it } from "vitest";
import {
  buildCreateEventRequest,
  buildCreateReminderRequest,
  buildCreateTaskRequest,
  buildListQuery,
  buildUpdateEventRequest,
  buildUpdateTaskRequest,
  combineDateAndTime,
  parseActivitiesPage,
  parseRemindersPage,
  parseTasksPage,
  timeOfDay,
  type CrmTask,
} from "./activity-contract";

const BRANCH_ID = "01900400-0000-7000-8000-000000000001";
const SOURCE_ID = "01900400-0000-7000-8000-000000000002";
const TASK_ID = "01900400-0000-7000-8000-000000000003";

const task: CrmTask = {
  id: TASK_ID,
  branchId: BRANCH_ID,
  sourceType: "LEAD",
  sourceId: SOURCE_ID,
  title: "Call back",
  status: "OPEN",
  dueAt: null,
  createdAt: "2026-08-01T09:00:00.000Z",
  updatedAt: "2026-08-01T09:00:00.000Z",
};

describe("CRM activities module contract", () => {
  it("parses the FLAT paginated shape crm-app actually returns", () => {
    // PaginatedResult<T> from @mutakamel/database — no `meta` wrapper and no
    // `data` envelope. docs/api/README.md's `{ items, meta }` example does not
    // match any crm-app response.
    const page = parseTasksPage({
      items: [task],
      total: 1,
      page: 1,
      limit: 25,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(1);
  });

  it("rejects the meta-wrapped and Core-enveloped shapes outright", () => {
    expect(() =>
      parseTasksPage({ items: [task], meta: { page: 1, limit: 25, total: 1 } }),
    ).toThrow("Invalid CRM activities response.");
    expect(() =>
      parseTasksPage({ success: true, data: { items: [task] } }),
    ).toThrow("Invalid CRM activities response.");
  });

  it("accepts the nullable source the task and event projections can return", () => {
    const page = parseTasksPage({
      items: [{ ...task, sourceType: null, sourceId: null }],
      total: 1,
      page: 1,
      limit: 25,
    });
    expect(page.items[0].sourceType).toBeNull();
  });

  it("requires a UUIDv7 branch on every list query", () => {
    expect(buildListQuery(BRANCH_ID, 2, 25, { status: "OPEN" })).toBe(
      `branchId=${BRANCH_ID}&page=2&limit=25&status=OPEN`,
    );
    // An empty filter contributes nothing rather than `status=`.
    expect(buildListQuery(BRANCH_ID, 1, 25, { status: "" })).toBe(
      `branchId=${BRANCH_ID}&page=1&limit=25`,
    );
    expect(() => buildListQuery("not-a-branch", 1, 25)).toThrow(
      "A valid branch is required for this CRM list.",
    );
  });

  it("sends only CreateTaskDto keys and omits the empty optionals", () => {
    expect(
      buildCreateTaskRequest({
        branchId: BRANCH_ID,
        title: "  Call back  ",
        sourceType: "LEAD",
        sourceId: SOURCE_ID,
        status: "OPEN",
        description: "   ",
        priority: "",
        dueAt: null,
      }),
    ).toEqual({
      branchId: BRANCH_ID,
      title: "Call back",
      sourceType: "LEAD",
      sourceId: SOURCE_ID,
      status: "OPEN",
    });
  });

  it("never puts description, priority or assignee in a task update", () => {
    // Those three are writable on the route but ABSENT from the list
    // projection, so the edit form has no current value for them and must not
    // send one. See Q50 in docs/build/OPEN-QUESTIONS.md.
    const body = buildUpdateTaskRequest(
      { title: "Call back", status: "DONE", dueAt: null },
      task,
    );
    expect(body).toEqual({ status: "DONE" });
    expect(body).not.toHaveProperty("description");
    expect(body).not.toHaveProperty("priority");
    expect(body).not.toHaveProperty("assigneeUserId");
  });

  it("refuses an event window the server would answer 422 for", () => {
    const start = new Date("2026-09-01T09:00:00.000Z");
    expect(() =>
      buildCreateEventRequest({
        branchId: BRANCH_ID,
        title: "Review",
        sourceType: "LEAD",
        sourceId: SOURCE_ID,
        description: "",
        location: "",
        startsAt: start,
        endsAt: start,
      }),
    ).toThrow("CRM_EVENT_TIME_INVALID");
  });

  it("never sends attendees, whose item shape the DTO does not declare", () => {
    const body = buildCreateEventRequest({
      branchId: BRANCH_ID,
      title: "Review",
      sourceType: "LEAD",
      sourceId: SOURCE_ID,
      description: "",
      location: "Cairo",
      startsAt: new Date("2026-09-01T09:00:00.000Z"),
      endsAt: new Date("2026-09-01T10:00:00.000Z"),
    });
    expect(body).not.toHaveProperty("attendees");
    expect(body.location).toBe("Cairo");
  });

  it("sends only the changed halves of an event window", () => {
    const event = {
      id: TASK_ID,
      branchId: BRANCH_ID,
      sourceType: "LEAD" as const,
      sourceId: SOURCE_ID,
      title: "Review",
      startsAt: "2026-09-01T09:00:00.000Z",
      endsAt: "2026-09-01T10:00:00.000Z",
      createdAt: "2026-08-01T09:00:00.000Z",
      updatedAt: "2026-08-01T09:00:00.000Z",
    };
    expect(
      buildUpdateEventRequest(
        {
          title: "Review",
          startsAt: new Date(event.startsAt),
          endsAt: new Date("2026-09-01T11:00:00.000Z"),
        },
        event,
      ),
    ).toEqual({ endsAt: "2026-09-01T11:00:00.000Z" });
  });

  it("refuses a reminder in the past, as the service does", () => {
    expect(() =>
      buildCreateReminderRequest({
        branchId: BRANCH_ID,
        targetType: "TASK",
        targetId: TASK_ID,
        channel: "IN_APP",
        remindAt: new Date("2020-01-01T00:00:00.000Z"),
      }),
    ).toThrow("CRM_REMINDER_TIME_INVALID");
  });

  it("combines a picked day with a typed time, and refuses a malformed one", () => {
    const day = new Date(2026, 8, 1);
    const combined = combineDateAndTime(day, "14:30");
    expect(combined?.getHours()).toBe(14);
    expect(combined?.getMinutes()).toBe(30);
    expect(combineDateAndTime(day, "99:99")).toBeNull();
    expect(combineDateAndTime(undefined, "09:00")).toBeNull();
    expect(timeOfDay(combined?.toISOString() ?? null)).toBe("14:30");
    expect(timeOfDay(null)).toBe("");
  });

  it("rejects an unknown activity type and an unknown reminder status", () => {
    const base = {
      id: TASK_ID,
      branchId: BRANCH_ID,
      subject: "Called",
      sourceType: "LEAD",
      sourceId: SOURCE_ID,
      status: "DONE",
      createdAt: "2026-08-01T09:00:00.000Z",
    };
    expect(() =>
      parseActivitiesPage({
        items: [{ ...base, type: "TELEPATHY" }],
        total: 1,
        page: 1,
        limit: 25,
      }),
    ).toThrow("Invalid CRM activities response.");
    expect(() =>
      parseRemindersPage({
        items: [
          {
            id: TASK_ID,
            branchId: BRANCH_ID,
            targetType: "TASK",
            targetId: SOURCE_ID,
            remindAt: "2026-09-01T09:00:00.000Z",
            status: "SNOOZED",
            createdAt: "2026-08-01T09:00:00.000Z",
            updatedAt: "2026-08-01T09:00:00.000Z",
          },
        ],
        total: 1,
        page: 1,
        limit: 25,
      }),
    ).toThrow("Invalid CRM activities response.");
  });
});
