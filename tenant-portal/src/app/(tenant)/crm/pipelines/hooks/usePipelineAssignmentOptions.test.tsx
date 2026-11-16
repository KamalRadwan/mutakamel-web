// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { usePipelineAssignmentOptions } from "./usePipelineAssignmentOptions";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { id: "options-test", permissions: ["crm.pipelines.manage"] } }) }));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { get } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("keeps the latest search result when an older request finishes later", async () => {
  let resolveOld: (value: unknown) => void = () => {};
  get.mockImplementation((url: string) => {
    if (url.includes("search=old")) return new Promise((resolve) => { resolveOld = resolve; });
    return Promise.resolve({ status: 200, data: { users: url.includes("search=new") ? [{ id: "new", label: "New match", status: "ACTIVE" }] : [], teams: [] } });
  });
  const { result } = renderHook(() => usePipelineAssignmentOptions(true));
  await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
  act(() => result.current.searchOptions("old"));
  act(() => result.current.searchOptions("new"));
  await waitFor(() => expect(result.current.users[0]?.label).toBe("New match"));
  await act(async () => { resolveOld({ status: 200, data: { users: [{ id: "old", label: "Old match", status: "ACTIVE" }], teams: [] } }); });
  expect(result.current.users[0]?.label).toBe("New match");
});
