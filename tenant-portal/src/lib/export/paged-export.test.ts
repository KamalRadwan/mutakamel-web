import { describe, expect, it, vi } from "vitest";
import { collectPages } from "./paged-export";

function pagedSource(total: number, pageSize: number) {
  return vi.fn(async (page: number) => ({
    items: Array.from(
      { length: Math.max(0, Math.min(pageSize, total - (page - 1) * pageSize)) },
      (_, index) => `row-${(page - 1) * pageSize + index}`,
    ),
    total,
  }));
}

const signal = () => new AbortController().signal;

describe("collectPages", () => {
  it("walks every page and reports the whole set as complete", async () => {
    const fetchPage = pagedSource(25, 10);
    const result = await collectPages({
      fetchPage,
      pageSize: 10,
      maxRows: 1000,
      maxPages: 50,
      signal: signal(),
    });

    expect(result.rows).toHaveLength(25);
    expect(result.total).toBe(25);
    expect(result.truncated).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("stops on a short page without asking for one more", async () => {
    // The termination condition that does not depend on `total` being
    // self-consistent — CRM's totalPages is 0, not 1, for an empty set.
    const fetchPage = pagedSource(7, 10);
    const result = await collectPages({
      fetchPage,
      pageSize: 10,
      maxRows: 1000,
      maxPages: 50,
      signal: signal(),
    });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.rows).toHaveLength(7);
    expect(result.truncated).toBe(false);
  });

  it("reports truncation when the row cap bites, and stops fetching", async () => {
    const fetchPage = pagedSource(1000, 10);
    const result = await collectPages({
      fetchPage,
      pageSize: 10,
      maxRows: 25,
      maxPages: 50,
      signal: signal(),
    });

    expect(result.rows).toHaveLength(25);
    expect(result.total).toBe(1000);
    expect(result.truncated).toBe(true);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("reports truncation when the page cap bites", async () => {
    const fetchPage = pagedSource(1000, 10);
    const result = await collectPages({
      fetchPage,
      pageSize: 10,
      maxRows: 10_000,
      maxPages: 4,
      signal: signal(),
    });

    expect(fetchPage).toHaveBeenCalledTimes(4);
    expect(result.rows).toHaveLength(40);
    expect(result.truncated).toBe(true);
  });

  it("never reports truncation for an empty result set", async () => {
    const result = await collectPages({
      fetchPage: pagedSource(0, 10),
      pageSize: 10,
      maxRows: 100,
      maxPages: 5,
      signal: signal(),
    });

    expect(result.rows).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it("reports progress against a total already clamped by the row cap", async () => {
    // The bound has to reach the UI as the number the user will actually get,
    // or a progress bar promises 1,000 rows and delivers 25.
    const progress: Array<{ loaded: number; expected: number }> = [];
    await collectPages({
      fetchPage: pagedSource(1000, 10),
      pageSize: 10,
      maxRows: 25,
      maxPages: 50,
      signal: signal(),
      onProgress: ({ loaded, expected }) => progress.push({ loaded, expected }),
    });

    expect(progress).toEqual([
      { loaded: 10, expected: 25 },
      { loaded: 20, expected: 25 },
      { loaded: 25, expected: 25 },
    ]);
  });

  it("fetches sequentially rather than firing every page at the Gateway at once", async () => {
    // S9: the Gateway rate-limits. Forty concurrent reads trade a complete
    // export for a 429 halfway through.
    let inFlight = 0;
    let peak = 0;
    await collectPages({
      pageSize: 10,
      maxRows: 1000,
      maxPages: 50,
      signal: signal(),
      fetchPage: async (page) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        return {
          items: page <= 3 ? Array.from({ length: 10 }, (_, i) => `r${i}`) : [],
          total: 30,
        };
      },
    });

    expect(peak).toBe(1);
  });

  it("lets a rejection out rather than returning a partial file silently", async () => {
    await expect(
      collectPages({
        pageSize: 10,
        maxRows: 100,
        maxPages: 5,
        signal: signal(),
        fetchPage: async () => {
          throw new Error("upstream failed");
        },
      }),
    ).rejects.toThrow("upstream failed");
  });
});
