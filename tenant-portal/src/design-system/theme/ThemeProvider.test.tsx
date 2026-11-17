// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeProvider";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Tenant theme defaults and first paint", () => {
  it.each([
    [null, "light", false],
    ["invalid", "light", false],
    ["light", "light", false],
    ["dark", "dark", true],
    ["system", "system", true],
  ] as const)("keeps bootstrap and provider aligned for saved %s on a dark system", (stored, expected, dark) => {
    if (stored !== null) localStorage.setItem("tenant_theme", stored);
    const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    const bootstrap = layout.match(/const BOOTSTRAP = `([\s\S]*?)`;/)?.[1];
    expect(bootstrap).toBeDefined();
    runInNewContext(bootstrap!, { document, localStorage, matchMedia });
    expect(document.documentElement.classList.contains("dark")).toBe(dark);

    const { result } = renderHook(useTheme, { wrapper: ThemeProvider });
    expect(result.current.theme).toBe(expected);
    expect(result.current.isDark).toBe(dark);
    expect(document.documentElement.classList.contains("dark")).toBe(dark);
    expect(localStorage.getItem("tenant_theme")).toBe(stored);
  });
});
