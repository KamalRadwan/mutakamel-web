// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { api, mutateMock, toastMock } = vi.hoisted(() => ({
  api: { get: vi.fn(), listApplications: vi.fn(), getHistory: vi.fn() },
  mutateMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("../api/database-servers.api", () => ({ databaseServersApi: api }));
vi.mock("@/components/ui/ToastContext", () => ({
  useToast: () => toastMock,
}));
vi.mock("@/shared/hooks/useIdempotency", () => ({
  useIdempotency: () => ({ getIdempotencyKey: () => "key", resetKey: vi.fn() }),
}));
vi.mock("@/shared/hooks/useActionMutation", () => ({
  useActionMutation: () => ({ mutate: mutateMock, isMutating: false }),
}));

import { useDatabaseServerDetail } from "./useDatabaseServerDetail";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe("useDatabaseServerDetail ownership", () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    mutateMock.mockReset();
    mutateMock.mockResolvedValue(undefined);
    api.listApplications.mockResolvedValue([]);
    api.getHistory.mockResolvedValue([]);
  });

  it("never commits server A after route identity changes to B", async () => {
    const a = deferred<unknown>();
    const b = deferred<unknown>();
    api.get.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { result, rerender } = renderHook(
      ({ id }) => useDatabaseServerDetail(id),
      { initialProps: { id: "server-a" } },
    );
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("server-a", expect.any(AbortSignal)));
    rerender({ id: "server-b" });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("server-b", expect.any(AbortSignal)));

    await act(async () => b.resolve({ id: "server-b", name: "B" }));
    await waitFor(() => expect(result.current.server).toMatchObject({ id: "server-b" }));
    await act(async () => a.resolve({ id: "server-a", name: "A" }));
    expect(result.current.server).toMatchObject({ id: "server-b" });
    expect(result.current.loadedServerId).toBe("server-b");
  });

  it("does not let a server A mutation reconciliation abort server B loading", async () => {
    const b = deferred<unknown>();
    api.get
      .mockResolvedValueOnce({ id: "server-a", name: "A" })
      .mockReturnValueOnce(b.promise);
    const { result, rerender } = renderHook(
      ({ id }) => useDatabaseServerDetail(id),
      { initialProps: { id: "server-a" } },
    );
    await waitFor(() =>
      expect(result.current.loadedServerId).toBe("server-a"),
    );

    await act(async () => {
      await result.current.activateServer();
    });
    const options = mutateMock.mock.calls.at(-1)?.[2] as {
      onSuccess?: (result: unknown) => void | Promise<void>;
    };

    rerender({ id: "server-b" });
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("server-b", expect.any(AbortSignal)),
    );
    const bSignal = api.get.mock.calls.at(-1)?.[1] as AbortSignal;

    await act(async () => {
      await options.onSuccess?.(undefined);
    });

    expect(api.get).toHaveBeenCalledTimes(2);
    expect(bSignal.aborted).toBe(false);
    await act(async () => b.resolve({ id: "server-b", name: "B" }));
    await waitFor(() =>
      expect(result.current.server).toMatchObject({ id: "server-b" }),
    );
  });
});
