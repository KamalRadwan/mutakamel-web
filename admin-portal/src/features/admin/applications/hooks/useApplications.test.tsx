// @vitest-environment jsdom

import { StrictMode, type PropsWithChildren } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationView } from "../types";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";

const { listMock, updatePolicyMock, toastMock, locale } = vi.hoisted(() => ({
  listMock: vi.fn(),
  updatePolicyMock: vi.fn(),
  toastMock: { error: vi.fn(), success: vi.fn() },
  locale: { lang: "en" as "ar" | "en" },
}));

vi.mock("../api/applications.api", () => ({
  applicationsApi: { list: listMock, updateDatabasePolicy: updatePolicyMock },
}));
vi.mock("@/components/ui/ToastContext", () => ({ useToast: () => toastMock }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: locale.lang === "ar" ? ar : en }),
}));
vi.mock("@/shared/hooks/useIdempotency", () => ({
  useIdempotency: () => ({ getIdempotencyKey: vi.fn(), resetKey: vi.fn() }),
}));
vi.mock("./useApplicationRegistration", () => ({ useApplicationRegistration: () => ({}) }));
vi.mock("@/shared/api/normalized-api-error", () => ({
  normalizeApiError: (error: unknown) => error,
}));

import { applicationsApi } from "../api/applications.api";
import { useApplications } from "./useApplications";

type ListResponse = Awaited<ReturnType<typeof applicationsApi.list>>;

function deferred() {
  let resolve!: (value: ListResponse) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<ListResponse>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function response(key: string, page: number): ListResponse {
  return {
    // Only identity matters to the list hook; the API owns the full projection.
    data: [{ key } as ApplicationView],
    meta: { page, limit: 20, total: 35, totalPages: 2, hasNext: page === 1, hasPrev: page === 2 },
  };
}

describe("useApplications list request ownership", () => {
  beforeEach(() => {
    locale.lang = "en";
    listMock.mockReset();
    updatePolicyMock.mockReset();
    toastMock.error.mockReset();
    toastMock.success.mockReset();
  });
  afterEach(cleanup);

  it("keeps the latest filter/page rows and pagination when responses arrive in reverse order", async () => {
    const older = deferred();
    const latest = deferred();
    // Deliberately ignore AbortSignal to exercise the generation fence.
    listMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(latest.promise);
    const { result } = renderHook(() => useApplications());
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.setPublicationFilter("PUBLISHED");
      result.current.setPage(2);
    });
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    expect(listMock.mock.calls[0][1].aborted).toBe(true);
    expect(listMock.mock.calls[1][0]).toMatchObject({ publicationStatus: "PUBLISHED", page: 2 });

    const currentResponse = response("latest", 2);
    await act(async () => { latest.resolve(currentResponse); });
    await act(async () => { older.resolve(response("obsolete", 1)); });

    expect(result.current.applications).toEqual(currentResponse.data);
    expect(result.current.meta).toEqual(currentResponse.meta);
    expect(result.current.page).toBe(2);
    expect(result.current.publicationFilter).toBe("PUBLISHED");
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it.each(["resolve", "reject"] as const)("ignores stale %s and loading completion while the latest query is pending", async outcome => {
    const older = deferred();
    const latest = deferred();
    listMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(latest.promise);
    const { result } = renderHook(() => useApplications());
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));
    act(() => result.current.setSearch("new search"));
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));

    await act(async () => {
      if (outcome === "resolve") older.resolve(response("obsolete", 1));
      else older.reject(new Error("obsolete failure"));
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.applications).toEqual([]);
    expect(result.current.meta.total).toBe(0);
    expect(result.current.error).toBeNull();
    expect(toastMock.error).not.toHaveBeenCalled();

    await act(async () => { latest.resolve(response("current", 1)); });
    expect(result.current.isLoading).toBe(false);
  });

  it("does not surface an obsolete error after the latest query succeeds", async () => {
    const older = deferred();
    const latest = deferred();
    listMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(latest.promise);
    const { result } = renderHook(() => useApplications());
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));
    act(() => result.current.setLimit(50));
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    const currentResponse = response("current", 1);
    await act(async () => { latest.resolve(currentResponse); });
    await act(async () => { older.reject(new Error("obsolete failure")); });

    expect(result.current.applications).toEqual(currentResponse.data);
    expect(result.current.meta).toEqual(currentResponse.meta);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("preserves the latest error when an obsolete successful response arrives last", async () => {
    const older = deferred();
    const latest = deferred();
    listMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(latest.promise);
    const { result } = renderHook(() => useApplications());
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    await act(async () => { latest.reject(new Error("current failure")); });
    await act(async () => { older.resolve(response("obsolete", 1)); });

    expect(result.current.error).toBe("current failure");
    expect(result.current.applications).toEqual([]);
    expect(result.current.meta.total).toBe(0);
    expect(result.current.isLoading).toBe(false);
    expect(toastMock.error).toHaveBeenCalledExactlyOnceWith("Error", "current failure");
  });

  it("supersedes an in-flight request when refreshing the same query", async () => {
    const older = deferred();
    const latest = deferred();
    listMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(latest.promise);
    const { result } = renderHook(() => useApplications());
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));
    let refresh!: Promise<void>;
    act(() => { refresh = result.current.refresh(); });
    expect(listMock.mock.calls[0][1].aborted).toBe(true);
    const currentResponse = response("refreshed", 1);
    await act(async () => { latest.resolve(currentResponse); await refresh; });
    await act(async () => { older.resolve(response("obsolete", 1)); });
    expect(result.current.applications).toEqual(currentResponse.data);
    expect(result.current.meta).toEqual(currentResponse.meta);
    expect(result.current.isLoading).toBe(false);
  });

  it("skips disposed queued effects in StrictMode and cancels pending work on unmount", async () => {
    const pending = deferred();
    listMock.mockReturnValue(pending.promise);
    const wrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>;
    const { unmount } = renderHook(() => useApplications(), { wrapper });
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));
    const signal: AbortSignal = listMock.mock.calls[0][1];
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { pending.reject(new Error("late unmount failure")); });
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it.each(["ar", "en"] as const)("localizes database-policy success in %s", async (lang) => {
    locale.lang = lang;
    const dictionary = lang === "ar" ? ar : en;
    listMock.mockResolvedValue(response("crm", 1));
    const receipt = { accepted: true };
    updatePolicyMock.mockResolvedValue(receipt);
    const { result } = renderHook(() => useApplications());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      expect(await result.current.updateDatabasePolicy("crm", {
        expectedPolicyRevision: "1",
        rotationEnabled: true,
        reason: "Enable rotation",
      })).toBe(receipt);
    });

    expect(toastMock.success).toHaveBeenCalledExactlyOnceWith(
      dictionary.applications.successTitle,
      dictionary.applications.databasePolicyUpdated,
    );
  });

  it.each(["ar", "en"] as const)("localizes load and policy error titles in %s", async (lang) => {
    locale.lang = lang;
    const dictionary = lang === "ar" ? ar : en;
    const failure = new Error("Server error evidence");
    listMock.mockRejectedValue(failure);
    updatePolicyMock.mockRejectedValue(failure);
    const { result } = renderHook(() => useApplications());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(toastMock.error).toHaveBeenLastCalledWith(
      dictionary.applications.errorTitle, failure.message,
    );
    await act(async () => {
      await expect(result.current.updateDatabasePolicy("crm", {
        expectedPolicyRevision: "1",
        reason: "Update policy",
      })).rejects.toBe(failure);
    });
    expect(toastMock.error).toHaveBeenCalledTimes(2);
    expect(toastMock.error).toHaveBeenLastCalledWith(
      dictionary.applications.errorTitle, failure.message,
    );
  });
});
