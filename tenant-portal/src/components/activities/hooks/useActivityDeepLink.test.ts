// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useActivityDeepLink } from "./useActivityDeepLink";
const mocks = vi.hoisted(() => ({ params: new URLSearchParams(), authorized: true, replace: vi.fn(), detail: vi.fn(() => ({})) }));
vi.mock("next/navigation", () => ({ useSearchParams: () => mocks.params }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: {} }) }));
vi.mock("@/lib/auth/permission-scope", () => ({ can: () => mocks.authorized }));
vi.mock("@/design-system", () => ({ replaceSearchParams: mocks.replace }));
vi.mock("./useActivityDetail", () => ({ useActivityDetail: mocks.detail }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.authorized = true; });
describe("activity deep links", () => {
  it("loads the linked activity independently of calendar filters and removes only its query key on close", () => {
    const id = "01a1a837-8914-772c-8a5f-fa70a9028b74";
    mocks.params = new URLSearchParams({ activityId: id, q: "unrelated filter" });
    const hook = renderHook(useActivityDeepLink);
    expect(mocks.detail).toHaveBeenCalledWith(id);
    hook.result.current.close();
    expect(mocks.replace).toHaveBeenCalledWith({ activityId: null });
  });
  it("never requests an invalid id or an activity without read access", () => {
    mocks.params = new URLSearchParams({ activityId: "bad-id" });
    const hook = renderHook(useActivityDeepLink);
    expect(hook.result.current.id).toBeNull();
    mocks.params = new URLSearchParams({ activityId: "01a1a837-8914-772c-8a5f-fa70a9028b74" });
    mocks.authorized = false;
    hook.rerender();
    expect(mocks.detail).toHaveBeenLastCalledWith(null);
  });
});
