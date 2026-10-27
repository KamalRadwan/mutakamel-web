import { describe, expect, it } from "vitest";
import { auditLedgerPath, parseAuditEvent, parseAuditPage } from "./audit-contract";
import { auditNotificationText } from "./notification-text";
import { canReadAudit } from "./permissions";
import { auditCatalogue, auditRecordHref, auditSubjectForPath } from "./catalogue";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";

const event = { id: "event", action: "DELETE", entityType: "TradeItemEntity", entityId: "item",
  actorType: "USER", createdAt: "2026-10-17T10:00:00.000Z",
  before: { label: "Saved", password: "[REDACTED]" }, after: null,
  diff: [{ field: "label", before: "Saved", after: null }] };

describe("tenant audit cursor API", () => {
  it("round-trips the opaque cursor and sends only supported filters", () => {
    const path = auditLedgerPath("a+/=", { sourceApp: "CRM", branchId: "branch", sensitivity: "HIGH", q: "Acme" }, true);
    const url = new URL(path, "https://tenant.example");
    expect(url.pathname).toBe("/api/tenant/core/v1/audit/deleted");
    expect(Object.fromEntries(url.searchParams)).toEqual({ limit: "25", cursor: "a+/=", sourceApp: "CRM", branchId: "branch", sensitivity: "HIGH", q: "Acme" });
    expect(auditLedgerPath(null, { q: "Acme" })).not.toContain("q=");
    expect(url.searchParams.has("page")).toBe(false);
  });
  it("uses nextCursor even on a short page and never invents a total", () => {
    expect(parseAuditPage({ items: [event], nextCursor: "next" }).nextCursor).toBe("next");
    expect(parseAuditPage({ items: [event], nextCursor: null }).nextCursor).toBeNull();
    expect(() => parseAuditPage({ items: [event], page: 1, total: 1 })).toThrow();
    expect(() => parseAuditPage({ items: [], nextCursor: 3 })).toThrow();
  });
  it("preserves stored redacted snapshots and the server diff", () => {
    expect(parseAuditEvent(event)).toMatchObject({ before: event.before, after: null, diff: event.diff });
    expect(() => parseAuditEvent({ ...event, diff: [{ before: "x", after: "y" }] })).toThrow();
  });
  it.each(["audit.read", "audit.read.branch", "audit.read.own"])("admits %s exactly", (permission) => {
    expect(canReadAudit([permission])).toBe(true);
    expect(canReadAudit([])).toBe(false);
    expect(canReadAudit(["audit.read.all"])).toBe(false);
  });
});

describe("audit catalogue and notification presentation", () => {
  it("has translated labels for every catalogued subject", () => {
    for (const entry of auditCatalogue) {
      expect(en.audit.ledger.entities[entry.labelKey]).toBeTruthy();
      expect(ar.audit.ledger.entities[entry.labelKey]).toBeTruthy();
    }
    expect(auditSubjectForPath("/trade/items/item")).toEqual({ entityType: "TradeItemEntity", entityId: "item" });
    expect(auditSubjectForPath("/trade/inventory/decisions/id")?.entityType).toBe("TradeDecisionReceiptEntity");
    expect(auditSubjectForPath("/core/audit/events/id")).toBeNull();
    expect(auditSubjectForPath("/trade/items/id/unknown")).toBeNull();
    expect(auditRecordHref("TradeItemEntity", "a/b")).toBe("/trade/items/a%2Fb");
    expect(auditRecordHref("Unknown", "id")).toBeNull();
    expect(auditRecordHref("TradeItemCompanyProfileEntity", "id")).toBeNull();
    expect(auditCatalogue.find((entry) => entry.entityType === "TradeItemCompanyProfileEntity")?.labelKey).toBe("itemCompanyProfile");
    expect(auditCatalogue.find((entry) => entry.entityType === "Lead")?.notify).toEqual({ ownerChanged: true, deleted: true });
    expect(auditCatalogue.find((entry) => entry.entityType === "TradeItemEntity")?.notify).toEqual({ ownerChanged: false, deleted: false });
  });
  it.each([en, ar])("decodes current JSON params in the active language", (dictionary) => {
    const original = { title: "Server title", body: "Server body", metadata: { messageKey: "record.deleted", params: JSON.stringify({ entityLabel: "Acme" }) } };
    expect(auditNotificationText(original, dictionary.audit.recordMessages)).toEqual({
      title: dictionary.audit.recordMessages.deletedTitle,
      body: dictionary.audit.recordMessages.deletedBody.replace("{entityLabel}", "Acme"),
    });
    expect(auditNotificationText({ ...original, metadata: { ...original.metadata, messageKey: "record.owner_changed" } }, dictionary.audit.recordMessages).title)
      .toBe(dictionary.audit.recordMessages.ownerChangedTitle);
  });
  it("keeps server text for unknown keys or malformed params", () => {
    for (const metadata of [{ messageKey: "unknown", params: "{}" }, { messageKey: "record.deleted", params: "{" },
      { messageKey: "record.deleted", params: "null" }, { messageKey: "record.deleted", params: '{"entityLabel":3}' }]) {
      const original = { title: "Server title", body: "Server body", metadata };
      expect(auditNotificationText(original, en.audit.recordMessages)).toBe(original);
    }
  });
});
