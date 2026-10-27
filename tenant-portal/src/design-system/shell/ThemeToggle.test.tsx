// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar, type Dictionary } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { Theme } from "../theme/ThemeProvider";
import { ThemeToggle } from "./ThemeToggle";

const setTheme = vi.fn();
let theme: Theme = "system";
let dictionary: Dictionary = en;

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionary }) }));
vi.mock("../theme/ThemeProvider", () => ({
  useTheme: () => ({ theme, setTheme }),
}));

afterEach(() => {
  cleanup();
  setTheme.mockClear();
});

describe("ThemeToggle surface contexts", () => {
  it.each([en, ar])("preserves the labelled theme cycle with either tone", (nextDictionary) => {
    dictionary = nextDictionary;
    const { rerender } = render(<ThemeToggle />);
    const steps = [
      ["light", "dark", dictionary.common.switchToDark],
      ["dark", "system", dictionary.common.switchToSystem],
      ["system", "light", dictionary.common.switchToLight],
    ] as const;

    for (const tone of ["surface", "chrome"] as const) {
      for (const [current, next, label] of steps) {
        theme = current;
        rerender(tone === "surface" ? <ThemeToggle /> : <ThemeToggle tone="chrome" />);
        const button = screen.getByRole("button", { name: label });
        expect(button).toHaveClass(tone === "surface" ? "text-foreground-secondary" : "text-nav-foreground");
        expect(button).not.toHaveClass(tone === "surface" ? "text-nav-foreground" : "text-foreground-secondary");
        fireEvent.click(button);
        expect(setTheme).toHaveBeenLastCalledWith(next);
      }
    }
    expect(setTheme).toHaveBeenCalledTimes(6);
  });
});
