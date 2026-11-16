// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { formatTemplate } from "@/lib/format/template";
import type { EntityAuditEvent } from "@/lib/audit/entity-history-contract";
import { HistoryDiffList } from "@/design-system";
import { toHistoryTreeItem } from "./EntityHistoryEvent";

vi.mock("@/design-system", async () => ({
  ...(await import("@/design-system/primitives/RatingStars")),
  ...(await import("@/design-system/patterns/history-tree/HistoryDiffList")),
}));
afterEach(cleanup);

const LEAD = "01900100-0000-7000-8000-000000000001";
const PARTY = "01900100-0000-7000-8000-000000000002";
const BRANCH = "01900100-0000-7000-8000-000000000003";
const STAGE = "01900100-0000-7000-8000-000000000004";
const CUSTOMER = "01900100-0000-7000-8000-000000000005";
const PIPELINE = "01900100-0000-7000-8000-000000000006";
const QUOTATION = "01900100-0000-7000-8000-000000000007";
const ORDER = "01900100-0000-7000-8000-000000000008";
const INVOICE = "01900100-0000-7000-8000-000000000009";

const createdChanges: EntityAuditEvent["changes"] = [
  { field: "firstName", before: null, after: "Mostafa", subjectId: PARTY, subjectLabel: "Mostafa Saleh" },
  { field: "leadProfileType", before: null, after: "INDIVIDUAL", subjectId: LEAD },
  { field: "branchId", before: null, after: BRANCH, subjectId: LEAD },
  { field: "stageId", before: null, after: STAGE, subjectId: LEAD },
  { field: "rating", before: null, after: 0, subjectId: LEAD },
  { field: "phone", before: [], after: ["+201044556699"], subjectId: PARTY, subjectLabel: "Mostafa Saleh" },
];

function event(overrides: Partial<EntityAuditEvent> = {}): EntityAuditEvent {
  return {
    id: "event",
    action: "LEAD_UPDATED",
    actorLabel: "Kamal Radwan",
    occurredAt: "2026-09-14T10:18:00",
    outcome: "SUCCESS",
    reason: null,
    changes: [],
    ...overrides,
  };
}

function show(entry: EntityAuditEvent, lang: "ar" | "en" = "en", entityType = "Lead") {
  const copy = { en, ar }[lang];
  const item = toHistoryTreeItem(entry, lang, copy.audit, copy.statusValues, undefined, {
    entityType,
    entityId: LEAD,
  });
  render(
    <HistoryDiffList
      rows={item.diffs ?? []}
      emptyMessage={copy.audit.detailsNotRecorded}
      footer={item.detailsFooter}
    />,
  );
  return item;
}

describe("Lead history tree item presentation", () => {
  it("resolves Level 1 actor/timestamp, Level 2 Create Lead title, and Level 3 initial field details without leaking UUIDs", () => {
    const item = show(event({ action: "LEAD_CREATED", changes: createdChanges }));
    expect(item.actorName).toBe("Kamal Radwan");
    expect(item.actorInitials).toBe("KR");
    expect(item.timestamp).toBe("14/09/2026 10:18 AM");
    expect(item.actionTitle).toBe("Create Lead");
    expect(item.changeCount).toBe(6);
    expect(item.changeCountLabel).toBe("6 changes");
    expect(screen.getByText("Mostafa")).toBeInTheDocument();
    expect(screen.getByText("+201044556699")).toBeInTheDocument();
    expect(screen.queryByText(BRANCH)).not.toBeInTheDocument();
    expect(screen.queryByText(STAGE)).not.toBeInTheDocument();
  });

  it("shows details-not-recorded placeholder when Create Lead has no stored field diffs", () => {
    const item = show(event({ action: "LEAD_CREATED", changes: [] }));
    expect(item.actionTitle).toBe("Create Lead");
    expect(item.changeCount).toBe(0);
    expect(item.changeCountLabel).toBeNull();
    expect(screen.getByText(en.audit.detailsNotRecorded)).toBeInTheDocument();
  });

  it.each(["CREATE", "CRM_PARTY_UPDATED"])(
    "recognizes grouped lead creation when Core returns %s as the legacy action",
    (action) => {
      const item = show(event({ action, changes: createdChanges }));
      expect(item.actionTitle).toBe("Create Lead");
    },
  );

  it("keeps later contact creation and existing lead updates distinct from Lead creation", () => {
    const item = show(
      event({
        action: "CREATE",
        changes: [
          createdChanges[0],
          createdChanges[5],
          { field: "stageId", before: STAGE, after: BRANCH, subjectId: LEAD },
        ],
      }),
    );
    expect(item.actionTitle).not.toBe("Create Lead");
    expect(screen.getByText("Mostafa")).toBeInTheDocument();
    expect(screen.getByText("+201044556699")).toBeInTheDocument();
    expect(screen.queryByText(STAGE)).not.toBeInTheDocument();
    expect(screen.getAllByText(en.audit.valueUnavailable)[0]).toHaveClass("line-through");
  });

  it("maps foreign contact mutations to Add Contact and Update Contact titles", () => {
    const added = show(
      event({
        action: "CREATE",
        subjectKind: "contact",
        changes: createdChanges.map((change) => ({ ...change, subjectId: PARTY })),
      }),
    );
    expect(added.actionTitle).toBe("Add Contact");
    expect(screen.getByText("INDIVIDUAL")).toBeInTheDocument();
    cleanup();

    const updated = show(
      event({
        action: "CRM_PARTY_UPDATED",
        subjectKind: "contact",
        changes: [{ field: "phone", before: ["0100"], after: ["0200"], subjectId: PARTY, subjectLabel: "Saly Essam" }],
      }),
    );
    expect(updated.actionTitle).toBe("Update Contact");
    expect(updated.changeCountLabel).toBe("1 change");
  });

  it("maps Trade documents and CRM attachments to dedicated Level 2 titles and reference badges", () => {
    const quotation = show(
      event({
        action: "QUOTATION_CREATED",
        subjectKind: "quotation",
        subjectId: QUOTATION,
        referenceLabel: "QT-2026-0018",
      }),
    );
    expect(quotation.actionTitle).toBe("Add Quotation");
    expect(quotation.referenceLabel).toBe("#QT-2026-0018");
    expect(quotation.referenceHref).toBe(`/trade/quotations/${QUOTATION}`);
    cleanup();

    const order = show(
      event({
        action: "SALES_ORDER_CREATED",
        subjectKind: "salesOrder",
        subjectId: ORDER,
        referenceLabel: "SO-2026-0007",
      }),
    );
    expect(order.actionTitle).toBe("Add Sales Order");
    expect(order.referenceLabel).toBe("#SO-2026-0007");
    expect(order.referenceHref).toBe(`/trade/sales-orders/${ORDER}`);
    cleanup();

    const invoice = show(
      event({
        action: "INVOICE_CREATED",
        subjectKind: "invoice",
        subjectId: INVOICE,
        referenceLabel: "INV-2026-0042",
      }),
    );
    expect(invoice.actionTitle).toBe("Add Invoice");
    expect(invoice.referenceLabel).toBe("#INV-2026-0042");
    expect(invoice.referenceHref).toBe(`/trade/invoices/${INVOICE}`);
    cleanup();

    const attachment = show(
      event({
        action: "ATTACHMENT_CREATED",
        subjectKind: "attachment",
        referenceLabel: "proposal.pdf",
        changes: [{ field: "sizeBytes", before: null, after: 4096 }],
      }),
    );
    expect(attachment.actionTitle).toBe("Add Attachment");
    expect(attachment.referenceLabel).toBe("proposal.pdf");
    expect(attachment.referenceHref).toBeNull();
    expect(screen.getByText("4.0 KB")).toBeInTheDocument();
    cleanup();

    const note = show(
      event({
        action: "NOTE_CREATED",
        subjectKind: "note",
      }),
    );
    expect(note.actionTitle).toBe("Add Note");
  });

  it("preserves failed creation evidence and its reason", () => {
    const item = show(
      event({
        action: "LEAD_CREATED",
        outcome: "FAILURE",
        reason: "Request rejected",
        changes: createdChanges,
      }),
    );
    expect(item.outcome).toBe("FAILURE");
    expect(screen.getByText("Mostafa")).toBeInTheDocument();
    expect(screen.getByText("Reason: Request rejected")).toBeInTheDocument();
  });

  it.each([0, 1, 2, 3])(
    "renders a rating of %i as three gold/silver stars with a chronological transition",
    (after) => {
      const before = (after + 1) % 4;
      show(event({ changes: [{ field: "rating", before, after, subjectId: LEAD }] }));
      const previous = screen.getByRole("img", {
        name: formatTemplate(en.audit.ratingBefore, { count: before, max: 3 }),
      });
      const next = screen.getByRole("img", {
        name: formatTemplate(en.audit.ratingAfter, { count: after, max: 3 }),
      });
      for (const [element, count] of [
        [previous, before],
        [next, after],
      ] as const) {
        expect(element.querySelectorAll("svg")).toHaveLength(3);
        expect(element.querySelectorAll(".text-warning-vivid")).toHaveLength(count);
        expect(element.querySelectorAll("svg:not(.text-warning-vivid)")).toHaveLength(3 - count);
        expect(element).not.toHaveClass("line-through");
      }
      expect(previous.parentElement).toHaveAttribute("dir", "ltr");
      expect(previous.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(document.body).toHaveTextContent(/^Rating:>$/);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    },
  );

  it.each([null, "[NOT_RECORDED]", 4])(
    "does not turn unavailable or invalid rating evidence (%s) into zero stars",
    (before) => {
      show(event({ changes: [{ field: "rating", before, after: 2 }] }));
      expect(screen.getAllByRole("img")).toHaveLength(1);
      const label =
        before === null
          ? en.audit.valueEmpty
          : before === "[NOT_RECORDED]"
            ? en.audit.valueNotRecorded
            : "4";
      expect(screen.getByText(label)).toBeInTheDocument();
    },
  );

  it("leaves other entity history and non-rating fields detailed", () => {
    show(event({ action: "CREATE", changes: [{ field: "rating", before: 1, after: 2 }] }), "en", "Invoice");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("1")).toHaveClass("line-through");
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("localizes action titles in Arabic without leaking raw UUIDs", () => {
    const item = show(event({ action: "LEAD_CREATED", changes: createdChanges }), "ar");
    expect(item.actionTitle).toBe(ar.audit.actions.LEAD_CREATED);
    expect(screen.queryByText(BRANCH)).not.toBeInTheDocument();
  });

  it.each([
    ["CustomerProfile", "CUSTOMER_PROFILE_CREATED", "Create Customer"],
    ["Opportunity", "OPPORTUNITY_CREATED", "Create Opportunity"],
  ])("resolves explicit %s creation title", (entityType, action, label) => {
    const item = show(event({ action, changes: createdChanges }), "en", entityType);
    expect(item.actionTitle).toBe(label);
    expect(screen.queryByText(BRANCH)).not.toBeInTheDocument();
  });

  it("recognizes grouped Customer and Opportunity creation from their root fields", () => {
    const customer = show(
      event({
        action: "CREATE",
        changes: [
          { field: "profileType", before: null, after: "CORPORATE", subjectId: LEAD },
          { field: "branchId", before: null, after: BRANCH, subjectId: LEAD },
          { field: "status", before: null, after: "PROSPECT", subjectId: LEAD },
        ],
      }),
      "en",
      "CustomerProfile",
    );
    expect(customer.actionTitle).toBe("Create Customer");
    cleanup();

    const opportunity = show(
      event({
        action: "CREATE",
        changes: [
          { field: "branchId", before: null, after: BRANCH, subjectId: LEAD },
          { field: "customerProfileId", before: null, after: CUSTOMER, subjectId: LEAD },
          { field: "pipelineId", before: null, after: PIPELINE, subjectId: LEAD },
          { field: "stageId", before: null, after: STAGE, subjectId: LEAD },
        ],
      }),
      "en",
      "Opportunity",
    );
    expect(opportunity.actionTitle).toBe("Create Opportunity");
  });

  it("uses each record type's status catalogue", () => {
    show(
      event({
        changes: [
          { field: "status", before: "IN_PROGRESS", after: "WON", subjectId: LEAD },
          { field: "stageFlag", before: "DISCOVERY", after: "PROPOSAL", subjectId: LEAD },
        ],
      }),
      "en",
      "Opportunity",
    );
    expect(screen.getByText(en.statusValues["OpportunityStatus.IN_PROGRESS"]!)).toBeInTheDocument();
    expect(screen.getByText(en.statusValues["OpportunityStatus.WON"]!)).toBeInTheDocument();
    expect(screen.getByText(en.statusValues["OpportunityStageFlag.DISCOVERY"]!)).toBeInTheDocument();
    expect(screen.getByText(en.statusValues["OpportunityStageFlag.PROPOSAL"]!)).toBeInTheDocument();
    cleanup();

    show(
      event({
        changes: [{ field: "status", before: "PROSPECT", after: "ACTIVE_CUSTOMER", subjectId: LEAD }],
      }),
      "en",
      "CustomerProfile",
    );
    expect(screen.getByText(en.statusValues["CustomerStatus.PROSPECT"]!)).toBeInTheDocument();
    expect(screen.getByText(en.statusValues["CustomerStatus.ACTIVE_CUSTOMER"]!)).toBeInTheDocument();
  });

  it("localizes the Arabic rating labels and preserves before-to-after ordering", () => {
    show(event({ changes: [{ field: "rating", before: 0, after: 2 }] }), "ar");
    expect(screen.getByText(`${ar.audit.fields.rating}:`)).toBeInTheDocument();
    const previous = screen.getByRole("img", {
      name: formatTemplate(ar.audit.ratingBefore, { count: 0, max: 3 }),
    });
    expect(
      screen.getByRole("img", { name: formatTemplate(ar.audit.ratingAfter, { count: 2, max: 3 }) }),
    ).toBeInTheDocument();
    expect(previous.parentElement).toHaveAttribute("dir", "ltr");
  });
});
