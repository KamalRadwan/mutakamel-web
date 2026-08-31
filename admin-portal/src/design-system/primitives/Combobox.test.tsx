// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Combobox } from "./Combobox";

beforeAll(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("Combobox", () => {
  it("exposes a named combobox and selects a filtered option", () => {
    const onValueChange = vi.fn();
    render(
      <Combobox
        value=""
        onValueChange={onValueChange}
        label="Country"
        placeholder="Choose a country"
        searchPlaceholder="Search countries"
        emptyLabel="No countries"
        options={[
          { value: "EG", label: "Egypt (EG)", keywords: ["Egypt", "EG"] },
          { value: "SA", label: "Saudi Arabia (SA)", keywords: ["Saudi Arabia", "SA"] },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Country" }));
    const search = screen.getByRole("combobox", { name: "Search countries" });
    fireEvent.change(search, { target: { value: "Egypt" } });
    fireEvent.click(screen.getByRole("option", { name: /Egypt/ }));

    expect(onValueChange).toHaveBeenCalledWith("EG");
    expect(screen.queryByRole("option", { name: /Egypt/ })).toBeNull();
  });
});
