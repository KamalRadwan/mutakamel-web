// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ar, type Dictionary } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { LanguageToggle } from "./LanguageToggle";

const toggleLang = vi.fn();
let dictionary: Dictionary = en;

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: dictionary, toggleLang }),
}));

afterEach(() => {
  cleanup();
  toggleLang.mockClear();
});

describe("LanguageToggle surface contexts", () => {
  it.each([en, ar])("keeps the target language accessible with either tone", (nextDictionary) => {
    dictionary = nextDictionary;
    const { rerender } = render(<LanguageToggle />);
    const button = screen.getByRole("button", { name: dictionary.common.langSwitch });

    expect(button).toHaveClass("border-line-control", "bg-surface-subtle", "text-foreground-secondary");
    expect(button).not.toHaveClass("text-nav-foreground");
    fireEvent.click(button);
    expect(toggleLang).toHaveBeenCalledTimes(1);

    rerender(<LanguageToggle tone="chrome" />);
    expect(button).toHaveClass("border-nav-chrome-line", "text-nav-foreground");
    expect(button).not.toHaveClass("text-foreground-secondary");
    expect(button).toHaveAccessibleName(dictionary.common.langSwitch);
    fireEvent.click(button);
    expect(toggleLang).toHaveBeenCalledTimes(2);
  });
});
