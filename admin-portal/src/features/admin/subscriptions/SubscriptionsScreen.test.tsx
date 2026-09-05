// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SubscriptionsViewModel } from "./types";

const { languageMock, viewMock } = vi.hoisted(() => ({
  languageMock: { lang: "en" as "en" | "ar" },
  viewMock: {} as SubscriptionsViewModel,
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => languageMock,
}));
vi.mock("./useSubscriptions", () => ({
  useSubscriptions: () => viewMock,
}));

import { readSubscriptionsPage } from "./readers";
import { SubscriptionsScreen } from "./SubscriptionsScreen";
import { TENANT_ID, validSubscriptionsEnvelope } from "./test-fixtures";

function baseView(): SubscriptionsViewModel {
  return {
    canRead: true,
    applied: { sortBy: "createdAt", sortDir: "DESC" },
    draft: {
      status: "",
      tenantId: "",
      sortBy: "createdAt",
      sortDir: "DESC",
    },
    tenantIdError: null,
    data: null,
    requestState: "EMPTY",
    error: null,
    isRefreshing: false,
    page: 1,
    limit: 20,
    activeFilterCount: 0,
    changeSort: vi.fn(),
    setDraftField: vi.fn(),
    applyFilters: vi.fn(() => true),
    clearFilters: vi.fn(),
    refresh: vi.fn(),
    setPage: vi.fn(),
    setLimit: vi.fn(),
  };
}

describe("SubscriptionsScreen", () => {
  beforeEach(() => {
    languageMock.lang = "en";
    Object.assign(viewMock, baseView());
  });

  it("renders every supported Core query control and submits filters", () => {
    render(<SubscriptionsScreen />);

    expect(screen.getByRole("heading", { name: "Subscriptions" })).toBeTruthy();
    expect(screen.getByLabelText("Lifecycle status")).toBeTruthy();
    expect(screen.getByLabelText("Tenant UUIDv7")).toBeTruthy();
    expect(screen.getByLabelText("Order")).toBeTruthy();
    expect(screen.getByLabelText("Rows per page")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Lifecycle status"));
    fireEvent.click(screen.getByRole("option", { name: "PAST DUE" }));
    fireEvent.change(screen.getByLabelText("Tenant UUIDv7"), {
      target: { value: TENANT_ID },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(viewMock.setDraftField).toHaveBeenCalledWith("status", "PAST_DUE");
    expect(viewMock.setDraftField).toHaveBeenCalledWith("tenantId", TENANT_ID);
    expect(viewMock.applyFilters).toHaveBeenCalledOnce();
  });

  it("renders a permission-specific forbidden state without filter controls", () => {
    viewMock.canRead = false;
    viewMock.requestState = "FORBIDDEN";
    render(<SubscriptionsScreen />);

    expect(
      screen.getByText("Required permission: admin.subscriptions.read"),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Lifecycle status")).toBeNull();
    expect(screen.queryByLabelText("Tenant UUIDv7")).toBeNull();
  });

  it("shows an unavailable error with correlation and offers a safe retry", () => {
    viewMock.requestState = "UNAVAILABLE";
    viewMock.error = {
      isNormalized: true,
      httpStatus: 503,
      errorCode: "UPSTREAM_UNAVAILABLE",
      message: "Core is unavailable",
      correlationId: "019f0000-0000-7000-8000-000000000099",
    };
    render(<SubscriptionsScreen />);

    expect(screen.getByRole("alert").textContent).toContain(
      "019f0000-0000-7000-8000-000000000099",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(viewMock.refresh).toHaveBeenCalledOnce();
  });

  it("renders canonical subscription data and response correlation", () => {
    viewMock.requestState = "READY";
    viewMock.data = readSubscriptionsPage(validSubscriptionsEnvelope());
    render(<SubscriptionsScreen />);

    const tenantLink = screen.getByRole("link", { name: "Acme LLC" });
    expect(tenantLink.getAttribute("href")).toBe(`/tenants/${TENANT_ID}`);
    expect(screen.getByText("crm")).toBeTruthy();
    expect(screen.queryByText("Professional")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Inspect plan items: Acme LLC (1)" }),
    );
    expect(screen.getByText(/Professional/u)).toBeTruthy();
    expect(screen.getAllByText(/120\.0000 USD/u).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/019f0000-0000-7000-8000-000000000006/u),
    ).toBeTruthy();
  });

  it("uses the feature-local Arabic copy", () => {
    languageMock.lang = "ar";
    render(<SubscriptionsScreen />);

    expect(screen.getByRole("heading", { name: "الاشتراكات" })).toBeTruthy();
    expect(screen.getByLabelText("حالة دورة الحياة")).toBeTruthy();
    expect(
      screen.getByText("لا توجد اشتراكات تطابق عوامل التصفية."),
    ).toBeTruthy();
  });

  /**
   * FE-B02. The header's sort indicator read the DRAFT, so changing the filter
   * form's sort select moved the arrow immediately - while the rows below it
   * were still in the previous order, until the operator pressed Apply. The
   * arrow claimed the table was sorted a way it was not.
   */
  it("shows the sort the rows are in, not the unapplied draft", () => {
    // The operator has picked a different sort in the filter form and has NOT
    // applied it yet: draft and applied disagree, which is the whole case.
    viewMock.draft = { ...viewMock.draft, sortBy: "status", sortDir: "ASC" };
    viewMock.applied = { sortBy: "createdAt", sortDir: "DESC" };
    viewMock.requestState = "READY";
    viewMock.data = readSubscriptionsPage(validSubscriptionsEnvelope());

    render(<SubscriptionsScreen />);

    const headers = screen.getAllByRole("columnheader");
    const lifecycle = headers.find(
      (header) => header.getAttribute("aria-sort") !== null,
    );

    // "status" is the lifecycle column's sortField: what the draft asks for and
    // not what the data is in, so every sortable header must read "none".
    const sortStates = headers
      .map((header) => header.getAttribute("aria-sort"))
      .filter((value): value is string => value !== null);
    expect(lifecycle).toBeDefined();
    expect(sortStates).not.toContain("ascending");
  });
});
