// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  permissions: ["trade.quotations.read"] as string[],
  scope: {
    ready: true as const,
    headers: {
      "x-mutakamel-company-id": "0192f3a0-0000-7000-8000-000000000001",
      "x-mutakamel-branch-id": "0192f3a0-0000-7000-8000-000000000002",
    },
    gap: null,
  },
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    user: { permissions: mocks.permissions },
  }),
}));

vi.mock("@/hooks/useOrganizationScope", () => ({
  useOrganizationScopeHeaders: () => mocks.scope,
}));

vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return {
    ...actual,
    axiosClient: { ...actual.axiosClient, post: mocks.post },
  };
});

const { usePartyDocumentCounts } = await import("./usePartyDocumentCounts");

const BRANCH_ID = "0192f3a0-0000-7000-8000-000000000002";
const partyIds = Array.from({ length: 101 }, (_, index) =>
  `0192f3a0-0000-7000-8000-${(index + 1).toString(16).padStart(12, "0")}`,
);
const parties = partyIds.map((partyId) => ({ partyId }));

beforeEach(() => {
  mocks.permissions = ["trade.quotations.read"];
  mocks.post.mockReset();
  mocks.post.mockImplementation(
    async (_path: string, body: { partyIds: string[] }) => ({
      data: {
        items: body.partyIds.map((partyId) => ({ partyId, count: 1 })),
      },
    }),
  );
});

afterEach(cleanup);

describe("usePartyDocumentCounts", () => {
  it("loads every party in API-sized batches instead of dropping parties after 100", async () => {
    const { result } = renderHook(() =>
      usePartyDocumentCounts(parties, BRANCH_ID, true),
    );

    await waitFor(() => expect(result.current.countsByParty.size).toBe(101));
    expect(result.current.countsByParty.get(partyIds[100]!)).toEqual({
      opportunities: null,
      quotations: 1,
      salesOrders: null,
      invoices: null,
    });
    expect(mocks.post).toHaveBeenCalledTimes(2);
    expect(
      mocks.post.mock.calls.map(([, body]) => body.partyIds.length),
    ).toEqual([100, 1]);
    expect(
      mocks.post.mock.calls.flatMap(([, body]) => body.partyIds),
    ).toEqual(partyIds);
  });

  it("counts opportunities from CRM with the branch in the body and no scope headers, under a scoped grant", async () => {
    mocks.permissions = ["crm.opportunities.read.own"];
    const few = parties.slice(0, 2);
    const { result } = renderHook(() =>
      usePartyDocumentCounts(few, BRANCH_ID, true),
    );

    await waitFor(() => expect(result.current.countsByParty.get(partyIds[0]!)?.opportunities).toBe(1));
    expect(result.current.visible).toEqual({
      opportunities: true,
      quotations: false,
      salesOrders: false,
      invoices: false,
    });
    expect(mocks.post).toHaveBeenCalledTimes(1);
    const [path, body, config] = mocks.post.mock.calls[0]!;
    expect(path).toBe("/api/tenant/crm/v1/opportunities/counts-by-party");
    expect(body).toEqual({ branchId: BRANCH_ID, partyIds: partyIds.slice(0, 2) });
    expect(config.headers).toBeUndefined();
  });

  it("builds party-scoped navigation hrefs for all four document families", async () => {
    const { buildPartyDocumentHref } = await import("../party-document-counts-contract");
    const pid = partyIds[0]!;
    expect(buildPartyDocumentHref("opportunities", pid)).toBe(`/crm/opportunities?partyId=${pid}`);
    expect(buildPartyDocumentHref("quotations", pid)).toBe(`/trade/quotations?partyId=${pid}`);
    expect(buildPartyDocumentHref("salesOrders", pid)).toBe(`/trade/sales-orders?partyId=${pid}`);
    expect(buildPartyDocumentHref("invoices", pid)).toBe(`/trade/invoices?partyId=${pid}`);
  });
});
