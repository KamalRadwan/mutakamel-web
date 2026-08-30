/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppShell } from "./useAppShell";

const routerState = vi.hoisted(() => ({ pathname: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => routerState.pathname,
}));

vi.mock("./useSidebar", () => ({
  useSidebar: () => ({ collapsed: false, toggle: vi.fn() }),
}));

vi.mock("./useCommandPalette", () => ({
  useCommandPalette: () => ({
    open: false,
    setOpen: vi.fn(),
    sections: [],
    navigate: vi.fn(),
  }),
}));

function FocusProbe() {
  const { mainRef } = useAppShell(false);
  return <main ref={mainRef} tabIndex={-1}>Main content</main>;
}

describe("useAppShell route focus", () => {
  beforeEach(() => {
    routerState.pathname = "/dashboard";
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("queueMicrotask", (callback: VoidFunction) => callback());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("leaves initial focus alone and focuses the main landmark after a pathname change", () => {
    const view = render(<FocusProbe />);
    const main = screen.getByRole("main");

    expect(document.activeElement).not.toBe(main);

    routerState.pathname = "/tenants";
    view.rerender(<FocusProbe />);

    expect(document.activeElement).toBe(main);
  });
});
