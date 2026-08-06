// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock("../api/storage-servers.api", () => ({
  storageServersApi: { get: getMock },
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "admin" }, isLoading: false }),
}));
vi.mock("@/lib/auth/rbac", () => ({
  adminCan: () => true,
  adminCanAll: () => true,
  ADMIN_RBAC_CRITICAL: {
    STORAGE_SERVERS_UPDATE: ["update"],
    STORAGE_SERVERS_DELETE: ["delete"],
  },
}));
vi.mock("@/shared/hooks/useIdempotency", () => ({
  useIdempotency: () => ({ getIdempotencyKey: () => "key", resetKey: vi.fn() }),
}));

import { useStorageServerDetail } from "./useStorageServerDetail";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe("useStorageServerDetail ownership", () => {
  beforeEach(() => getMock.mockReset());

  it("clears A immediately and ignores it when it resolves after B", async () => {
    const a = deferred<unknown>();
    const b = deferred<unknown>();
    getMock.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { result, rerender } = renderHook(
      ({ id }) => useStorageServerDetail(id),
      { initialProps: { id: "storage-a" } },
    );
    await waitFor(() => expect(getMock).toHaveBeenCalledWith("storage-a", expect.any(AbortSignal)));
    rerender({ id: "storage-b" });
    expect(result.current.server).toBeNull();
    await waitFor(() => expect(getMock).toHaveBeenCalledWith("storage-b", expect.any(AbortSignal)));

    await act(async () => b.resolve({ id: "storage-b", name: "B" }));
    await waitFor(() => expect(result.current.server).toMatchObject({ id: "storage-b" }));
    await act(async () => a.resolve({ id: "storage-a", name: "A" }));
    expect(result.current.server).toMatchObject({ id: "storage-b" });
    expect(result.current.loadedServerId).toBe("storage-b");
  });
});
