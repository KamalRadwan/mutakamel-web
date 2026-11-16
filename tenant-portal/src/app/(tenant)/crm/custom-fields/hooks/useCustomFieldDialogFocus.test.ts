// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCustomFieldDialogFocus } from "./useCustomFieldDialogFocus";

let frames: Map<number, FrameRequestCallback>;
let sequence: number;
beforeEach(() => {
  frames = new Map(); sequence = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++sequence, callback); return sequence; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => { frames.delete(id); });
});
afterEach(() => { cleanup(); document.body.innerHTML = ""; vi.unstubAllGlobals(); });

function button() {
  const element = document.createElement("button"); document.body.append(element);
  return element;
}
function dialog(role = "dialog") {
  const element = document.createElement("div"); element.setAttribute("role", role);
  const input = document.createElement("input"); element.append(input); document.body.append(element); input.focus();
  return element;
}
async function flushFrames() {
  await act(async () => { await Promise.resolve(); });
  act(() => { const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback(0)); });
}
function setup() {
  return renderHook(({ open }) => useCustomFieldDialogFocus(open), { initialProps: { open: false } });
}

describe("custom-field dialog focus return", () => {
  it("waits for exit animation to remove the dialog before restoring its opener", async () => {
    const { result, rerender } = setup();
    const opener = button(); opener.focus(); act(() => result.current.capture());
    rerender({ open: true }); const closing = dialog(); rerender({ open: false });
    await flushFrames();
    expect(closing.contains(document.activeElement)).toBe(true);
    closing.remove(); await flushFrames();
    expect(document.activeElement).toBe(opener);
  });

  it.each(["removed", "disabled"])("uses the search fallback when the opener is %s", async (state) => {
    const { result, rerender } = setup();
    const opener = button(); opener.focus(); act(() => result.current.capture());
    const search = document.createElement("input"); document.body.append(search);
    act(() => result.current.setFallbackElement(search));
    rerender({ open: true }); const closing = dialog();
    if (state === "removed") opener.remove(); else opener.disabled = true;
    rerender({ open: false }); closing.remove(); await flushFrames();
    expect(document.activeElement).toBe(search);
  });

  it("preserves the original opener when a nested discard is cancelled", async () => {
    const { result, rerender } = setup();
    const opener = button(); opener.focus(); act(() => result.current.capture());
    rerender({ open: true }); const outer = dialog(); const confirmation = dialog("alertdialog");
    act(() => result.current.capture());
    confirmation.remove(); (outer.firstElementChild as HTMLElement).focus();
    await flushFrames();
    expect(outer.contains(document.activeElement)).toBe(true);
    rerender({ open: false }); outer.remove(); await flushFrames();
    expect(document.activeElement).toBe(opener);
  });

  it("waits for a remaining discard confirmation after the parent dialog exits", async () => {
    const { result, rerender } = setup();
    const opener = button(); opener.focus(); act(() => result.current.capture());
    rerender({ open: true }); const outer = dialog(); const confirmation = dialog("alertdialog");
    rerender({ open: false }); outer.remove(); await flushFrames();
    expect(confirmation.contains(document.activeElement)).toBe(true);
    confirmation.remove(); await flushFrames();
    expect(document.activeElement).toBe(opener);
  });

  it("does not steal intentional focus on another control", async () => {
    const { result, rerender } = setup();
    const opener = button(); opener.focus(); act(() => result.current.capture());
    rerender({ open: true }); const closing = dialog(); rerender({ open: false }); closing.remove();
    const other = button(); other.focus(); await flushFrames();
    expect(document.activeElement).toBe(other);
  });

  it("cancels pending restoration when the actor-scoped workspace unmounts", async () => {
    const { result, rerender, unmount } = setup();
    const opener = button(); opener.focus(); act(() => result.current.capture());
    rerender({ open: true }); const closing = dialog(); rerender({ open: false }); closing.remove();
    await act(async () => { await Promise.resolve(); });
    unmount(); await flushFrames();
    expect(document.activeElement).not.toBe(opener);
  });

  it("cancels queued focus return when another feature dialog is opened", async () => {
    const { result, rerender } = setup();
    const first = button(); first.focus(); act(() => result.current.capture());
    rerender({ open: true }); const closing = dialog(); rerender({ open: false }); closing.remove();
    await act(async () => { await Promise.resolve(); });
    const second = button(); second.focus(); act(() => result.current.capture());
    rerender({ open: true }); const opened = dialog(); await flushFrames();
    expect(opened.contains(document.activeElement)).toBe(true);
    rerender({ open: false }); opened.remove(); await flushFrames();
    expect(document.activeElement).toBe(second);
  });
});
