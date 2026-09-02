// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCustomFieldValues } from "./useCustomFieldValues";

const { get, post, scope } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  scope: vi.fn(),
}));

// The real module, with only its request surface replaced — `normalizeApiError`
// tests `error instanceof TenantApiClientError`, and a wholly synthetic module
// would take that class away with it.
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return {
    ...actual,
    axiosClient: {
      get: (...args: unknown[]) => get(...args) as unknown,
      post: (...args: unknown[]) => post(...args) as unknown,
    },
  };
});

vi.mock("@/hooks/useOrganizationScope", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/hooks/useOrganizationScope")>();
  return { ...actual, useOrganizationScopeHeaders: () => scope() as unknown };
});

const BRANCH = "0192f3a0-0000-7000-8000-000000000001";
const OWNER_A = "0192f3a0-0000-7000-8000-0000000000aa";
const OWNER_B = "0192f3a0-0000-7000-8000-0000000000bb";
const FIELD_A = "0192f3a0-0000-7000-8000-0000000000f1";
const FIELD_B = "0192f3a0-0000-7000-8000-0000000000f2";

const READY = { ready: true, headers: {}, gap: null };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function valuesFor(ownerId: string, fieldDefinitionId: string, value: unknown) {
  return {
    data: [
      { fieldDefinitionId, ownerType: "LEAD", ownerId, value },
    ],
  };
}

afterEach(() => {
  cleanup();
  get.mockReset();
  post.mockReset();
  scope.mockReset();
});

describe("custom-field values, owner races", () => {
  // Defect D5. Select record A, then record B before A answers. A used to land
  // last and replace what B had put on screen — and because `save` writes under
  // the ownerId the caller passes, the next Save wrote A's values onto B.
  it("never lets a late response for record A land under record B", async () => {
    scope.mockReturnValue(READY);
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    get.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useCustomFieldValues(BRANCH));

    await act(async () => {
      void result.current.load("LEAD", OWNER_A);
      void result.current.load("LEAD", OWNER_B);
    });

    // B answers first, then A — the ordering the old code could not survive.
    await act(async () => {
      second.resolve(valuesFor(OWNER_B, FIELD_B, "B's value"));
      first.resolve(valuesFor(OWNER_A, FIELD_A, "A's value"));
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(result.current.values).toEqual([
      { fieldDefinitionId: FIELD_B, ownerType: "LEAD", ownerId: OWNER_B, value: "B's value" },
    ]);
    // The superseded read is cancelled rather than merely ignored.
    const firstSignal = (get.mock.calls[0][1] as { signal: AbortSignal }).signal;
    expect(firstSignal.aborted).toBe(true);
  });

  // The third guard, and the only one that holds if an abort loses the race:
  // a body whose owner is not the owner asked about is not this screen's data,
  // whatever the request looked like.
  it("rejects a body carrying another record's owner", async () => {
    scope.mockReturnValue(READY);
    get.mockResolvedValue(valuesFor(OWNER_A, FIELD_A, "A's value"));

    const { result } = renderHook(() => useCustomFieldValues(BRANCH));
    await act(async () => {
      await result.current.load("LEAD", OWNER_B);
    });

    expect(result.current.values).toEqual([]);
    expect(result.current.hasLoaded).toBe(false);
    expect(result.current.loadError).not.toBeNull();
  });

  it("rejects a body whose ownerType is not the one asked about", async () => {
    scope.mockReturnValue(READY);
    get.mockResolvedValue({
      data: [
        { fieldDefinitionId: FIELD_A, ownerType: "OPPORTUNITY", ownerId: OWNER_A, value: 1 },
      ],
    });

    const { result } = renderHook(() => useCustomFieldValues(BRANCH));
    await act(async () => {
      await result.current.load("LEAD", OWNER_A);
    });

    expect(result.current.values).toEqual([]);
    expect(result.current.hasLoaded).toBe(false);
  });

  it("clears the panel and cancels the read in flight on reset", async () => {
    scope.mockReturnValue(READY);
    const pending = deferred<unknown>();
    get.mockReturnValue(pending.promise);

    const { result } = renderHook(() => useCustomFieldValues(BRANCH));
    await act(async () => {
      void result.current.load("LEAD", OWNER_A);
    });
    act(() => result.current.reset());
    await act(async () => {
      pending.resolve(valuesFor(OWNER_A, FIELD_A, "late"));
      await Promise.resolve();
    });

    expect(result.current.values).toEqual([]);
    expect((get.mock.calls[0][1] as { signal: AbortSignal }).signal.aborted).toBe(true);
  });

  // D4: an unresolved organization scope stops the request instead of sending
  // one with no headers for the Gateway to answer 400.
  it("does not send a read or a write when the scope never resolved", async () => {
    scope.mockReturnValue({ ready: false, headers: null, gap: "company-required" });

    const { result } = renderHook(() => useCustomFieldValues(BRANCH));
    await act(async () => {
      await result.current.load("LEAD", OWNER_A);
    });
    expect(get).not.toHaveBeenCalled();
    expect(result.current.loadError).toEqual({
      status: 0,
      code: "CRM_ORGANIZATION_SCOPE_UNRESOLVED",
    });

    let write: { ok: boolean } | undefined;
    await act(async () => {
      write = await result.current.save(
        { id: FIELD_A } as Parameters<typeof result.current.save>[0],
        "LEAD",
        OWNER_A,
        "x",
      );
    });
    expect(post).not.toHaveBeenCalled();
    expect(write?.ok).toBe(false);
  });
});
