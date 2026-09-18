// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import { useCrmAttachments } from "./useCrmAttachments";

vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/axiosClient")>(),
  axiosClient: { get: vi.fn() },
}));

const source = {
  branchId: "01900100-0000-7000-8000-000000000001",
  sourceType: "LEAD" as const,
  sourceId: "01900100-0000-7000-8000-000000000002",
};
const attachment = {
  ...source,
  id: "01900100-0000-7000-8000-000000000003",
  fileName: "proposal.pdf", mimeType: "application/pdf", sizeBytes: "123456",
  uploadedByUserId: null, createdAt: "2026-09-14T10:00:00.000Z",
};
const response = {
  data: {
    items: [attachment], total: 1, page: 1, limit: 50,
    totalPages: 1, hasNext: false, hasPrev: false,
  },
  status: 200, statusText: "OK", headers: new Headers(),
};

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

describe("loading the record attachments panel", () => {
  it("shows persisted attachments without a load error", async () => {
    vi.mocked(axiosClient.get).mockResolvedValue(response);
    const { result } = renderHook(() => useCrmAttachments(source));

    await waitFor(() => expect(result.current.attachments).toEqual([
      { ...attachment, sizeBytes: 123456 },
    ]));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.loadError).toBeNull();
  });

  it("reports unreadable response data without claiming the server is unreachable", async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ ...response, data: { items: null } });
    const { result } = renderHook(() => useCrmAttachments(source));

    await waitFor(() => expect(result.current.loadError?.status).toBe(200));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.attachments).toEqual([]);
  });

  it("reports an actual network failure as offline", async () => {
    vi.mocked(axiosClient.get).mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useCrmAttachments(source));

    await waitFor(() => expect(result.current.loadError?.status).toBe(0));
  });

  it("preserves forbidden responses for the permission gate", async () => {
    vi.mocked(axiosClient.get).mockRejectedValue(new TenantApiClientError("Forbidden", {
      status: 403, statusText: "Forbidden", headers: new Headers(), data: {},
    }));
    const { result } = renderHook(() => useCrmAttachments(source));

    await waitFor(() => expect(result.current.loadError?.status).toBe(403));
  });
});
