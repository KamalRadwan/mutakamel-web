// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auditMock } = vi.hoisted(() => ({
  auditMock: {
    mode: "ALL_EVENTS" as "ALL_EVENTS" | "ENTITY_HISTORY",
    draft: {
      actorType: "",
      actorId: "",
      tenantId: "",
      action: "",
      entityType: "",
      entityId: "",
      outcome: "",
      sourceApp: "",
      sourceType: "",
      correlationId: "",
      from: "",
      to: "",
    },
    validationErrors: {},
    data: null as {
      items: Array<Record<string, unknown>>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    } | null,
    requestState: "EMPTY" as
      | "IDLE"
      | "LOADING"
      | "READY"
      | "EMPTY"
      | "FORBIDDEN"
      | "UNAVAILABLE",
    error: null,
    isRefreshing: false,
    isAuthLoading: false,
    canRead: true,
    page: 1,
    limit: 25,
    activeFilterCount: 0,
    setMode: vi.fn(),
    updateDraft: vi.fn(),
    applyFilters: vi.fn(() => true),
    clearFilters: vi.fn(),
    refresh: vi.fn(),
    setPage: vi.fn(),
    setLimit: vi.fn(),
  },
}));

const { detailMock, loadDetailMock } = vi.hoisted(() => {
  const loadDetailMock = vi.fn();
  return {
    loadDetailMock,
    detailMock: {
      status: "IDLE" as "IDLE" | "LOADING" | "READY" | "UNAVAILABLE",
      data: null as Record<string, unknown> | null,
      error: null,
      load: loadDetailMock,
      retry: vi.fn(),
    },
  };
});

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en" }),
}));
vi.mock("../hooks/use-control-plane-audit", () => ({
  useControlPlaneAudit: () => auditMock,
}));
vi.mock("../hooks/use-audit-event-detail", () => ({
  useAuditEventDetail: () => detailMock,
}));

import { ControlPlaneAuditScreen } from "./control-plane-audit-screen";

const EVENT_SUMMARY = {
  id: "019f0000-0000-7000-8000-000000000001",
  schemaVersion: 1,
  actorType: "SUPER_ADMIN",
  actorId: "019f0000-0000-7000-8000-000000000002",
  actorLabel: "Platform Admin",
  tenantId: null,
  action: "TENANT_UPDATED",
  entityType: "TenantEntity",
  entityId: "019f0000-0000-7000-8000-000000000003",
  outcome: "SUCCESS",
  sourceApp: "CORE",
  sourceType: "LIVE",
  sourceId: null,
  sourceRoute: "/admin/tenants/:id",
  operationId: null,
  correlationId: "019f0000-0000-7000-8000-000000000004",
  requestId: null,
  idempotencyKey: null,
  reason: null,
  ip: null,
  userAgent: null,
  occurredAt: "2026-08-12T08:00:00.000Z",
};

describe("ControlPlaneAuditScreen", () => {
  beforeEach(() => {
    auditMock.canRead = true;
    auditMock.isAuthLoading = false;
    auditMock.data = null;
    auditMock.requestState = "EMPTY";
    auditMock.setMode.mockClear();
    auditMock.applyFilters.mockClear();
    detailMock.status = "IDLE";
    detailMock.data = null;
    loadDetailMock.mockClear();
  });

  it("renders every Core query control and submits the filter form", () => {
    render(<ControlPlaneAuditScreen />);

    expect(screen.getByRole("heading", { name: "Control-plane audit" })).toBeTruthy();
    for (const label of [
      "Actor type",
      "Actor ID",
      "Tenant UUID",
      "Action",
      "Entity type",
      "Entity ID",
      "Outcome",
      "Source application",
      "Source type",
      "Correlation ID",
      "Occurred from",
      "Occurred before",
      "Page size",
    ]) {
      expect(screen.getByLabelText(new RegExp(`^${label}`))).toBeTruthy();
    }

    fireEvent.click(screen.getByRole("button", { name: "Entity history" }));
    expect(auditMock.setMode).toHaveBeenCalledWith("ENTITY_HISTORY");
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(auditMock.applyFilters).toHaveBeenCalledOnce();
  });

  it("renders a permission-specific forbidden state without the filters", () => {
    auditMock.canRead = false;
    render(<ControlPlaneAuditScreen />);

    expect(screen.getByText("Required permission: admin.audit.read")).toBeTruthy();
    expect(screen.queryByLabelText("Actor type")).toBeNull();
  });

  it("lazy-fetches evidence only when the details panel is opened", () => {
    auditMock.data = {
      items: [EVENT_SUMMARY],
      total: 1,
      page: 1,
      limit: 25,
      totalPages: 1,
    };
    auditMock.requestState = "READY";
    render(<ControlPlaneAuditScreen />);

    expect(loadDetailMock).not.toHaveBeenCalled();

    const details = screen.getByText("Inspect evidence").closest("details");
    if (!details) throw new Error("evidence <details> not found");
    details.open = true;
    fireEvent(details, new Event("toggle"));

    expect(loadDetailMock).toHaveBeenCalledOnce();
  });

  it("shows the evidence panel once the detail fetch resolves", () => {
    auditMock.data = {
      items: [EVENT_SUMMARY],
      total: 1,
      page: 1,
      limit: 25,
      totalPages: 1,
    };
    auditMock.requestState = "READY";
    detailMock.status = "READY";
    detailMock.data = {
      before: { status: "ACTIVE" },
      after: { status: "SUSPENDED" },
      diff: [],
      metadata: null,
    };
    render(<ControlPlaneAuditScreen />);

    expect(screen.getByText(/"status": "ACTIVE"/)).toBeTruthy();
    expect(screen.getByText(/"status": "SUSPENDED"/)).toBeTruthy();
  });
});
