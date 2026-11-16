// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TradeScopeChange } from "../../useTradeScope";
import { useQuotationScopeProtection } from "./useQuotationScopeProtection";

const mocks = vi.hoisted(() => ({ apply: vi.fn(), push: vi.fn(), register: vi.fn() }));
vi.mock("../../useTradeScope", () => ({ useOptionalTradeScope: () => ({
  applyContextChange: mocks.apply, registerContextGuard: mocks.register,
}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

let guard: (change: TradeScopeChange) => boolean;
const change: TradeScopeChange = { kind: "branch", value: "01890000-0000-7000-8000-000000000001" };
function options() { return { enabled: true, dirty: true, locked: false, blocked: false,
  save: vi.fn(async () => true), reset: vi.fn() }; }

beforeEach(() => {
  vi.clearAllMocks();
  mocks.register.mockImplementation((handler) => { guard = handler; return vi.fn(); });
});
afterEach(() => { cleanup(); document.body.innerHTML = ""; });

describe("quotation context and navigation protection", () => {
  it("keeps local entries until the user explicitly discards a requested context change", async () => {
    const input = options();
    const { result } = renderHook(() => useQuotationScopeProtection(input));
    act(() => { expect(guard(change)).toBe(false); });
    expect(result.current.pending).toEqual(change);
    expect(input.reset).not.toHaveBeenCalled();
    act(() => result.current.cancel());
    expect(mocks.apply).not.toHaveBeenCalled();
    act(() => { guard(change); });
    await act(() => result.current.confirm(false));
    expect(input.reset).toHaveBeenCalledOnce();
    expect(mocks.apply).toHaveBeenCalledWith(change);
  });

  it("does not change scope when saving the old context fails", async () => {
    const input = options(); input.save.mockResolvedValue(false);
    const { result } = renderHook(() => useQuotationScopeProtection(input));
    act(() => { guard(change); });
    await act(() => result.current.confirm(true));
    expect(input.save).toHaveBeenCalledOnce();
    expect(input.reset).not.toHaveBeenCalled();
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("fences scope and link navigation while an outcome is unresolved", () => {
    const input = { ...options(), blocked: true };
    const { result } = renderHook(() => useQuotationScopeProtection(input));
    act(() => { expect(guard(change)).toBe(false); });
    const anchor = document.createElement("a"); anchor.href = "/trade/quotations";
    document.body.append(anchor);
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    act(() => { anchor.dispatchEvent(click); });
    expect(click.defaultPrevented).toBe(true);
    expect(result.current.pending).toBeNull();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("reviews browser Back and resumes its exact history entry only after confirmation", async () => {
    const navigation = Object.assign(new EventTarget(), { traverseTo: vi.fn(() => ({
      committed: Promise.resolve(), finished: Promise.resolve(),
    })) });
    Object.defineProperty(window, "navigation", { value: navigation, configurable: true });
    const { result } = renderHook(() => useQuotationScopeProtection(options()));
    const event = Object.assign(new Event("navigate", { cancelable: true }), {
      navigationType: "traverse", hashChange: false,
      destination: { key: "previous-entry", url: new URL("/trade/quotations", window.location.href).href, sameDocument: true },
    });
    act(() => { navigation.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
    expect(navigation.traverseTo).not.toHaveBeenCalled();
    await act(() => result.current.confirm(false));
    expect(navigation.traverseTo).toHaveBeenCalledWith("previous-entry");
    Reflect.deleteProperty(window, "navigation");
  });
});
