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
    data: null,
    requestState: "EMPTY",
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

vi.mock("@/components/layout/Navbar", () => ({
  Navbar: () => <nav>Admin navigation</nav>,
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en" }),
}));
vi.mock("../hooks/use-control-plane-audit", () => ({
  useControlPlaneAudit: () => auditMock,
}));

import { ControlPlaneAuditScreen } from "./control-plane-audit-screen";

describe("ControlPlaneAuditScreen", () => {
  beforeEach(() => {
    auditMock.canRead = true;
    auditMock.isAuthLoading = false;
    auditMock.setMode.mockClear();
    auditMock.applyFilters.mockClear();
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
});
