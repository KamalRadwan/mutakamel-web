// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
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
    user: { permissions: ["trade.quotations.read"] },
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
});
