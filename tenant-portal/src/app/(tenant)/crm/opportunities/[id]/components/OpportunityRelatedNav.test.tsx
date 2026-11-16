// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpportunityDetail } from "../../opportunity-contract";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { OpportunityRelatedNav } from "./OpportunityRelatedNav";

const BRANCH_ID = "01900100-0000-7000-8000-0000000000c1";
const COMPANY_ID = "01900100-0000-7000-8000-0000000000d1";
const PARTY_ID = "01900100-0000-7000-8000-0000000000b1";
const { api, authMock } = vi.hoisted(() => ({ api: { post: vi.fn() }, authMock: { user: {
  permissions: [] as string[], accessibleBranches: ["01900100-0000-7000-8000-0000000000c1"],
  accessibleBranchCompanies: [{ branchId: "01900100-0000-7000-8000-0000000000c1", companyId: "01900100-0000-7000-8000-0000000000d1" }],
}, isLoading: false } }));
vi.mock("@/lib/api/axiosClient", async (original) => ({ ...(await original<typeof import("@/lib/api/axiosClient")>()), axiosClient: api }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => authMock }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));
vi.mock("@/design-system", async (original) => ({ ...(await original<typeof import("@/design-system")>()) }));
const item = { id: "01900100-0000-7000-8000-000000000001", branchId: BRANCH_ID, customerPartyId: PARTY_ID, customerDisplayName: "Nile Engineering" } as OpportunityDetail;
beforeEach(() => {
  vi.clearAllMocks();
  authMock.user.permissions = ["crm.opportunities.read.own", "trade.quotations.read", "trade.sales_orders.read", "trade.invoices.read"];
  api.post.mockImplementation((path: string) => Promise.resolve({ data: { items: [{ partyId: PARTY_ID, count: path.includes("opportunities") ? 0 : path.includes("quotations") ? 2 : path.includes("sales-orders") ? 3 : 4 }] } }));
});
afterEach(cleanup);

describe("Customer business counters", () => {
  it("renders one row with four customer-party counters and correct request scopes", async () => {
    render(<OpportunityRelatedNav item={item} />);
    await screen.findByRole("link", { name: "Opportunities: 0" });
    expect(screen.queryByRole("link", { name: "Title: 0" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("region", { name: en.crmOpportunityDetail.form.customerBusiness })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Quotations: 2" })).toHaveAttribute("href", `/trade/quotations?partyId=${PARTY_ID}`);
    expect(screen.getByRole("link", { name: "Sales orders: 3" })).toHaveAttribute("href", `/trade/sales-orders?partyId=${PARTY_ID}`);
    expect(screen.getByRole("link", { name: "Invoices: 4" })).toHaveAttribute("href", `/trade/invoices?partyId=${PARTY_ID}`);
    expect(api.post).toHaveBeenCalledTimes(4);
    for (const [path, body, config] of api.post.mock.calls) {
      if (path.includes("opportunities")) expect(body).toEqual({ branchId: BRANCH_ID, partyIds: [PARTY_ID] });
      else { expect(body).toEqual({ partyIds: [PARTY_ID] }); expect(config.headers).toEqual({ "x-mutakamel-company-id": COMPANY_ID, "x-mutakamel-branch-id": BRANCH_ID }); }
    }
  });
  it("does not request denied families and does not turn them into zero", async () => {
    authMock.user.permissions = [];
    render(<OpportunityRelatedNav item={item} />);
    expect(await screen.findByLabelText(`Invoices: ${en.crmOpportunityDetail.form.countDenied}`)).toHaveTextContent("—");
    expect(screen.queryByRole("link", { name: /Invoices/u })).not.toBeInTheDocument();
    await Promise.resolve();
    expect(api.post).not.toHaveBeenCalled();
  });
  it("shows an unavailable count separately from an authoritative permission refusal", async () => {
    api.post.mockImplementation((path: string) => {
      if (path.includes("invoices")) throw new TenantApiClientError("Forbidden", { status: 403, statusText: "Forbidden", headers: new Headers(), data: {} });
      if (path.includes("quotations")) throw new TenantApiClientError("Unavailable", { status: 503, statusText: "Unavailable", headers: new Headers(), data: {} });
      return Promise.resolve({ data: { items: [{ partyId: PARTY_ID, count: 0 }] } });
    });
    render(<OpportunityRelatedNav item={item} />);
    await screen.findByRole("link", { name: `Quotations: ${en.crmOpportunityDetail.form.countUnavailable}` });
    expect(await screen.findByLabelText(`Invoices: ${en.crmOpportunityDetail.form.countDenied}`)).toHaveTextContent("—");
    expect(screen.getByRole("link", { name: `${en.crmOpportunities.heading}: 0` })).toBeInTheDocument();
  });
  it("never reuses one customer's numbers for the next customer", async () => {
    const view = render(<OpportunityRelatedNav item={item} />);
    await screen.findByRole("link", { name: "Invoices: 4" });
    api.post.mockImplementation(() => new Promise(() => {}));
    view.rerender(<OpportunityRelatedNav item={{ ...item, customerPartyId: "01900100-0000-7000-8000-0000000000b2" }} />);
    await waitFor(() => expect(screen.queryByRole("link", { name: "Invoices: 4" })).not.toBeInTheDocument());
    expect(screen.getByRole("link", { name: `Invoices: ${en.common.loading}` })).toHaveTextContent("…");
  });
});
