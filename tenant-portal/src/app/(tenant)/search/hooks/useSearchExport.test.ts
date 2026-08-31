// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchSourceId } from "../search-contract";
import type { SearchSourceState } from "./useGlobalSearch";

const branchId = "01900100-0000-7000-8000-000000000099";

const state = vi.hoisted(() => ({
  readCorePage: vi.fn(),
  readCrmBody: vi.fn(),
  downloadCsv: vi.fn((fileName: string, csv: string) => fileName.length > 0 && csv.length > 0),
}));

vi.mock("@/lib/api/envelope", () => ({
  readCorePage: (...args: unknown[]) => state.readCorePage(...args),
  readCrmBody: (...args: unknown[]) => state.readCrmBody(...args),
}));

vi.mock("@/lib/export/csv", async (importOriginal) => {
  // Only the browser handoff is replaced. `toCsv` stays real, so what the
  // assertions read is the file the user would actually receive.
  const actual = await importOriginal<typeof import("@/lib/export/csv")>();
  return {
    ...actual,
    downloadCsv: (name: string, csv: string) => state.downloadCsv(name, csv),
  };
});

const { MAX_EXPORT_ROWS, exportRowEstimate, previewRowCount, useSearchExport } =
  await import("./useSearchExport");

const id = (n: number) =>
  `01900100-0000-7000-8000-${String(n).padStart(12, "0")}`;

function ready(total: number, rows: number, kind: "party" | "opportunity"): SearchSourceState {
  return {
    kind: "ready",
    page: {
      total,
      items: Array.from({ length: rows }, (_, index) => ({
        id: id(index),
        title: kind === "party" ? `Party ${index}` : `Deal ${index}`,
        subtitle: kind === "party" ? "Acme" : null,
      })),
    },
  };
}

function results(
  overrides: Partial<Record<SearchSourceId, SearchSourceState>> = {},
): Record<SearchSourceId, SearchSourceState> {
  return {
    parties: ready(3, 3, "party"),
    leads: { kind: "needsBranch" },
    customerProfiles: { kind: "unauthorized" },
    opportunities: { kind: "denied" },
    ...overrides,
  };
}

const LABELS = {
  source: "Family",
  title: "Name",
  subtitle: "Detail",
  reference: "Reference",
  sourceNames: {
    parties: "Party directory",
    leads: "Leads",
    customerProfiles: "Customer profiles",
    opportunities: "Opportunities",
  },
};

const SOURCE_IDS: SearchSourceId[] = [
  "parties",
  "leads",
  "customerProfiles",
  "opportunities",
];

function corePage(page: number, pageSize: number, total: number) {
  const start = (page - 1) * pageSize;
  return {
    data: Array.from(
      { length: Math.max(0, Math.min(pageSize, total - start)) },
      (_, index) => ({ id: id(start + index), displayName: `Party ${start + index}`, legalName: null }),
    ),
    meta: { total },
  };
}

function renderExport(overrides: Partial<Record<SearchSourceId, SearchSourceState>> = {}) {
  const value = results(overrides);
  return renderHook(() =>
    useSearchExport({
      term: "acme",
      branchId,
      sourceIds: SOURCE_IDS,
      results: value,
      labels: LABELS,
      fileNameBase: "mutakamel-search",
    }),
  );
}

beforeEach(() => {
  state.downloadCsv.mockReturnValue(true);
  state.readCorePage.mockImplementation(async (_path: string, query: string) => {
    const page = Number(new URLSearchParams(query).get("page") ?? 1);
    return corePage(page, 100, 3);
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("honest counts", () => {
  it("counts only the rows actually on screen", () => {
    // "Export" that says nothing and delivers 25 rows is the lie this exists
    // to avoid, so the option label is driven by this number.
    expect(previewRowCount(results(), SOURCE_IDS)).toBe(3);
  });

  it("ignores families that returned nothing to export", () => {
    // needsBranch / unauthorized / denied all contribute zero rows AND zero
    // total — a denied family must not inflate the promised row count.
    expect(exportRowEstimate(results(), SOURCE_IDS)).toEqual({ total: 3, capped: 3 });
  });

  it("caps the promised total at the export bound", () => {
    const estimate = exportRowEstimate(
      results({ parties: ready(50_000, 10, "party") }),
      SOURCE_IDS,
    );
    expect(estimate.total).toBe(50_000);
    expect(estimate.capped).toBe(MAX_EXPORT_ROWS);
  });
});

describe("useSearchExport", () => {
  it("writes the on-screen rows without touching the network", () => {
    const { result } = renderExport();

    act(() => result.current.exportPreview());

    expect(state.readCorePage).not.toHaveBeenCalled();
    expect(state.downloadCsv).toHaveBeenCalledTimes(1);
    const [fileName, csv] = state.downloadCsv.mock.calls[0];
    expect(String(fileName)).toMatch(/^mutakamel-search-\d{4}-\d{2}-\d{2}/u);
    expect(String(csv).split("\r\n").filter(Boolean)).toHaveLength(4);
  });

  it("names the family in every row so a merged file stays readable", () => {
    const { result } = renderExport();
    act(() => result.current.exportPreview());
    expect(String(state.downloadCsv.mock.calls[0][1])).toContain('"Party directory"');
  });

  it("walks the server's pages for the all-rows export", async () => {
    const { result } = renderExport({ parties: ready(250, 10, "party") });
    state.readCorePage.mockImplementation(async (_path: string, query: string) => {
      const page = Number(new URLSearchParams(query).get("page") ?? 1);
      return corePage(page, 100, 250);
    });

    act(() => result.current.exportAll());
    await waitFor(() => expect(result.current.isExporting).toBe(false));

    expect(state.readCorePage).toHaveBeenCalledTimes(3);
    expect(String(state.downloadCsv.mock.calls[0][1]).split("\r\n").filter(Boolean)).toHaveLength(
      251,
    );
    expect(result.current.truncatedAt).toBeNull();
  });

  it("never fetches a family the search did not resolve", async () => {
    // A `denied` opportunities section must not be re-asked as part of an
    // export; the refusal already happened.
    const { result } = renderExport();

    act(() => result.current.exportAll());
    await waitFor(() => expect(result.current.isExporting).toBe(false));

    expect(state.readCrmBody).not.toHaveBeenCalled();
  });

  it("reports a truncated file rather than presenting a partial one as complete", async () => {
    const huge = MAX_EXPORT_ROWS + 500;
    const { result } = renderExport({ parties: ready(huge, 10, "party") });
    state.readCorePage.mockImplementation(async (_path: string, query: string) => {
      const page = Number(new URLSearchParams(query).get("page") ?? 1);
      return corePage(page, 100, huge);
    });

    act(() => result.current.exportAll());
    await waitFor(() => expect(result.current.isExporting).toBe(false));

    expect(result.current.truncatedAt).toBe(MAX_EXPORT_ROWS);
  });

  it("surfaces a mid-walk failure and writes no file", async () => {
    const { result } = renderExport({ parties: ready(250, 10, "party") });
    state.readCorePage.mockRejectedValue(new Error("upstream failed"));

    act(() => result.current.exportAll());
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(state.downloadCsv).not.toHaveBeenCalled();
    expect(result.current.isExporting).toBe(false);
  });

  it("surfaces a browser that refused the download instead of failing silently", () => {
    state.downloadCsv.mockReturnValue(false);
    const { result } = renderExport();

    act(() => result.current.exportPreview());
    expect(result.current.error).toEqual({ status: 0 });

    act(() => result.current.dismissError());
    expect(result.current.error).toBeNull();
  });

  it("reports progress against the number of rows the user will actually get", async () => {
    const { result } = renderExport({ parties: ready(250, 10, "party") });
    state.readCorePage.mockImplementation(async (_path: string, query: string) => {
      const page = Number(new URLSearchParams(query).get("page") ?? 1);
      return corePage(page, 100, 250);
    });

    act(() => result.current.exportAll());
    await waitFor(() => expect(result.current.progress).not.toBeNull());
    expect(result.current.progress?.expected).toBeLessThanOrEqual(MAX_EXPORT_ROWS);

    await waitFor(() => expect(result.current.isExporting).toBe(false));
    expect(result.current.progress).toBeNull();
  });
});
