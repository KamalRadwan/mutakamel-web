// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listMock, toastMock, i18nMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
  i18nMock: { lang: "en" },
}));
vi.mock("../api/database-servers.api", () => ({
  databaseServersApi: { list: listMock },
}));
vi.mock("@/components/ui/ToastContext", () => ({
  useToast: () => toastMock,
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => i18nMock }));
vi.mock("@/shared/hooks/useIdempotency", () => ({
  useIdempotency: () => ({ getIdempotencyKey: () => "key", resetKey: vi.fn() }),
}));

import { useDatabaseServers } from "./useDatabaseServers";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

describe("useDatabaseServers query ownership", () => {
  beforeEach(() => listMock.mockReset());

  it("does not expose a delayed current row or its dialogs after switching to deleted", async () => {
    const current = deferred<unknown>();
    const deleted = deferred<unknown>();
    listMock
      .mockReturnValueOnce(current.promise)
      .mockReturnValueOnce(deleted.promise);
    const { result } = renderHook(() => useDatabaseServers());
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));

    act(() => result.current.setDeletionFilter("DELETED"));
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    await act(async () => deleted.resolve({
      data: [{ id: "deleted", name: "Deleted", status: "OFFLINE", currentTenants: 0, deletedAt: "2026-08-05T00:00:00.000Z" }],
      meta: { total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    }));
    await waitFor(() => expect(result.current.servers.map((row) => row.id)).toEqual(["deleted"]));
    act(() => result.current.openDestroy(result.current.servers[0]));
    expect(result.current.serverPendingDestroy?.id).toBe("deleted");

    await act(async () => current.resolve({
      data: [{ id: "current", name: "Current", status: "ACTIVE", currentTenants: 1, deletedAt: null }],
      meta: { total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    }));
    expect(result.current.servers.map((row) => row.id)).toEqual(["deleted"]);
    expect(result.current.serverPendingDestroy?.id).toBe("deleted");
  });
});
