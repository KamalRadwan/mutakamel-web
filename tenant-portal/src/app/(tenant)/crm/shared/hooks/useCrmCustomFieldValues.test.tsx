// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCrmCustomFieldValues } from "./useCrmCustomFieldValues";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/axiosClient")>();
  return { ...actual, axiosClient: { get } };
});

const BRANCH = "01950000-0000-7000-8000-000000000001";
const OWNER = "01950000-0000-7000-8000-000000000009";
const FIELD = "01950000-0000-7000-8000-000000000088";
const definition = {
  id: FIELD, ownerType: "LEAD", fieldKey: "fleet", nameAr: "الأسطول",
  nameEn: "Fleet", type: "TEXT", options: [], isActive: true, sortOrder: 1,
};

afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("useCrmCustomFieldValues read safety", () => {
  it.each(["request", "parsing"])("exposes a %s failure separately and recovers on reload", async (failure) => {
    get.mockResolvedValueOnce({ data: [definition] });
    if (failure === "request") get.mockRejectedValueOnce(new Error("500"));
    else get.mockResolvedValueOnce({ data: { invalid: true } });
    const { result } = renderHook(() => useCrmCustomFieldValues(BRANCH, "LEAD", OWNER));
    await waitFor(() => expect(result.current.valuesError).not.toBeNull());
    expect(result.current.error).toBeNull();
    expect(result.current.valuesLoaded).toBe(false);
    expect(result.current.entries).toEqual([{ definition, value: null }]);

    const value = { id: "01950000-0000-7000-8000-000000000089", fieldDefinitionId: FIELD, ownerType: "LEAD", ownerId: OWNER, value: "120 Trucks" };
    get.mockResolvedValueOnce({ data: [definition] }).mockResolvedValueOnce({ data: [value] });
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.valuesLoaded).toBe(true));
    expect(result.current.valuesError).toBeNull();
    expect(result.current.entries[0]?.value).toEqual(value);
  });

  it("distinguishes a successful empty values list from failure", async () => {
    get.mockResolvedValueOnce({ data: [definition] }).mockResolvedValueOnce({ data: [] });
    const { result } = renderHook(() => useCrmCustomFieldValues(BRANCH, "LEAD", OWNER));
    await waitFor(() => expect(result.current.valuesLoaded).toBe(true));
    expect(result.current.valuesError).toBeNull();
    expect(result.current.entries[0]?.value).toBeNull();
  });
});
