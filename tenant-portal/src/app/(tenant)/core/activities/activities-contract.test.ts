import { describe, expect, it } from "vitest";
import {
  ACTIVITIES_PATH,
  activitiesListPath,
  activityAssigneesPath,
  activityCancelPath,
  activityCompletePath,
  activityPath,
  parseActivity,
  parseActivityAssignees,
  parseActivityPage,
} from "./activities-contract";
import {
  buildCreateActivityRequest,
  buildUpdateActivityRequest,
  toActivityForm,
} from "./activity-forms";

const activityId = "01902001-3000-7000-8000-000000000001";
const assigneeId = "01902001-3000-7000-8000-000000000002";
const branchId = "01902001-3000-7000-8000-000000000003";
const targetId = "01902001-3000-7000-8000-000000000004";
const targetRowId = "01902001-3000-7000-8000-000000000005";

const activityRow = {
  id: activityId,
  type: "CALL",
  subject: "Follow up on the quotation",
  description: null,
  direction: "OUTBOUND",
  priority: "NORMAL",
  status: "PLANNED",
  dueAt: "2026-09-01T09:00:00.000Z",
  completedAt: null,
  cancelledAt: null,
  outcome: null,
  assigneeUserId: assigneeId,
  createdByUserId: assigneeId,
  branchId,
  companyId: branchId,
  version: 4,
  createdAt: "2026-08-30T09:00:00.000Z",
  updatedAt: "2026-08-30T09:00:00.000Z",
  targets: [
    {
      id: targetRowId,
      role: "PRIMARY",
      targetApp: "CRM",
      targetType: "LEAD",
      targetId,
      label: "Nile Trading",
      route: "/crm/leads/x",
      targetVersion: null,
      unavailableAt: null,
    },
  ],
};

describe("Core activities contract", () => {
  it("uses canonical Gateway literals for every route", () => {
    expect(ACTIVITIES_PATH).toBe("/api/tenant/core/v1/activities");
    expect(activityPath(activityId)).toBe(`${ACTIVITIES_PATH}/${activityId}`);
    expect(activityCompletePath(activityId)).toBe(`${ACTIVITIES_PATH}/${activityId}/complete`);
    expect(activityCancelPath(activityId)).toBe(`${ACTIVITIES_PATH}/${activityId}/cancel`);
  });

  it("pins sortBy to the only value the DTO accepts", () => {
    expect(activitiesListPath(2, "call", "DESC", { status: "PLANNED" })).toBe(
      `${ACTIVITIES_PATH}?page=2&limit=25&sortBy=dueAt&sortDir=DESC&search=call&status=PLANNED`,
    );
  });

  it("always sends all three target parameters to the assignee route", () => {
    // It is not a general user picker: without a target there is no question.
    expect(activityAssigneesPath("CRM", "LEAD", targetId, "nora")).toBe(
      `${ACTIVITIES_PATH}/assignees?targetApp=CRM&targetType=LEAD&targetId=${targetId}&search=nora`,
    );
  });

  it("keeps the version an If-Match write has to echo", () => {
    expect(parseActivity(activityRow).version).toBe(4);
  });

  it("derives hasNext and hasPrev — the response carries no hasPrev", () => {
    const page = parseActivityPage({
      items: [activityRow],
      total: 60,
      page: 2,
      limit: 25,
      totalPages: 3,
      hasNext: true,
    });
    expect(page.hasNext).toBe(true);
    expect(page.hasPrev).toBe(true);

    const last = parseActivityPage({
      items: [activityRow],
      total: 51,
      page: 3,
      limit: 25,
      totalPages: 3,
      hasNext: false,
    });
    expect(last.hasNext).toBe(false);
    expect(last.hasPrev).toBe(true);
  });

  it("falls back to the id when a user has no name to concatenate", () => {
    expect(parseActivityAssignees([{ id: assigneeId, name: "" }])).toEqual([
      { id: assigneeId, name: assigneeId },
    ]);
  });

  it("sends the target on create and never on update", () => {
    const values = toActivityForm(parseActivity(activityRow));
    const created = buildCreateActivityRequest(values);
    expect(created.target).toEqual({ app: "CRM", type: "LEAD", id: targetId });
    expect(buildUpdateActivityRequest(parseActivity(activityRow), values)).toEqual({});
    const changed = buildUpdateActivityRequest(parseActivity(activityRow), {
      ...values,
      subject: "New subject",
    });
    expect(changed).toEqual({ subject: "New subject" });
    expect(changed).not.toHaveProperty("target");
  });

  it("refuses a form the DTO would reject rather than sending it", () => {
    const values = toActivityForm(parseActivity(activityRow));
    expect(() => buildCreateActivityRequest({ ...values, subject: "  " })).toThrow(
      "ACTIVITY_FORM_SUBJECT",
    );
    expect(() => buildCreateActivityRequest({ ...values, dueAt: "" })).toThrow(
      "ACTIVITY_FORM_DUE_AT",
    );
    expect(() => buildCreateActivityRequest({ ...values, targetId: "" })).toThrow(
      "ACTIVITY_FORM_TARGET",
    );
    expect(() => buildCreateActivityRequest({ ...values, assigneeUserId: "" })).toThrow(
      "ACTIVITY_FORM_ASSIGNEE",
    );
  });
});
