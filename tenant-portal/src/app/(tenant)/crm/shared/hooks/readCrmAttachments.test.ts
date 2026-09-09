import { beforeEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { readAllCrmAttachments } from "./readCrmAttachments";

vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { get: vi.fn() } }));
const source = { branchId: "01900100-0000-7000-8000-000000000001", sourceType: "LEAD" as const,
  sourceId: "01900100-0000-7000-8000-000000000002" };
const rows = Array.from({ length: 51 }, (_, index) => ({
  ...source, id: `01900100-0000-7000-8000-${String(index + 10).padStart(12, "0")}`,
  fileName: `file-${index}.pdf`, mimeType: "application/pdf", sizeBytes: 100,
  uploadedByUserId: null, createdAt: "2026-09-07T10:00:00.000Z",
}));
function page(number: number) {
  return { items: rows.slice((number - 1) * 50, number * 50),
    total: 51, page: number, limit: 50, totalPages: 2, hasNext: number < 2, hasPrev: number > 1 };
}
function reply(data: unknown) {
  return { data, status: 200, headers: new Headers(), statusText: "OK", config: {} };
}
beforeEach(() => vi.resetAllMocks());

describe("all CRM record attachments", () => {
  it("loads more than fifty with branch and source scope on every page", async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce(reply(page(1))).mockResolvedValueOnce(reply(page(2)));
    await expect(readAllCrmAttachments(source)).resolves.toHaveLength(51);
    for (const [index, [path]] of vi.mocked(axiosClient.get).mock.calls.entries()) {
      const query = new URL(path, "http://localhost").searchParams;
      expect(Object.fromEntries(query)).toEqual({ ...source, page: String(index + 1), limit: "50" });
    }
  });
  it("accepts an empty CRM page (totalPages is zero)", async () => {
    vi.mocked(axiosClient.get).mockResolvedValue(reply({ ...page(1), items: [], total: 0, totalPages: 0, hasNext: false }));
    await expect(readAllCrmAttachments(source)).resolves.toEqual([]);
  });
  it("fails the whole read if a later page fails", async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce(reply(page(1))).mockRejectedValueOnce(new Error("offline"));
    await expect(readAllCrmAttachments(source)).rejects.toThrow("offline");
  });
  it.each([
    { ...page(1), page: 2 }, { ...page(1), hasNext: false }, { ...page(1), items: [] },
    { ...page(1), items: [{ ...rows[0], sourceId: rows[0].id }] },
  ])("rejects invalid pagination or another record's attachment", async (data) => {
    vi.mocked(axiosClient.get).mockResolvedValue(reply(data));
    await expect(readAllCrmAttachments(source)).rejects.toThrow();
    expect(axiosClient.get).toHaveBeenCalledOnce();
  });
  it("rejects duplicate rows across pages", async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce(reply(page(1)))
      .mockResolvedValueOnce(reply({ ...page(2), items: [rows[0]] }));
    await expect(readAllCrmAttachments(source)).rejects.toThrow("pagination changed");
  });
  it("stops after cancellation without returning stale results", async () => {
    const controller = new AbortController();
    vi.mocked(axiosClient.get).mockImplementationOnce(async () => { controller.abort(); return reply(page(1)); });
    await expect(readAllCrmAttachments(source, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(axiosClient.get).toHaveBeenCalledOnce();
  });
});
