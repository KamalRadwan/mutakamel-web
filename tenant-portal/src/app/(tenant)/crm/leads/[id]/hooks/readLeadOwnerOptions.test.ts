import { afterEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { readAssignableLeadOwners } from "./readLeadOwnerOptions";

vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { get: vi.fn() } }));
const branchId = "01900100-0000-7000-8000-000000000001";
const headers = {
  "x-mutakamel-company-id": "01900100-0000-7000-8000-000000000004",
  "x-mutakamel-branch-id": branchId,
};
const owner = { id: "01900100-0000-7000-8000-000000000002", displayName: "Dina Ali", avatarUrl: null };
const teammate = { id: "01900100-0000-7000-8000-000000000003", displayName: "Ahmed Ali", avatarUrl: "/api/tenant/core/v1/directory/parties/image" };
const response = (data: unknown) => ({ data }) as Awaited<ReturnType<typeof axiosClient.get>>;
afterEach(() => vi.resetAllMocks());

describe("CRM lead owner candidates", () => {
  it.each(["create", "update"] as const)("follows every cursor with the same branch and %s action", async (action) => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce(response({ items: [owner], nextCursor: owner.id }))
      .mockResolvedValueOnce(response({ items: [teammate], nextCursor: null }));
    const signal = new AbortController().signal;
    expect(await readAssignableLeadOwners(branchId, action, signal, headers)).toEqual([
      { id: owner.id, firstName: owner.displayName, lastName: "" },
      { id: teammate.id, firstName: teammate.displayName, lastName: "" },
    ]);
    const urls = vi.mocked(axiosClient.get).mock.calls.map(([url]) => new URL(url, "https://tenant.example"));
    expect(urls).toHaveLength(2);
    for (const url of urls) {
      expect(url.pathname).toBe("/api/tenant/crm/v1/assignable-owners");
      expect(url.searchParams.get("branchId")).toBe(branchId);
      expect(url.searchParams.get("resource")).toBe("leads");
      expect(url.searchParams.get("action")).toBe(action);
    }
    expect(urls[0].searchParams.has("cursor")).toBe(false);
    expect(urls[1].searchParams.get("cursor")).toBe(owner.id);
    for (const [, config] of vi.mocked(axiosClient.get).mock.calls) {
      expect(config).toEqual(expect.objectContaining({ signal, headers }));
    }
  });
  it.each([
    { items: [owner] },
    { items: [{ ...owner, id: "bad-id" }], nextCursor: null },
    { items: [{ ...owner, displayName: null }], nextCursor: null },
    { items: [{ ...owner, avatarUrl: 1 }], nextCursor: null },
    { items: [owner, owner], nextCursor: null },
    { items: [], nextCursor: owner.id },
    { items: [owner], nextCursor: teammate.id },
    { data: { items: [owner], nextCursor: null } },
  ])("rejects malformed CRM pages instead of showing partial candidates: %j", async (page) => {
    vi.mocked(axiosClient.get).mockResolvedValue(response(page));
    await expect(readAssignableLeadOwners(branchId, "update", new AbortController().signal, headers)).rejects.toThrow();
  });
  it("rejects repeated owners across cursor pages", async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce(response({ items: [owner], nextCursor: owner.id }))
      .mockResolvedValueOnce(response({ items: [owner], nextCursor: null }));
    await expect(readAssignableLeadOwners(branchId, "update", new AbortController().signal, headers)).rejects.toThrow();
  });
  it("fails the whole read when a later page is denied", async () => {
    const denied = new Error("Forbidden");
    vi.mocked(axiosClient.get).mockResolvedValueOnce(response({ items: [owner], nextCursor: owner.id })).mockRejectedValueOnce(denied);
    await expect(readAssignableLeadOwners(branchId, "update", new AbortController().signal, headers)).rejects.toBe(denied);
  });
});
