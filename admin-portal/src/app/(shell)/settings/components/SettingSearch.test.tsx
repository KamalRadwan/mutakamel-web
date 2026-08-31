// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    t: {
      settings: {
        search: {
          label: "Search settings",
          placeholder: "Search settings...",
          clear: "Clear settings search",
        },
      },
    },
  }),
}));

import { SettingSearch } from "./SettingSearch";

describe("SettingSearch", () => {
  it("keeps a visible label and gives the clear action an accessible name", () => {
    const onChange = vi.fn();
    render(<SettingSearch value="billing" onChange={onChange} />);

    const input = screen.getByRole("searchbox", { name: "Search settings" });
    expect(input).toHaveValue("billing");
    expect(screen.getByText("Search settings")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Clear settings search" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
