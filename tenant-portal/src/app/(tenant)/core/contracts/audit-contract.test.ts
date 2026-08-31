import { describe, expect, it } from "vitest";
import {
  AUDIT_PATH,
  auditEntityHistoryPath,
  auditLedgerPath,
  parseAuditEvent,
  parseAuditPage,
} from "./audit-contract";

const auditRow = {
  id: "9007199254740993",
  tenantId: "01902001-3000-7000-8000-000000000000",
  actorUserId: "01902001-3000-7000-8000-000000000001",
  actorType: "TENANT_USER",
  actorLabel: "Mona Saleh",
  action: "party.updated",
  entityType: "party",
  entityId: "01902001-3000-7000-8000-000000000002",
  before: null,
  after: null,
  diff: [],
  correlationId: "01902001-3000-7000-8000-0000000000ff",
  ip: null,
  userAgent: null,
  metadata: {},
  schemaVersion: 1,
  sourceApp: "CORE",
  sourceKind: "HTTP_COMMAND",
  outcome: "FAILURE",
  sourceEventId: null,
  requestId: null,
  operationId: null,
  idempotencyKey: null,
  reason: "Duplicate contact method refused",
  createdAt: "2026-08-30T09:00:00.000Z",
};

describe("Tenant audit contract", () => {
  it("uses the canonical ledger path and the two-parameter entity route", () => {
    expect(AUDIT_PATH).toBe("/api/tenant/core/v1/audit");
    expect(auditLedgerPath(2, 25, { outcome: "FAILURE" })).toBe(
      "/api/tenant/core/v1/audit?page=2&limit=25&outcome=FAILURE",
    );
    // There is no route that stops at `/entities`; both parameters are required.
    expect(auditEntityHistoryPath("party", "abc def", 1, 10)).toBe(
      "/api/tenant/core/v1/audit/entities/party/abc%20def?page=1&limit=10",
    );
  });

  it("clamps the limit the way the service does", () => {
    expect(auditLedgerPath(1, 500, {})).toContain("limit=100");
  });

  it("surfaces outcome and reason — the half that matters during an incident", () => {
    const event = parseAuditEvent(auditRow);
    expect(event.outcome).toBe("FAILURE");
    expect(event.reason).toBe("Duplicate contact method refused");
    expect(event.sourceApp).toBe("CORE");
    expect(event.sourceKind).toBe("HTTP_COMMAND");
  });

  it("keeps an unrecognised provenance value recoverable instead of throwing", () => {
    const event = parseAuditEvent({ ...auditRow, sourceApp: "FUTURE_APP", outcome: null });
    expect(event.sourceApp).toBeNull();
    expect(event.outcome).toBeNull();
  });

  it("derives hasNext and hasPrev, because this endpoint returns neither", () => {
    const middle = parseAuditPage({
      items: [auditRow],
      total: 75,
      page: 2,
      limit: 25,
      totalPages: 3,
    });
    expect(middle.hasNext).toBe(true);
    expect(middle.hasPrev).toBe(true);

    const last = parseAuditPage({
      items: [auditRow],
      total: 75,
      page: 3,
      limit: 25,
      totalPages: 3,
    });
    expect(last.hasNext).toBe(false);
    expect(last.hasPrev).toBe(true);

    const only = parseAuditPage({ items: [], total: 0, page: 1, limit: 25, totalPages: 0 });
    expect(only.hasNext).toBe(false);
    expect(only.hasPrev).toBe(false);
  });

  it("rejects a page whose counts contradict the rows it carries", () => {
    expect(() =>
      parseAuditPage({ items: [auditRow, auditRow], total: 1, page: 1, limit: 25, totalPages: 1 }),
    ).toThrow("Invalid Core identity response.");
  });
});
