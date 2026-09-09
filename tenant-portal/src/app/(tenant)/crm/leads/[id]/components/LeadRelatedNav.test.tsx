// @vitest-environment jsdom

/**
 * The action bar's middle, on a lead.
 *
 * What these prove: the four counts come from four different services and one
 * refusing tells the others nothing; opportunities join on the LEAD and trade
 * documents on its PARTY, which are different ids and not interchangeable; the
 * scope headers go to the one route whose Gateway policy asks for them; and a
 * count that did not come back reads as a dash rather than as zero.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { api, authMock } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  authMock: {
    user: {
      permissions: [
        "crm.opportunities.read",
        "trade.quotations.read",
        "trade.sales_orders.read",
        "trade.invoices.read",
      ],
      isTenantOwner: false,
      // A LIST of pairs, which is the shape `resolveCompanyForBranch`
      // validates. Without it the scope does not resolve and the invoices
      // count is skipped outright, because that route is BRANCH_REQUIRED.
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

import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { LeadRelatedNav } from "./LeadRelatedNav";

vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

const copy = en.crmLeadDetail.related;
const LEAD_ID = "01900100-0000-7000-8000-0000000000a1";
const PARTY_ID = "01900100-0000-7000-8000-0000000000b1";
const BRANCH_ID = "01900100-0000-7000-8000-0000000000c1";

/** Trade lists put the pager inside `data`; CRM's search answers it flat. */
const tradeTotal = (total: number) => ({
  data: { success: true, data: { items: [], total }, correlationId: "c" },
});
const crmTotal = (total: number) => ({ data: { items: [], total, page: 1, limit: 1 } });

function renderNav() {
  render(
    <I18nProvider>
      <LeadRelatedNav leadId={LEAD_ID} partyId={PARTY_ID} branchId={BRANCH_ID} />
    </I18nProvider>,
  );
}

const link = (kind: keyof typeof copy.labels) =>
  screen.getByRole("link", { name: new RegExp(copy.labels[kind]) });

beforeEach(() => {
  vi.clearAllMocks();
  api.post.mockResolvedValue(crmTotal(2));
  api.get.mockImplementation((path: string) => {
    if (path.includes("/quotations")) return Promise.resolve(tradeTotal(3));
    if (path.includes("/sales-orders")) return Promise.resolve(tradeTotal(4));
    return Promise.resolve(tradeTotal(5));
  });
});

afterEach(cleanup);

describe("the lead's related records", () => {
  it("counts each resource against the id that resource is filed under", async () => {
    renderNav();

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    // Opportunities carry `leadId`. Filtering them by the party would answer a
    // different question — every opportunity that party has ever had.
    const [searchPath, searchBody] = api.post.mock.calls[0];
    expect(searchPath).toBe("/api/tenant/crm/v1/opportunities/search");
    expect(searchBody).toMatchObject({
      branchId: BRANCH_ID,
      filterTree: { field: "leadId", operator: "eq", value: LEAD_ID },
      limit: 1,
    });

    // A trade document has never heard of a lead: it is filed against a party.
    const paths = api.get.mock.calls.map((call: unknown[]) => String(call[0]));
    expect(paths).toHaveLength(3);
    for (const path of paths) expect(path).toContain(`partyId=${PARTY_ID}`);
  });

  it("shows each count beside its own link", async () => {
    renderNav();
    await waitFor(() => expect(link("opportunities")).toHaveTextContent("2"));
    expect(link("quotations")).toHaveTextContent("3");
    expect(link("salesOrders")).toHaveTextContent("4");
    expect(link("invoices")).toHaveTextContent("5");
    // The number is in the accessible name too — the badge alone is a bare
    // digit with no noun attached to it.
    expect(link("invoices")).toHaveAccessibleName(`${copy.labels.invoices}: 5`);
  });

  it("sends the scope headers to invoices and to nothing else", async () => {
    renderNav();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3));
    // Only `trading.invoices.get` declares BRANCH_REQUIRED. A route that
    // declares none rejects the headers outright.
    for (const [path, config] of api.get.mock.calls as [string, { headers?: unknown }][]) {
      if (path.includes("/invoices")) expect(config.headers).toBeTruthy();
      else expect(config.headers).toBeUndefined();
    }
  });

  it("leaves a refused count as a dash, and keeps the other three", async () => {
    // A CRM user whose Trade access is partial is the ordinary case, not an
    // error state — and a failed count printed as 0 is a number they would act
    // on.
    api.get.mockImplementation((path: string) =>
      path.includes("/invoices")
        ? Promise.reject(new Error("forbidden"))
        : Promise.resolve(tradeTotal(3)),
    );
    renderNav();

    await waitFor(() => expect(link("quotations")).toHaveTextContent("3"));
    expect(link("invoices")).toHaveTextContent("—");
  });

  it("renders only what the user may open, and nothing at all when that is nothing", async () => {
    authMock.user = { ...authMock.user, permissions: ["crm.opportunities.read"] };
    renderNav();
    await waitFor(() => expect(link("opportunities")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: new RegExp(copy.labels.invoices) })).toBeNull();
    // Three services never asked.
    expect(api.get).not.toHaveBeenCalled();

    cleanup();
    authMock.user = { ...authMock.user, permissions: [] };
    const { container } = render(
      <I18nProvider>
        <LeadRelatedNav leadId={LEAD_ID} partyId={PARTY_ID} branchId={BRANCH_ID} />
      </I18nProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
