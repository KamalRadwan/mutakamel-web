import { beforeEach, describe, expect, it, vi } from "vitest";
import { tradeGet } from "../trade-api";
import { ChannelPageLimitError, loadChannels } from "./load-channels";

vi.mock("../trade-api", () => ({ tradeGet: vi.fn() }));
const get = vi.mocked(tradeGet);
const channel = (id: number) => ({
  id: `019f0000-0000-7000-8000-${String(id).padStart(12, "0")}`,
  companyId: "019f0000-0000-7000-8000-000000000001",
  code: `CHANNEL${id}`, name: `Channel ${id}`, channelType: "POS", status: "ACTIVE",
  configurationProfileVersionId: null, version: 1, updatedAt: "2026-10-26T00:00:00.000Z",
});
const response = (items: unknown[], total: number, page: number) => ({
  data: { items, total, page, limit: 100 }, headers: new Headers(), status: 200,
});
beforeEach(() => get.mockReset());

describe("loadChannels", () => {
  it("caps an inflated total at 20 requests without returning a partial list", async () => {
    get.mockImplementation(async () => response(
      Array.from({ length: 100 }, (_, i) => channel(i + 1)),
      100000,
      get.mock.calls.length,
    ));
    await expect(loadChannels({})).rejects.toBeInstanceOf(ChannelPageLimitError);
    expect(get).toHaveBeenCalledTimes(20);
  });

  it("accepts a complete list ending exactly at the cap", async () => {
    get.mockImplementation(async () => response(
      Array.from({ length: 100 }, (_, i) => channel(i + 1)),
      2000,
      get.mock.calls.length,
    ));
    expect((await loadChannels({})).items).toHaveLength(2000);
    expect(get).toHaveBeenCalledTimes(20);
  });

  it("loads later pages for screen filtering and scope selection", async () => {
    const first = Array.from({ length: 100 }, (_, index) => channel(index + 1));
    get.mockResolvedValueOnce(response(first, 101, 1))
      .mockResolvedValueOnce(response([channel(101)], 101, 2));
    const controller = new AbortController();
    const config = { headers: { "x-mutakamel-company-id": channel(1).companyId }, signal: controller.signal };
    const result = await loadChannels(config);
    expect(result.items).toHaveLength(101);
    expect(result.items[100].id).toBe(channel(101).id);
    expect(result.total).toBe(101);
    expect(get).toHaveBeenNthCalledWith(2, expect.stringContaining("?page=2&limit=100"), config);
  });

  it("does not hide a later-page permission error as a complete list", async () => {
    get.mockResolvedValueOnce(response(Array.from({ length: 100 }, (_, i) => channel(i + 1)), 101, 1))
      .mockRejectedValueOnce(new Error("forbidden"));
    await expect(loadChannels({})).rejects.toThrow("forbidden");
  });

  it("rejects a stalled page rather than looping or returning incomplete options", async () => {
    get.mockResolvedValueOnce(response([], 101, 1));
    await expect(loadChannels({})).rejects.toThrow("Incomplete Trade channels response");
    expect(get).toHaveBeenCalledTimes(1);
  });
});
