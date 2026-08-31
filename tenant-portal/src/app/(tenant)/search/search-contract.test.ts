import { describe, expect, it } from "vitest";
import { NAV_SECTIONS } from "@/design-system";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import {
  SEARCH_MAX_TERM_LENGTH,
  SEARCH_SOURCES,
  buildCrmSearchPath,
  buildPartiesSearchQuery,
  isSearchableTerm,
  normalizeSearchTerm,
  parseCoreSearchPage,
  parseCrmSearchPage,
} from "./search-contract";

const branchId = "01900100-0000-7000-8000-000000000099";
const partyId = "01900100-0000-7000-8000-000000000110";
const leadId = "01900100-0000-7000-8000-000000000111";

describe("search term handling", () => {
  it("clamps to the 200-character DTO bound instead of letting the server 400", () => {
    // PaginationQueryDto.search is @MaxLength(200) — a longer term is rejected.
    const term = normalizeSearchTerm("x".repeat(400));
    expect(term).toHaveLength(SEARCH_MAX_TERM_LENGTH);
  });

  it("trims, and refuses a term too short to be worth a fan-out", () => {
    expect(normalizeSearchTerm("  acme  ")).toBe("acme");
    expect(isSearchableTerm("a")).toBe(false);
    expect(isSearchableTerm("ac")).toBe(true);
  });
});

describe("request paths", () => {
  it("sorts Core parties by displayName — the useful order for a name search", () => {
    const query = buildPartiesSearchQuery("acme", 2, 10);
    expect(query).toContain("sortBy=displayName");
    expect(query).toContain("sortDir=ASC");
    expect(query).toContain("page=2");
    expect(query).toContain("search=acme");
  });

  it("always carries branchId on a CRM list — it is required, not optional", () => {
    // BranchListQueryDto declares `@IsUUID('7') branchId!: string`. Without it
    // every CRM list is a 422 before the handler runs.
    const path = buildCrmSearchPath("leads", branchId, "acme", 1, 10);
    expect(path).toContain(`branchId=${branchId}`);
    expect(path.startsWith("/api/tenant/crm/v1/leads?")).toBe(true);
  });

  it("sends no sortBy to a CRM list", () => {
    // The CRM sort whitelists do not contain the party columns the search
    // matches, and a value outside the whitelist is a 400.
    const path = buildCrmSearchPath("opportunities", branchId, "renewal", 1, 10);
    expect(path).not.toContain("sortBy");
  });

  it("percent-encodes a term rather than splicing it into the query", () => {
    expect(buildCrmSearchPath("leads", branchId, "a&b=c", 1, 10)).toContain(
      "search=a%26b%3Dc",
    );
  });
});

describe("Core envelope — data plus a SIBLING meta", () => {
  it("reads the party page", () => {
    const page = parseCoreSearchPage({
      data: [{ id: partyId, displayName: "Acme Holdings", legalName: "Acme Holdings LLC" }],
      meta: { page: 1, limit: 10, total: 3 },
    });
    expect(page.items).toEqual([
      { id: partyId, title: "Acme Holdings", subtitle: "Acme Holdings LLC" },
    ]);
    expect(page.total).toBe(3);
  });

  it("accepts a null legalName as an absent subtitle", () => {
    const page = parseCoreSearchPage({
      data: [{ id: partyId, displayName: "Acme", legalName: null }],
      meta: { total: 1 },
    });
    expect(page.items[0].subtitle).toBeNull();
  });

  it("rejects a CRM-shaped flat page", () => {
    expect(() =>
      parseCoreSearchPage({ data: undefined, meta: undefined }),
    ).toThrow("Invalid search response.");
  });
});

describe("CRM envelope — FLAT, with no meta anywhere", () => {
  it("reads a lead page from the top level", () => {
    // crm-app's paginatedReadModels puts page/limit/total at the TOP level.
    // Reading `payload.meta` here is the defect that shipped once already.
    const page = parseCrmSearchPage("leads", {
      items: [{ id: leadId, displayName: "Sara Nour", companyName: "Acme" }],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });
    expect(page.items).toEqual([
      { id: leadId, title: "Sara Nour", subtitle: "Acme" },
    ]);
    expect(page.total).toBe(1);
  });

  it("rejects a Core-shaped { items, meta } payload", () => {
    expect(() =>
      parseCrmSearchPage("leads", {
        items: [{ id: leadId, displayName: "Sara Nour" }],
        meta: { total: 1 },
      }),
    ).toThrow("Invalid search response.");
  });

  it("rejects the Core { success, data } envelope outright", () => {
    expect(() =>
      parseCrmSearchPage("customerProfiles", {
        success: true,
        data: { items: [], total: 0 },
      }),
    ).toThrow("Invalid search response.");
  });

  it("accepts totalPages 0 for an empty CRM set", () => {
    // Not 1: paginatedReadModels short-circuits before the divide.
    const page = parseCrmSearchPage("opportunities", {
      items: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
    expect(page).toEqual({ items: [], total: 0 });
  });

  it("projects an opportunity from its title, the only column the route searches", () => {
    const page = parseCrmSearchPage("opportunities", {
      items: [{ id: leadId, title: "Annual renewal", customerName: "Acme" }],
      total: 1,
    });
    expect(page.items[0]).toEqual({
      id: leadId,
      title: "Annual renewal",
      subtitle: null,
    });
  });

  it("rejects a row whose id is not a UUIDv7", () => {
    expect(() =>
      parseCrmSearchPage("leads", {
        items: [{ id: "42", displayName: "Sara" }],
        total: 1,
      }),
    ).toThrow("Invalid search response.");
  });

  it("rejects a page claiming fewer total rows than it returned", () => {
    expect(() =>
      parseCrmSearchPage("leads", {
        items: [
          { id: leadId, displayName: "A" },
          { id: partyId, displayName: "B" },
        ],
        total: 1,
      }),
    ).toThrow("Invalid search response.");
  });

  it("rejects duplicate ids in one page", () => {
    expect(() =>
      parseCrmSearchPage("leads", {
        items: [
          { id: leadId, displayName: "A" },
          { id: leadId, displayName: "B" },
        ],
        total: 2,
      }),
    ).toThrow("Invalid search response.");
  });
});

describe("source catalogue", () => {
  it("routes every family to a detail path the proxy already admits", () => {
    // A screen is not delivered until something can reach it (D22 / Q40).
    // These four detail routes exist and are in the CORE/CRM allowlists.
    expect(SEARCH_SOURCES.parties.detailHref(partyId)).toBe(
      `/core/directory/${partyId}`,
    );
    expect(SEARCH_SOURCES.leads.detailHref(leadId)).toBe(`/crm/leads/${leadId}`);
    expect(SEARCH_SOURCES.customerProfiles.detailHref(leadId)).toBe(
      `/crm/customer-profiles/${leadId}`,
    );
    expect(SEARCH_SOURCES.opportunities.detailHref(leadId)).toBe(
      `/crm/opportunities/${leadId}`,
    );
  });

  it("accepts the scoped permission form only where CRM actually seeds one", () => {
    // Core permissions carry no .own/.team/.all suffix; CRM read grants do.
    expect(SEARCH_SOURCES.parties.acceptsScopedPermission).toBe(false);
    expect(SEARCH_SOURCES.leads.acceptsScopedPermission).toBe(true);
    expect(SEARCH_SOURCES.opportunities.acceptsScopedPermission).toBe(true);
  });
});

describe("reachability — a screen is not delivered until something reaches it", () => {
  it("has a route constant and a sidebar entry, not just a page file", () => {
    // Route admission lives in lib/navigation/tenant-routes.ts and the sidebar
    // in design-system/shell/nav-config.ts — different files from the route,
    // and nothing in `pnpm verify` connects the two. Six CRM detail screens
    // shipped complete, tested and green while being unreachable (D22, Q40).
    expect(TENANT_ROUTES.search).toBe("/search");

    const entries = NAV_SECTIONS.flatMap((section) => section.items).filter(
      (item) => item.href === TENANT_ROUTES.search,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].hasAccess([])).toBe(true);
  });

  it("points every family's 'full list' link at a route the app defines", () => {
    const hrefs = Object.values(TENANT_ROUTES) as string[];
    for (const source of Object.values(SEARCH_SOURCES)) {
      expect(hrefs).toContain(source.listHref);
    }
  });
});
