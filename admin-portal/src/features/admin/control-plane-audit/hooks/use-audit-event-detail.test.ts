// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getByIdMock } = vi.hoisted(() => ({ getByIdMock: vi.fn() }));

vi.mock("../api/control-plane-audit-api", () => ({
  controlPlaneAuditApi: { getById: getByIdMock },
}));

import { useAuditEventDetail } from "./use-audit-event-detail";

const DETAIL = {
  id: "019f0000-0000-7000-8000-000000000001",
  before: { status: "ACTIVE" },
  after: { status: "SUSPENDED" },
  diff: [],
  metadata: null,
};

describe("useAuditEventDetail", () => {
  beforeEach(() => {
    getByIdMock.mockReset();
  });

  it("stays idle until load is called", () => {
    const { result } = renderHook(() => useAuditEventDetail(DETAIL.id));

    expect(result.current.status).toBe("IDLE");
    expect(getByIdMock).not.toHaveBeenCalled();
  });

  it("fetches once and exposes the resolved detail", async () => {
    getByIdMock.mockResolvedValue(DETAIL);
    const { result } = renderHook(() => useAuditEventDetail(DETAIL.id));

    act(() => result.current.load());
    expect(result.current.status).toBe("LOADING");

    await waitFor(() => expect(result.current.status).toBe("READY"));
    expect(result.current.data).toEqual(DETAIL);
    expect(getByIdMock).toHaveBeenCalledWith(DETAIL.id);
  });

  it("does not refetch on repeated load calls", async () => {
    getByIdMock.mockResolvedValue(DETAIL);
    const { result } = renderHook(() => useAuditEventDetail(DETAIL.id));

    act(() => result.current.load());
    await waitFor(() => expect(result.current.status).toBe("READY"));
    act(() => result.current.load());
    act(() => result.current.load());

    expect(getByIdMock).toHaveBeenCalledOnce();
  });

  it("surfaces a failure and allows retrying", async () => {
    getByIdMock.mockRejectedValueOnce(new Error("network down"));
    const { result } = renderHook(() => useAuditEventDetail(DETAIL.id));

    act(() => result.current.load());
    await waitFor(() => expect(result.current.status).toBe("UNAVAILABLE"));
    expect(result.current.error).toBeTruthy();

    getByIdMock.mockResolvedValueOnce(DETAIL);
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe("READY"));
    expect(getByIdMock).toHaveBeenCalledTimes(2);
  });
});
