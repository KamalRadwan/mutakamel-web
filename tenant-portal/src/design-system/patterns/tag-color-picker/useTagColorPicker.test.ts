// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TAG_COLOR_NONE, useTagColorPicker } from "./useTagColorPicker";

const blue = { backgroundColor: "#DBEAFE", textColor: "#1E40AF" };
afterEach(cleanup);

describe("visible tag color draft validity", () => {
  it("blocks stale-pair submission until both visible custom channels are valid", () => {
    const change = vi.fn(), validity = vi.fn();
    const { result } = renderHook(() => useTagColorPicker(blue, change, validity));
    act(() => result.current.handleChannelChange("backgroundColor", "#1D4"));
    expect(validity).toHaveBeenLastCalledWith(false);
    expect(change).not.toHaveBeenCalled();
    act(() => result.current.handleChannelChange("textColor", "#FFFFFF"));
    expect(validity).toHaveBeenLastCalledWith(false);
    expect(change).not.toHaveBeenCalled();
    expect(result.current.drafts.backgroundColor).toBe("#1D4");
    act(() => result.current.handleChannelChange("backgroundColor", "#1d4ed8"));
    expect(validity).toHaveBeenLastCalledWith(true);
    expect(change).toHaveBeenLastCalledWith({ backgroundColor: "#1D4ED8", textColor: "#FFFFFF" });
  });

  it("recovers from invalid text when the unchanged preset is selected", () => {
    const change = vi.fn(), validity = vi.fn();
    const { result } = renderHook(() => useTagColorPicker(blue, change, validity));
    act(() => result.current.handleChannelChange("textColor", "bad"));
    expect(result.current.radioValue).toBe("");
    act(() => result.current.handleRadioChange("blue"));
    expect(result.current.drafts).toEqual(blue);
    expect(validity).toHaveBeenLastCalledWith(true);
    expect(change).toHaveBeenLastCalledWith(blue);
  });

  it("No color clears invalid drafts without sending a half-color pair", () => {
    const change = vi.fn(), validity = vi.fn();
    const { result } = renderHook(() => useTagColorPicker(null, change, validity));
    act(() => result.current.handleChannelChange("backgroundColor", ""));
    expect(result.current.radioValue).toBe("");
    act(() => result.current.handleRadioChange(TAG_COLOR_NONE));
    expect(result.current.isDraftInvalid("backgroundColor")).toBe(false);
    expect(validity).toHaveBeenLastCalledWith(true);
    expect(change).toHaveBeenLastCalledWith(null);
  });

  it("synchronizes validity when the controlled value is replaced externally", () => {
    const change = vi.fn(), validity = vi.fn();
    const { result, rerender } = renderHook(({ value }) => useTagColorPicker(value, change, validity), { initialProps: { value: blue } });
    act(() => result.current.handleChannelChange("textColor", "#1"));
    expect(validity).toHaveBeenLastCalledWith(false);
    const pair = { backgroundColor: "#FEE2E2", textColor: "#991B1B" };
    rerender({ value: pair });
    expect(result.current.drafts).toEqual(pair);
    expect(validity).toHaveBeenLastCalledWith(true);
  });
});
