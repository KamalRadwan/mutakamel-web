// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useActiveNavVisibility } from "./useActiveNavVisibility";

const scroll = vi.fn();
const disconnect = vi.fn();
const originalScroll = HTMLElement.prototype.scrollIntoView;
let itemRect: DOMRect;
let resize: (() => void) | undefined;

function Navigation({ lang = "en", selected = true }: { lang?: string; selected?: boolean }) {
  const ref = useActiveNavVisibility(selected ? "settings" : null, lang);
  return <nav ref={ref}><a href="/crm/settings" aria-current={selected ? "page" : undefined}>Settings</a></nav>;
}

beforeEach(() => {
  scroll.mockClear();
  disconnect.mockClear();
  resize = undefined;
  itemRect = new DOMRect(220, 0, 80, 36);
  HTMLElement.prototype.scrollIntoView = scroll;
  vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(300);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    return this.tagName === "NAV" ? new DOMRect(100, 0, 300, 36) : itemRect;
  });
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) { resize = () => callback([], this); }
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = disconnect;
  });
});

afterEach(() => {
  cleanup();
  HTMLElement.prototype.scrollIntoView = originalScroll;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("active navigation visibility", () => {
  it.each([new DOMRect(360, 0, 100, 36), new DOMRect(70, 0, 100, 36)])(
    "reveals the active link when clipped at either horizontal edge", (rect) => {
      itemRect = rect;
      render(<Navigation />);
      expect(scroll).toHaveBeenCalledExactlyOnceWith({ block: "nearest", inline: "nearest" });
    },
  );

  it("does not move an already visible link or an unselected section", () => {
    const view = render(<Navigation />);
    expect(scroll).not.toHaveBeenCalled();
    itemRect = new DOMRect(70, 0, 100, 36);
    view.rerender(<Navigation selected={false} />);
    expect(scroll).not.toHaveBeenCalled();
  });

  it("rechecks after language changes and resizing, then disconnects on unmount", () => {
    const view = render(<Navigation />);
    itemRect = new DOMRect(70, 0, 100, 36);
    view.rerender(<Navigation lang="ar" />);
    expect(scroll).toHaveBeenCalledTimes(1);
    itemRect = new DOMRect(220, 0, 80, 36);
    act(() => resize?.());
    expect(scroll).toHaveBeenCalledTimes(1);
    itemRect = new DOMRect(360, 0, 100, 36);
    act(() => resize?.());
    expect(scroll).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(disconnect).toHaveBeenCalledTimes(2);
  });

  it("does not scroll a hidden mobile navigation container", () => {
    vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(0);
    itemRect = new DOMRect(70, 0, 100, 36);
    render(<Navigation />);
    act(() => resize?.());
    expect(scroll).not.toHaveBeenCalled();
  });
});
