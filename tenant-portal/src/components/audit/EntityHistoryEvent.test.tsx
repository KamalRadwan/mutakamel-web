// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { formatTemplate } from "@/lib/format/template";
import type { EntityAuditEvent } from "@/lib/audit/entity-history-contract";
import { toTimelineEvent } from "./EntityHistoryEvent";

vi.mock("@/design-system", () => import("@/design-system/primitives/RatingStars"));
afterEach(cleanup);

const LEAD = "01900100-0000-7000-8000-000000000001";
const PARTY = "01900100-0000-7000-8000-000000000002";
const BRANCH = "01900100-0000-7000-8000-000000000003";
const STAGE = "01900100-0000-7000-8000-000000000004";
const CUSTOMER = "01900100-0000-7000-8000-000000000005";
const PIPELINE = "01900100-0000-7000-8000-000000000006";
const createdChanges: EntityAuditEvent["changes"] = [
  { field: "firstName", before: null, after: "Mostafa", subjectId: PARTY, subjectLabel: "Mostafa Saleh" },
  { field: "leadProfileType", before: null, after: "INDIVIDUAL", subjectId: LEAD },
  { field: "branchId", before: null, after: BRANCH, subjectId: LEAD },
  { field: "stageId", before: null, after: STAGE, subjectId: LEAD },
  { field: "rating", before: null, after: 0, subjectId: LEAD },
  { field: "phone", before: [], after: ["+201044556699"], subjectId: PARTY, subjectLabel: "Mostafa Saleh" },
];
function event(overrides: Partial<EntityAuditEvent> = {}): EntityAuditEvent {
  return { id: "event", action: "LEAD_UPDATED", actorLabel: "Kamal Radwan", occurredAt: "2026-09-14T10:18:00",
    outcome: "SUCCESS", reason: null, changes: [], ...overrides };
}
function show(entry: EntityAuditEvent, lang: "ar" | "en" = "en", entityType = "Lead") {
  const copy = { en, ar }[lang];
  const timeline = toTimelineEvent(entry, lang, copy.audit, copy.statusValues, undefined, { entityType, entityId: LEAD });
  render(timeline.description);
  return timeline;
}

describe("Lead history presentation", () => {
  it.each([{ changes: createdChanges }, { changes: [] }])("summarizes explicit lead creation and preserves actor and timestamp", ({ changes }) => {
    const timeline = show(event({ action: "LEAD_CREATED", changes }));
    expect(document.body).toHaveTextContent(/^Lead created$/);
    expect(timeline.title).toBe("Kamal Radwan");
    expect(timeline.timestamp).toBe("14/09/2026 10:18 AM");
    expect(screen.queryByText("Mostafa Saleh")).not.toBeInTheDocument();
    expect(screen.queryByText(BRANCH)).not.toBeInTheDocument();
  });

  it.each(["CREATE", "CRM_PARTY_UPDATED"])("recognizes grouped lead creation when Core returns %s as the first child action", (action) => {
    show(event({ action, changes: createdChanges }));
    expect(document.body).toHaveTextContent(/^Lead created$/);
  });

  it("keeps later contact creation and existing lead updates detailed", () => {
    show(event({ action: "CREATE", changes: [
      createdChanges[0], createdChanges[5],
      { field: "stageId", before: STAGE, after: BRANCH, subjectId: LEAD },
    ] }));
    expect(screen.queryByText("Lead created")).not.toBeInTheDocument();
    expect(screen.getByText("Mostafa")).toBeInTheDocument();
    expect(screen.getByText("+201044556699")).toBeInTheDocument();
    expect(screen.queryByText(STAGE)).not.toBeInTheDocument();
    expect(screen.getAllByText(en.audit.valueUnavailable)[0]).toHaveClass("line-through");
  });

  it("does not treat initial fields belonging to another subject as this lead's creation", () => {
    show(event({ action: "CREATE", changes: createdChanges.map((change) => ({ ...change, subjectId: PARTY })) }));
    expect(screen.queryByText("Lead created")).not.toBeInTheDocument();
    expect(screen.getByText("INDIVIDUAL")).toBeInTheDocument();
  });

  it("preserves failed creation evidence and its reason", () => {
    show(event({ action: "LEAD_CREATED", outcome: "FAILURE", reason: "Request rejected", changes: createdChanges }));
    expect(screen.queryByText("Lead created")).not.toBeInTheDocument();
    expect(screen.getByText("Mostafa")).toBeInTheDocument();
    expect(screen.getByText("Reason: Request rejected")).toBeInTheDocument();
  });

  it.each([0, 1, 2, 3])("renders a rating of %i as three gold/silver stars with a chronological transition", (after) => {
    const before = (after + 1) % 4;
    show(event({ changes: [{ field: "rating", before, after, subjectId: LEAD }] }));
    const previous = screen.getByRole("img", { name: formatTemplate(en.audit.ratingBefore, { count: before, max: 3 }) });
    const next = screen.getByRole("img", { name: formatTemplate(en.audit.ratingAfter, { count: after, max: 3 }) });
    for (const [element, count] of [[previous, before], [next, after]] as const) {
      expect(element.querySelectorAll("svg")).toHaveLength(3);
      expect(element.querySelectorAll(".text-warning-vivid")).toHaveLength(count);
      expect(element.querySelectorAll('svg:not(.text-warning-vivid)')).toHaveLength(3 - count);
      expect(element).not.toHaveClass("line-through");
    }
    expect(previous.parentElement).toHaveAttribute("dir", "ltr");
    expect(previous.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.body).toHaveTextContent(/^Rating:>$/);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each([null, "[NOT_RECORDED]", 4])("does not turn unavailable or invalid rating evidence (%s) into zero stars", (before) => {
    show(event({ changes: [{ field: "rating", before, after: 2 }] }));
    expect(screen.getAllByRole("img")).toHaveLength(1);
    const label = before === null ? en.audit.valueEmpty : before === "[NOT_RECORDED]" ? en.audit.valueNotRecorded : "4";
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("leaves other entity history and non-rating fields detailed", () => {
    show(event({ action: "CREATE", changes: [{ field: "rating", before: 1, after: 2 }] }), "en", "Invoice");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("1")).toHaveClass("line-through");
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("localizes the creation summary in Arabic", () => {
    show(event({ action: "LEAD_CREATED", changes: createdChanges }), "ar");
    expect(document.body).toHaveTextContent(ar.audit.actions.LEAD_CREATED);
    expect(screen.queryByText(BRANCH)).not.toBeInTheDocument();
  });

  it.each([
    ["CustomerProfile", "CUSTOMER_PROFILE_CREATED", "Customer created"],
    ["Opportunity", "OPPORTUNITY_CREATED", "Opportunity created"],
  ])("summarizes explicit %s creation", (entityType, action, label) => {
    show(event({ action, changes: createdChanges }), "en", entityType);
    expect(document.body).toHaveTextContent(new RegExp(`^${label}$`));
    expect(screen.queryByText(BRANCH)).not.toBeInTheDocument();
  });

  it("recognizes grouped Customer and Opportunity creation from their root fields", () => {
    show(event({ action: "CREATE", changes: [
      { field: "profileType", before: null, after: "CORPORATE", subjectId: LEAD },
      { field: "branchId", before: null, after: BRANCH, subjectId: LEAD },
      { field: "status", before: null, after: "PROSPECT", subjectId: LEAD },
    ] }), "en", "CustomerProfile");
    expect(document.body).toHaveTextContent(/^Customer created$/);
    cleanup();

    show(event({ action: "CREATE", changes: [
      { field: "branchId", before: null, after: BRANCH, subjectId: LEAD },
      { field: "customerProfileId", before: null, after: CUSTOMER, subjectId: LEAD },
      { field: "pipelineId", before: null, after: PIPELINE, subjectId: LEAD },
      { field: "stageId", before: null, after: STAGE, subjectId: LEAD },
    ] }), "en", "Opportunity");
    expect(document.body).toHaveTextContent(/^Opportunity created$/);
  });

  it("uses each record type's status catalogue", () => {
    show(event({ changes: [
      { field: "status", before: "IN_PROGRESS", after: "WON", subjectId: LEAD },
      { field: "stageFlag", before: "DISCOVERY", after: "PROPOSAL", subjectId: LEAD },
    ] }), "en", "Opportunity");
    expect(screen.getByText(en.statusValues["OpportunityStatus.IN_PROGRESS"]!)).toBeInTheDocument();
    expect(screen.getByText(en.statusValues["OpportunityStatus.WON"]!)).toBeInTheDocument();
    expect(screen.getByText(en.statusValues["OpportunityStageFlag.DISCOVERY"]!)).toBeInTheDocument();
    expect(screen.getByText(en.statusValues["OpportunityStageFlag.PROPOSAL"]!)).toBeInTheDocument();
    cleanup();

    show(event({ changes: [
      { field: "status", before: "PROSPECT", after: "ACTIVE_CUSTOMER", subjectId: LEAD },
    ] }), "en", "CustomerProfile");
    expect(screen.getByText(en.statusValues["CustomerStatus.PROSPECT"]!)).toBeInTheDocument();
    expect(screen.getByText(en.statusValues["CustomerStatus.ACTIVE_CUSTOMER"]!)).toBeInTheDocument();
  });

  it("localizes the Arabic rating labels and preserves before-to-after ordering", () => {
    show(event({ changes: [{ field: "rating", before: 0, after: 2 }] }), "ar");
    expect(screen.getByText(`${ar.audit.fields.rating}:`)).toBeInTheDocument();
    const previous = screen.getByRole("img", { name: formatTemplate(ar.audit.ratingBefore, { count: 0, max: 3 }) });
    expect(screen.getByRole("img", { name: formatTemplate(ar.audit.ratingAfter, { count: 2, max: 3 }) })).toBeInTheDocument();
    expect(previous.parentElement).toHaveAttribute("dir", "ltr");
  });
});
