// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseLeadTagArray, useCreateLeadTags } from "./useCreateLeadTags";

const { auth, get } = vi.hoisted(() => ({ auth: vi.fn(), get: vi.fn() }));

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth() as unknown }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { ...actual.axiosClient, get } };
});

const TAG = "01900100-0000-7000-8000-000000000004";
const TAG_VIEW = {
  id: TAG,
  name: "Priority",
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
};

function response(data: unknown) {
  return { data, status: 200, statusText: "OK", headers: new Headers() };
}

beforeEach(() => {
  auth.mockReturnValue({ user: { permissions: ["crm.tags.read"] } });
  get.mockResolvedValue(response([TAG_VIEW]));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("parseLeadTagArray", () => {
  it("accepts the raw CRM catalogue and rejects ambiguous ids", () => {
    expect(parseLeadTagArray([TAG_VIEW])).toEqual([
      { id: TAG, name: "Priority", color: null },
    ]);
    expect(() => parseLeadTagArray([TAG_VIEW, TAG_VIEW])).toThrow();
    expect(() =>
      parseLeadTagArray([TAG_VIEW, { ...TAG_VIEW, id: TAG.toUpperCase() }]),
    ).toThrow();
  });

  it("rejects envelopes, oversized catalogues and names beyond the DTO limit", () => {
    expect(() => parseLeadTagArray({ data: [TAG_VIEW] })).toThrow();
    expect(() => parseLeadTagArray(Array.from({ length: 501 }, () => TAG_VIEW))).toThrow();
    expect(() => parseLeadTagArray([{ ...TAG_VIEW, name: "x".repeat(61) }])).toThrow();
  });

  it("measures the name limit by Unicode code point", () => {
    expect(parseLeadTagArray([{ ...TAG_VIEW, name: "😀".repeat(40) }])).toHaveLength(1);
    expect(() => parseLeadTagArray([{ ...TAG_VIEW, name: "😀".repeat(61) }])).toThrow();
  });
});

describe("useCreateLeadTags", () => {
  it("loads the catalogue only while the modal is open with exact tag-read", async () => {
    const { result } = renderHook(() => useCreateLeadTags(true));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.canRead).toBe(true);
    expect(get).toHaveBeenCalledWith(
      "/api/tenant/crm/v1/tags",
      expect.objectContaining({ cache: "no-store", maxResponseBytes: 256 * 1024 }),
    );
  });

  it("does not read without crm.tags.read", () => {
    auth.mockReturnValue({ user: { permissions: [] } });
    const { result } = renderHook(() => useCreateLeadTags(true));
    expect(result.current.canRead).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });

  it("does not treat a scoped-looking variant as the exact catalogue permission", () => {
    auth.mockReturnValue({ user: { permissions: ["crm.tags.read.all"] } });
    const { result } = renderHook(() => useCreateLeadTags(true));
    expect(result.current.canRead).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });

  it("does not read while the modal is closed", () => {
    renderHook(() => useCreateLeadTags(false));
    expect(get).not.toHaveBeenCalled();
  });

  it("retains validated tag names when a later catalogue read degrades", async () => {
    get.mockResolvedValueOnce(response([TAG_VIEW])).mockRejectedValueOnce(new Error("offline"));
    const view = renderHook(
      ({ enabled }: { enabled: boolean }) => useCreateLeadTags(enabled),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(view.result.current.items).toHaveLength(1));
    view.rerender({ enabled: false });
    view.rerender({ enabled: true });
    await waitFor(() => expect(view.result.current.degraded).toBe(true));
    expect(view.result.current.items[0]?.name).toBe("Priority");
  });
});
