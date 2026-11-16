// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useWidgetHistory } from "./useWidgetHistory";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (original) => ({
  ...await original<typeof import("@/lib/api/axiosClient")>(),
  axiosClient: { get },
}));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("keeps history rows unique when reopening a paged version list", async () => {
  const widgetId = "01900300-0000-7000-8000-0000000000a1";
  const head = { widgetId, widgetRevision: 4, activeVersionNumber: 3 };
  const version = (versionNumber: number) => ({ versionNumber, name: "Converted leads",
    publishedAt: "2026-11-10T08:00:00.000Z", provenance: "USER_PUBLISH" });
  get.mockImplementation(async (path: string) => ({
    status: 200,
    data: path.includes("beforeVersion=3") ? { ...head, items: [version(2), version(1)], nextBeforeVersion: null }
      : { ...head, items: [version(3)], nextBeforeVersion: 3 },
  }));
  const anchor = { key: "widget-head-4", revision: 4, activeVersion: 3 };
  const { result, rerender } = renderHook(({ open }) => useWidgetHistory(widgetId, open ? anchor : undefined),
    { initialProps: { open: true } });
  await waitFor(() => expect(result.current.items).toHaveLength(1));
  await act(async () => result.current.loadMore());
  expect(result.current.items.map((entry) => entry.versionNumber)).toEqual([3, 2, 1]);
  rerender({ open: false });
  await act(async () => rerender({ open: true }));
  expect(get).toHaveBeenCalledTimes(3);
  expect(result.current.items.map((entry) => entry.versionNumber)).toEqual([3, 2, 1]);
});
