import { beforeEach, describe, expect, it, vi } from "vitest";
import { readCorePage } from "@/lib/api/envelope";
import { readAllLeadActivities } from "./readLeadActivities";

vi.mock("@/lib/api/envelope", () => ({ readCorePage: vi.fn() }));
const leadId = "01900100-0000-7000-8000-000000000001";
const rows = Array.from({ length: 26 }, (_, index) => ({
  id: `01900100-0000-7000-8000-${String(index + 10).padStart(12, "0")}`,
  subject: `Call ${index}`, dueAt: "2026-10-07T10:00:00.000Z", type: "CALL",
  priority: "NORMAL", description: null, version: 1,
}));
function page(number: number) {
  return { data: { items: rows.slice((number - 1) * 25, number * 25),
    page: number, limit: 25, total: 26, totalPages: 2, hasNext: number < 2 }, meta: undefined };
}
beforeEach(() => vi.resetAllMocks());

describe("all planned activities", () => {
  it("follows every page with the same lead and open-status filters", async () => {
    vi.mocked(readCorePage).mockResolvedValueOnce(page(1)).mockResolvedValueOnce(page(2));
    const result = await readAllLeadActivities(leadId, new AbortController().signal);
    expect(result).toHaveLength(26);
    expect(result.at(-1)?.subject).toBe("Call 25");
    for (const [index, call] of vi.mocked(readCorePage).mock.calls.entries()) {
      expect(call[0]).toBe("/api/tenant/core/v1/activities");
      expect(Object.fromEntries(new URLSearchParams(call[1]))).toMatchObject({
        page: String(index + 1), limit: "25", status: "PLANNED", targetApp: "CRM",
        targetType: "LEAD", targetId: leadId, sortBy: "dueAt", sortDir: "ASC",
      });
    }
  });
  it("does not present page one as a complete list when page two fails", async () => {
    vi.mocked(readCorePage).mockResolvedValueOnce(page(1)).mockRejectedValueOnce(new Error("offline"));
    await expect(readAllLeadActivities(leadId, new AbortController().signal)).rejects.toThrow("offline");
  });
  it.each([
    { ...page(1).data, page: 2 }, { ...page(1).data, items: [] },
    { ...page(1).data, hasNext: false }, { ...page(1).data, totalPages: 999 },
  ])("rejects malformed pagination", async (data) => {
    vi.mocked(readCorePage).mockResolvedValue({ data, meta: undefined });
    await expect(readAllLeadActivities(leadId, new AbortController().signal)).rejects.toThrow();
    expect(readCorePage).toHaveBeenCalledOnce();
  });
  it("rejects repeated rows across pages instead of rendering duplicate keys", async () => {
    vi.mocked(readCorePage).mockResolvedValueOnce(page(1)).mockResolvedValueOnce({
      ...page(2), data: { ...page(2).data, items: [rows[0]] },
    });
    await expect(readAllLeadActivities(leadId, new AbortController().signal)).rejects.toThrow("pagination changed");
  });
  it("aborts before requesting another page", async () => {
    const controller = new AbortController();
    vi.mocked(readCorePage).mockImplementationOnce(async () => { controller.abort(); return page(1); });
    await expect(readAllLeadActivities(leadId, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(readCorePage).toHaveBeenCalledOnce();
  });
  it("accepts an empty Core page (totalPages is one)", async () => {
    vi.mocked(readCorePage).mockResolvedValue({ data: {
      items: [], total: 0, page: 1, limit: 25, totalPages: 1, hasNext: false,
    }, meta: undefined });
    await expect(readAllLeadActivities(leadId, new AbortController().signal)).resolves.toEqual([]);
  });
});
