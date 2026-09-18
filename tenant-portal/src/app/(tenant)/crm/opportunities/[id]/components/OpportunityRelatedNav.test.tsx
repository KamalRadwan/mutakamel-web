// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpportunityDetail } from "../../opportunity-contract";

const BRANCH_ID = "01900100-0000-7000-8000-0000000000c1";
const COMPANY_ID = "01900100-0000-7000-8000-0000000000d1";
const PARTY_ID = "01900100-0000-7000-8000-0000000000b1";
const CUSTOMER_ID = "01900100-0000-7000-8000-0000000000a1";
const LEAD_ID = "01900100-0000-7000-8000-0000000000e1";

const { api, authMock } = vi.hoisted(() => ({
  api: { post: vi.fn() },
  authMock: {
    user: {
      permissions: [
        "crm.customer_profiles.read.own",
        "crm.leads.read.team",
        "trade.quotations.read",
        "trade.sales_orders.read",
        "trade.invoices.read",
      ],
      accessibleBranches: ["01900100-0000-7000-8000-0000000000c1"],
      accessibleBranchCompanies: [{
        branchId: "01900100-0000-7000-8000-0000000000c1",
        companyId: "01900100-0000-7000-8000-0000000000d1",
      }],
    },
    isLoading: false,
  },
}));

vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/axiosClient")>()),
  axiosClient: { post: api.post },
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => authMock }));
vi.mock("@/design-system", async () => ({
  ...(await import("@/design-system/primitives/Badge")),
  ...(await import("@/design-system/primitives/Button")),
  ...(await import("@/design-system/patterns/permission-gate/hasPermission")),
  ...(await import("@/design-system/lib/cn")),
  ...(await import("@/design-system/lib/icons")),
}));

import { en } from "@/i18n/dictionaries/en";
import { OpportunityRelatedNav } from "./OpportunityRelatedNav";

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

const item = {
  id: "01900100-0000-7000-8000-000000000001",
  branchId: BRANCH_ID,
  customerProfileId: CUSTOMER_ID,
  customerPartyId: PARTY_ID,
  leadId: LEAD_ID,
} as OpportunityDetail;

beforeEach(() => {
  vi.clearAllMocks();
  authMock.user.permissions = [
    "crm.customer_profiles.read.own",
    "crm.leads.read.team",
    "trade.quotations.read",
    "trade.sales_orders.read",
    "trade.invoices.read",
  ];
  api.post.mockImplementation((path: string) => {
    const total = path.includes("quotations") ? 2 : path.includes("sales-orders") ? 3 : 4;
    return Promise.resolve({ data: { items: [{ partyId: PARTY_ID, count: total }] } });
  });
});

afterEach(cleanup);

describe("Opportunity related records", () => {
  it("links its customer and source lead and counts the customer's trade records", async () => {
    render(<OpportunityRelatedNav item={item} />);

    expect(screen.getByRole("link", { name: en.nav.customerProfiles }))
      .toHaveAttribute("href", `/crm/customer-profiles/${CUSTOMER_ID}`);
    expect(screen.getByRole("link", { name: en.nav.leads }))
      .toHaveAttribute("href", `/crm/leads/${LEAD_ID}`);
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: `${en.crmLeadDetail.related.labels.invoices}: 4` }),
      ).toBeInTheDocument(),
    );

    expect(api.post).toHaveBeenCalledTimes(3);
    for (const [, body, config] of api.post.mock.calls) {
      expect(body).toEqual({ partyIds: [PARTY_ID] });
      expect(config.headers).toEqual({
        "x-mutakamel-company-id": COMPANY_ID,
        "x-mutakamel-branch-id": BRANCH_ID,
      });
    }
  });

  it("does not request or render document families without permission", async () => {
    authMock.user.permissions = ["crm.customer_profiles.read.own"];
    render(<OpportunityRelatedNav item={{ ...item, leadId: null }} />);

    expect(screen.getByRole("link", { name: en.nav.customerProfiles }))
      .toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Invoices/u })).not.toBeInTheDocument();
    await Promise.resolve();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("hides trade shortcuts when the opportunity has no customer party", async () => {
    render(<OpportunityRelatedNav item={{ ...item, customerPartyId: null }} />);

    expect(screen.queryByRole("link", { name: /Quotations/u })).not.toBeInTheDocument();
    await Promise.resolve();
    expect(api.post).not.toHaveBeenCalled();
  });
});
