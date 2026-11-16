// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { safeSessionStorage } from "@/lib/safeStorage";
import { useScrollRestoration } from "./useScrollRestoration";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));

const detachments: Array<() => void> = [];

function attach(path = "/leads", view = "board") {
  vi.mocked(usePathname).mockReturnValue(path);
  const { result, unmount } = renderHook(() => useScrollRestoration(view));
  const element = document.createElement("div");
  const release = result.current(element);
  let attached = true;
  const detach = () => {
    if (!attached) return;
    attached = false;
    release?.();
    unmount();
  };
  detachments.push(detach);
  return { element, detach };
}

function storedOffsets(): Record<string, [number, number]> {
  return JSON.parse(sessionStorage.getItem("tenant_scroll") ?? "{}");
}

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
});

afterEach(() => {
  detachments.splice(0).forEach((detach) => detach());
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useScrollRestoration", () => {
  it("coalesces 100 scroll events in 100 ms into one trailing write", () => {
    const { element } = attach();
    const write = vi.spyOn(safeSessionStorage, "setItem");
    for (let index = 0; index < 100; index += 1) {
      element.scrollLeft = -index;
      element.scrollTop = index * 2;
      element.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(1);
    }
    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(write).toHaveBeenCalledTimes(1);
    expect(storedOffsets()["/leads:board"]).toEqual([-99, 198]);
  });

  it("continues saving during sustained scrolling without a synchronous write", () => {
    const { element } = attach();
    const write = vi.spyOn(safeSessionStorage, "setItem");
    element.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(150);
    element.scrollTop = 80;
    element.dispatchEvent(new Event("scroll"));
    expect(write).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(150);
    expect(write).toHaveBeenCalledTimes(2);
    expect(storedOffsets()["/leads:board"]).toEqual([0, 80]);
  });

  it("cancels the timer, flushes once, and removes the listener on cleanup", () => {
    const { element, detach } = attach();
    const write = vi.spyOn(safeSessionStorage, "setItem");
    element.scrollTop = 64;
    element.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(100);
    element.scrollTop = 128;
    detach();
    expect(write).toHaveBeenCalledTimes(1);
    expect(storedOffsets()["/leads:board"]).toEqual([0, 128]);
    element.dispatchEvent(new Event("scroll"));
    vi.runAllTimers();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("keeps only the 50 most recently saved entries after 60 distinct paths", () => {
    for (let index = 0; index < 60; index += 1) {
      const { element, detach } = attach(`/leads/${index}`);
      element.scrollTop = index;
      detach();
    }
    const offsets = storedOffsets();
    expect(Object.keys(offsets)).toHaveLength(50);
    expect(Object.keys(offsets)[0]).toBe("/leads/10:board");
    expect(offsets["/leads/0:board"]).toBeUndefined();
    expect(offsets["/leads/59:board"]).toEqual([0, 59]);
    expect(sessionStorage.length).toBe(1);
  });

  it("restores raw offsets from the map and keeps views isolated", () => {
    sessionStorage.setItem("tenant_scroll", JSON.stringify({
      "/leads:board": [-320, 400],
      "/leads:card": [0, 900],
    }));
    const board = attach();
    const card = attach("/leads", "card");
    expect([board.element.scrollLeft, board.element.scrollTop]).toEqual([-320, 400]);
    expect([card.element.scrollLeft, card.element.scrollTop]).toEqual([0, 900]);
    board.element.scrollTop = 500;
    board.detach();
    card.detach();
    expect(storedOffsets()["/leads:board"]).toEqual([-320, 500]);
    expect(storedOffsets()["/leads:card"]).toEqual([0, 900]);
  });

  it("refreshes an existing entry's age before evicting the oldest entry", () => {
    for (let index = 0; index < 50; index += 1) attach(`/leads/${index}`).detach();
    attach("/leads/0").detach();
    attach("/leads/50").detach();
    expect(storedOffsets()["/leads/0:board"]).toEqual([0, 0]);
    expect(storedOffsets()["/leads/1:board"]).toBeUndefined();
    expect(Object.keys(storedOffsets())).toHaveLength(50);
  });

  it.each(["{", "null", "[]", '{"/leads:board":["bad",4]}'])(
    "ignores invalid session data: %s",
    (raw) => {
      sessionStorage.setItem("tenant_scroll", raw);
      const { element, detach } = attach();
      expect([element.scrollLeft, element.scrollTop]).toEqual([0, 0]);
      element.scrollTop = 42;
      detach();
      expect(storedOffsets()["/leads:board"]).toEqual([0, 42]);
    },
  );
});
