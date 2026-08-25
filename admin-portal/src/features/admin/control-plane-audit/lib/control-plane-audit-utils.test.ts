import { describe, expect, it } from "vitest";
import {
  EMPTY_CONTROL_PLANE_AUDIT_FILTERS,
  formatAuditValue,
  sanitizeAuditValue,
  toControlPlaneAuditQuery,
  validateControlPlaneAuditFilters,
} from "./control-plane-audit-utils";

describe("control-plane audit filters", () => {
  it("enforces entity scope, tenant UUID, lengths, and date ordering", () => {
    const errors = validateControlPlaneAuditFilters({
      ...EMPTY_CONTROL_PLANE_AUDIT_FILTERS,
      tenantId: "not-a-uuid",
      action: "x".repeat(97),
      from: "2026-08-12T12:00",
      to: "2026-08-12T11:00",
    }, "ENTITY_HISTORY");

    expect(errors).toMatchObject({
      tenantId: "Enter a valid tenant UUID.",
      action: "Maximum 96 characters.",
      entityType: expect.any(String),
      entityId: expect.any(String),
      dateRange: expect.any(String),
    });
  });

  it("trims filters and converts local date inputs to ISO instants", () => {
    const query = toControlPlaneAuditQuery({
      ...EMPTY_CONTROL_PLANE_AUDIT_FILTERS,
      actorType: "SUPER_ADMIN",
      actorId: "  admin-1  ",
      action: "   ",
      from: "2026-08-12T10:30",
    });

    expect(query).toMatchObject({ actorType: "SUPER_ADMIN", actorId: "admin-1" });
    expect(query).not.toHaveProperty("action");
    expect(query.from).toBe(new Date("2026-08-12T10:30").toISOString());
  });
});

describe("control-plane audit rendering safety", () => {
  it("recursively re-redacts secret-like keys", () => {
    const sanitized = sanitizeAuditValue({
      email: "admin@example.com",
      passwordHash: "do-not-render",
      nested: { apiKey: "do-not-render-either", status: "ACTIVE" },
      array: [{ refresh_token: "hidden" }],
    });

    expect(sanitized).toEqual({
      email: "admin@example.com",
      passwordHash: "[REDACTED]",
      nested: { apiKey: "[REDACTED]", status: "ACTIVE" },
      array: [{ refresh_token: "[REDACTED]" }],
    });
    expect(formatAuditValue(sanitized)).not.toContain("do-not-render");
  });

  it("bounds long strings before rendering", () => {
    const rendered = formatAuditValue({ message: "x".repeat(3_000) });
    expect(rendered).toContain("[TRUNCATED]");
    expect(rendered.length).toBeLessThan(2_200);
  });
});
