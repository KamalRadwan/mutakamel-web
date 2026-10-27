// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { api, authMock } = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  authMock: {
    user: {
      permissions: [
        "crm.opportunities.read",
        "trade.quotations.read",
        "trade.sales_orders.read",
        "trade.invoices.read",
      ],
      isTenantOwner: false,
      accessibleBranches: ["01900100-0000-7000-8000-0000000000c1"],
      accessibleBranchCompanies: [
        {
          branchId: "01900100-0000-7000-8000-0000000000c1",
          companyId: "01900100-0000-7000-8000-0000000000d1",
        },
      ],
    },
    isLoading: false,
  },
}));

vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/axiosClient")>()),
  axiosClient: api,
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => authMock }));
vi.mock("@/design-system", async () => ({
  ...(await import("@/design-system/primitives/Badge")),
  ...(await import("@/design-system/primitives/Button")),
  ...(await import("@/design-system/lib/cn")),
  ...(await import("@/design-system/lib/icons")),
  ...(await import("@/design-system/patterns/permission-gate/hasPermission")),
}));

import { en } from "@/i18n/dictionaries/en";
import { CustomerProfileRelatedNav } from "./CustomerProfileRelatedNav";

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

const CUSTOMER_ID = "01900100-0000-7000-8000-0000000000a1";
const PARTY_ID = "01900100-0000-7000-8000-0000000000b1";
const BRANCH_ID = "01900100-0000-7000-8000-0000000000c1";

describe("CustomerProfileRelatedNav", () => {
  beforeEach(() => {
    authMock.user.permissions = [
      "crm.opportunities.read", "trade.quotations.read",
      "trade.sales_orders.read", "trade.invoices.read",
    ];
    api.post.mockResolvedValue({ data: { items: [], total: 3 } });
    api.get.mockImplementation((url: string) => {
      if (url.includes("quotations")) {
        return Promise.resolve({ data: { data: { items: [], total: 5 } } });
      }
      if (url.includes("sales-orders")) {
        return Promise.resolve({ data: { data: { items: [], total: 2 } } });
      }
      if (url.includes("invoices")) {
        return Promise.resolve({ data: { data: { items: [], total: 8 } } });
      }
      return Promise.reject(new Error("unknown url"));
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it.each(["own", "team", "all"])("loads Opportunities for %s scope without Trade links or requests", async (scope) => {
    authMock.user.permissions = [`crm.opportunities.read.${scope}`];
    const view = render(
      <CustomerProfileRelatedNav customerProfileId={CUSTOMER_ID} partyId={PARTY_ID} branchId={BRANCH_ID} />,
    );
    await waitFor(() => expect(screen.getByRole("link", { name: "Opportunities: 3" })).toBeInTheDocument());
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.get).not.toHaveBeenCalled();

    authMock.user.permissions = [];
    view.rerender(
      <CustomerProfileRelatedNav customerProfileId={CUSTOMER_ID} partyId={PARTY_ID} branchId={BRANCH_ID} />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  });

  it("renders links for opportunities, quotations, sales orders, and invoices", async () => {
    render(
      <CustomerProfileRelatedNav
        customerProfileId={CUSTOMER_ID}
        partyId={PARTY_ID}
        branchId={BRANCH_ID}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("8")).toBeInTheDocument();
    });

    expect(api.post).toHaveBeenCalledWith(
      "/api/tenant/crm/v1/opportunities/search",
      expect.objectContaining({
        filterTree: {
          field: "customerPartyId",
          operator: "eq",
          value: PARTY_ID,
        },
      }),
      expect.anything(),
    );

    const links = screen.getAllByRole("link");
    expect(links.map((el) => el.getAttribute("href"))).toEqual([
      `/crm/opportunities?partyId=${PARTY_ID}`,
      `/trade/quotations?partyId=${PARTY_ID}`,
      `/trade/sales-orders?partyId=${PARTY_ID}`,
      `/trade/invoices?partyId=${PARTY_ID}`,
    ]);
  });
});
