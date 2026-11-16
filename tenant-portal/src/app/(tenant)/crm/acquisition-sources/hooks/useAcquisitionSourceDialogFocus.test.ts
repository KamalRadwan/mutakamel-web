// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAcquisitionSourceDialogFocus } from "./useAcquisitionSourceDialogFocus";

let frames: Map<number, FrameRequestCallback>;
let sequence: number;
beforeEach(() => {
  frames = new Map(); sequence = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++sequence, callback); return sequence; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => { frames.delete(id); });
});
afterEach(() => { cleanup(); document.body.innerHTML = ""; vi.unstubAllGlobals(); });
function button(id?: string) {
  const element = document.createElement("button");
  if (id) element.id = id;
  document.body.append(element);
  return element;
}
function dialog(role: "dialog" | "alertdialog" = "dialog") {
  const element = document.createElement("div"); element.setAttribute("role", role);
  const input = document.createElement("input"); element.append(input); document.body.append(element); input.focus();
  return element;
}
async function flushFrames() {
  await act(async () => { await Promise.resolve(); });
  act(() => { const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback(0)); });
}

describe("source dialog focus return", () => {
  it.each(["dialog", "alertdialog"] as const)("waits for the closing %s to unmount before returning to its opener", async (role) => {
    const { result, rerender } = renderHook(({ open }) => useAcquisitionSourceDialogFocus(open), { initialProps: { open: false } });
    const opener = button(); opener.focus();
    act(() => result.current.capture());
    rerender({ open: true });
    const closing = dialog(role);
    rerender({ open: false });
    await flushFrames();
    expect(closing.contains(document.activeElement)).toBe(true);
    closing.remove();
    await flushFrames();
    expect(document.activeElement).toBe(opener);
  });

  it("returns to the search field when the source row opener was deleted", async () => {
    const { result, rerender } = renderHook(({ open }) => useAcquisitionSourceDialogFocus(open), { initialProps: { open: false } });
    const opener = button(result.current.actionId("source-id", "menu"));
    const search = document.createElement("input"); document.body.append(search);
    act(() => result.current.setFallbackElement(search));
    act(() => result.current.captureAction("source-id", "menu"));
    rerender({ open: true });
    const closing = dialog();
    opener.remove(); rerender({ open: false }); closing.remove();
    await flushFrames();
    expect(document.activeElement).toBe(search);
  });

  it("suppresses menu autofocus only when an action is opening a dialog", () => {
    const { result, rerender } = renderHook(({ open }) => useAcquisitionSourceDialogFocus(open), { initialProps: { open: false } });
    const normal = new Event("closeAutoFocus", { cancelable: true });
    result.current.onMenuCloseAutoFocus(normal);
    expect(normal.defaultPrevented).toBe(false);
    act(() => result.current.capture(button()));
    const opening = new Event("closeAutoFocus", { cancelable: true });
    result.current.onMenuCloseAutoFocus(opening);
    expect(opening.defaultPrevented).toBe(true);
    rerender({ open: true });
    const open = new Event("closeAutoFocus", { cancelable: true });
    result.current.onMenuCloseAutoFocus(open);
    expect(open.defaultPrevented).toBe(true);
  });

  it("keeps the original row opener across the delete-in-use edit recovery", async () => {
    const { result, rerender } = renderHook(({ open }) => useAcquisitionSourceDialogFocus(open), { initialProps: { open: false } });
    const opener = button(); act(() => result.current.capture(opener)); rerender({ open: true });
    const closing = dialog();
    const recovery = document.createElement("button"); closing.append(recovery); recovery.focus();
    act(() => result.current.capture(recovery));
    rerender({ open: false }); closing.remove(); await flushFrames();
    expect(document.activeElement).toBe(opener);
  });

  it("does not steal focus if the user already focused another control", async () => {
    const { result, rerender } = renderHook(({ open }) => useAcquisitionSourceDialogFocus(open), { initialProps: { open: false } });
    const opener = button(); act(() => result.current.capture(opener)); rerender({ open: true });
    const closing = dialog(); rerender({ open: false }); closing.remove();
    const other = button(); other.focus(); await flushFrames();
    expect(document.activeElement).toBe(other);
  });

  it("cancels queued restoration when the auth-scoped workspace unmounts", async () => {
    const { result, rerender, unmount } = renderHook(({ open }) => useAcquisitionSourceDialogFocus(open), { initialProps: { open: false } });
    const opener = button(); act(() => result.current.capture(opener)); rerender({ open: true });
    const closing = dialog(); rerender({ open: false }); closing.remove();
    await act(async () => { await Promise.resolve(); });
    unmount(); await flushFrames();
    expect(document.activeElement).not.toBe(opener);
  });
});
