// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfiguredWorkerKey } from "../contract";
import { useWorkerEventKeys } from "./useWorkerEventKeys";

const api = vi.hoisted(() => ({ list: vi.fn(), configured: vi.fn(), adopt: vi.fn() }));
vi.mock("../api", () => ({ workerEventKeysApi: api }));
const current: ConfiguredWorkerKey = { trustSlot: "ACTIVE", issuer: "worker", keyId: "worker.1", algorithm: "RS256", publicKeyFingerprint: "a".repeat(64) };
const record = { ...current, verificationKeyId: "019f0000-0000-7000-8000-000000000001", status: "ACTIVE", revision: 1, registeredAt: "2026-09-29T00:00:00Z" };
const failure = (status: number, code: string) => ({ response: { status, data: { success: false, errorCode: code, message: "Failed" } } });

describe("automatic Worker key registration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.list.mockResolvedValue([]);
    api.configured.mockResolvedValue([current]);
    api.adopt.mockResolvedValue(record);
  });

  it("requires read permission before any request or registration", async () => {
    const { result, unmount } = renderHook(() => useWorkerEventKeys(false, true));
    act(() => result.current.review());
    await act(() => result.current.confirm());
    expect(api.list).not.toHaveBeenCalled();
    expect(api.configured).not.toHaveBeenCalled();
    expect(api.adopt).not.toHaveBeenCalled();
    unmount();
  });

  it("keeps readers read-only", async () => {
    const { result, unmount } = renderHook(() => useWorkerEventKeys(true, false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.review());
    expect(result.current.confirmationOpen).toBe(false);
    await act(() => result.current.confirm());
    expect(api.adopt).not.toHaveBeenCalled();
    unmount();
  });

  it("prefills an exact server identity and writes only after confirmation", async () => {
    const { result, unmount } = renderHook(() => useWorkerEventKeys(true, true));
    await waitFor(() => expect(result.current.currentKey).toEqual(current));
    act(() => result.current.review());
    expect(api.adopt).not.toHaveBeenCalled();
    expect(result.current.intent?.dto).toEqual({ trustSlot: "ACTIVE", expectedIssuer: "worker", expectedKeyId: "worker.1", expectedPublicKeyFingerprint: current.publicKeyFingerprint });
    await act(() => result.current.confirm());
    expect(api.adopt).toHaveBeenCalledTimes(1);
    expect(result.current.receipt).toEqual(record);
    unmount();
  });

  it("reuses the exact command and identity after an ambiguous response, even if configuration changes", async () => {
    api.adopt.mockRejectedValueOnce(new Error("connection lost"));
    const { result, unmount } = renderHook(() => useWorkerEventKeys(true, true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.review());
    await act(() => result.current.confirm());
    expect(result.current.unknown).toBe(true);
    api.configured.mockResolvedValue([{ ...current, keyId: "worker.2" }]);
    await act(() => result.current.refresh());
    act(() => result.current.review());
    await act(() => result.current.confirm());
    expect(api.adopt.mock.calls[1]).toEqual(api.adopt.mock.calls[0]);
    expect(result.current.unknown).toBe(false);
    unmount();
  });

  it("refreshes a changed configuration after a definitive mismatch and requires a fresh confirmation", async () => {
    api.adopt.mockRejectedValueOnce(failure(409, "WORKER_EVENT_VERIFICATION_KEY_CONFIG_MISMATCH"));
    const { result, unmount } = renderHook(() => useWorkerEventKeys(true, true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.review());
    const original = result.current.intent?.key;
    api.configured.mockResolvedValue([{ ...current, keyId: "worker.2" }]);
    await act(() => result.current.confirm());
    await waitFor(() => expect(result.current.currentKey?.keyId).toBe("worker.2"));
    expect(result.current.confirmationOpen).toBe(false);
    act(() => result.current.review());
    expect(result.current.intent?.key).not.toBe(original);
    expect(result.current.intent?.dto.expectedKeyId).toBe("worker.2");
    unmount();
  });

  it("keeps forbidden registry errors distinct from an empty registry", async () => {
    api.list.mockRejectedValue(failure(403, "FORBIDDEN"));
    const { result, unmount } = renderHook(() => useWorkerEventKeys(true, true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError?.httpStatus).toBe(403);
    expect(result.current.currentKey).toEqual(current);
    unmount();
  });

  it("does not offer registration using a stale identity after a failed refresh", async () => {
    const { result, unmount } = renderHook(() => useWorkerEventKeys(true, true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    api.configured.mockRejectedValue(failure(503, "WORKER_EVENT_VERIFICATION_TRUST_UNAVAILABLE"));
    await act(() => result.current.refresh());
    act(() => result.current.review());
    expect(result.current.currentKey).toBeNull();
    expect(result.current.confirmationOpen).toBe(false);
    unmount();
  });
});
