// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { useCrmRecordOptions, type CrmRecordSourceType } from "./useCrmRecordOptions";

vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { get: vi.fn() } }));

const BRANCH = "01900000-0000-7000-8000-000000000001";
const OTHER_BRANCH = "01900000-0000-7000-8000-000000000002";
const RECORD = "01900000-0000-7000-8000-000000000003";
const oldOptions = [{ value: RECORD, label: "Previous record" }];
const response = (label: string) => ({
  data: { items: [{ id: RECORD, displayName: label, title: label }] },
  status: 200,
  statusText: "OK",
  headers: new Headers(),
});

beforeEach(() => vi.mocked(axiosClient.get).mockReset());
afterEach(cleanup);

describe("useCrmRecordOptions scope changes", () => {
  it.each([
    { sourceType: "LEAD" as CrmRecordSourceType, branchId: OTHER_BRANCH },
    { sourceType: "OPPORTUNITY" as CrmRecordSourceType, branchId: BRANCH },
  ])("clears previous options while loading $sourceType in $branchId", async (nextScope) => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce(response("Previous record"));
    let resolveNext!: (value: ReturnType<typeof response>) => void;
    vi.mocked(axiosClient.get).mockImplementationOnce(() => new Promise((resolve) => {
      resolveNext = resolve;
    }));
    const { result, rerender } = renderHook(
      ({ sourceType, branchId }) => useCrmRecordOptions(sourceType, branchId),
      { initialProps: { sourceType: "LEAD" as CrmRecordSourceType, branchId: BRANCH } },
    );
    await waitFor(() => expect(result.current.options).toEqual(oldOptions));

    rerender(nextScope);
    await waitFor(() => expect(axiosClient.get).toHaveBeenCalledTimes(2));
    expect(result.current.options).toEqual([]);
    expect(result.current.isLoading).toBe(true);

    await act(async () => resolveNext(response("New record")));
    expect(result.current.options).toEqual([{ value: RECORD, label: "New record" }]);
    expect(result.current.isLoading).toBe(false);
  });

  it("keeps previous options while a text-only search is pending", async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce(response("Previous record"));
    let resolveNext!: (value: ReturnType<typeof response>) => void;
    vi.mocked(axiosClient.get).mockImplementationOnce(() => new Promise((resolve) => {
      resolveNext = resolve;
    }));
    const { result } = renderHook(() => useCrmRecordOptions("LEAD", BRANCH));
    await waitFor(() => expect(result.current.options).toEqual(oldOptions));

    act(() => result.current.search("new"));
    expect(result.current.options).toEqual(oldOptions);
    expect(result.current.isLoading).toBe(true);
    expect(vi.mocked(axiosClient.get).mock.calls[1][0]).toContain("search=new");

    await act(async () => resolveNext(response("New record")));
    expect(result.current.options).toEqual([{ value: RECORD, label: "New record" }]);
    expect(result.current.isLoading).toBe(false);
  });
});
