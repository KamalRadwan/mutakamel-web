// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComboboxOption } from "./Combobox";
import { MultiSelect } from "./MultiSelect";

afterEach(cleanup);

const options: ComboboxOption[] = [
  { value: "new", label: "New" },
  { value: "qualified", label: "Qualified" },
  { value: "nurturing", label: "Nurturing" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

function renderMultiSelect(overrides: Partial<React.ComponentProps<typeof MultiSelect>> = {}) {
  const props: React.ComponentProps<typeof MultiSelect> = {
    values: [],
    onValuesChange: vi.fn(),
    options,
    placeholder: "Any stage",
    emptyLabel: "No stages match",
    moreLabel: "+{count}",
    removeLabel: "Remove {label}",
    overflowLabel: "More stages",
    ...overrides,
  };
  return { props, ...render(<MultiSelect {...props} />) };
}

describe("MultiSelect", () => {
  it("renders the selected values as chips in the trigger", () => {
    renderMultiSelect({ values: ["new", "won"] });
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("Won")).toBeInTheDocument();
  });

  it("collapses past maxVisible behind a +n BUTTON, never a static count", () => {
    renderMultiSelect({ values: ["new", "qualified", "nurturing", "won", "lost"], maxVisible: 3 });
    const overflow = screen.getByRole("button", { name: "+2" });
    expect(overflow.tagName).toBe("BUTTON");
  });

  it("keeps the overflowed chips removable inside that popover", () => {
    const onValuesChange = vi.fn();
    renderMultiSelect({
      values: ["new", "qualified", "nurturing", "won", "lost"],
      maxVisible: 3,
      onValuesChange,
    });
    fireEvent.click(screen.getByRole("button", { name: "+2" }));
    expect(screen.getByText("More stages")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove Lost" }));
    expect(onValuesChange).toHaveBeenCalledWith(["new", "qualified", "nurturing", "won"]);
  });

  it("removes a visible chip from its own control", () => {
    const onValuesChange = vi.fn();
    renderMultiSelect({ values: ["new", "won"], onValuesChange });
    fireEvent.click(screen.getByRole("button", { name: "Remove New" }));
    expect(onValuesChange).toHaveBeenCalledWith(["won"]);
  });

  it("toggles a value from the option list and marks selection with aria-selected", () => {
    const onValuesChange = vi.fn();
    renderMultiSelect({ values: ["new"], onValuesChange });
    fireEvent.click(screen.getByRole("button", { name: "Any stage" }));
    fireEvent.click(screen.getByRole("option", { name: "Qualified" }));
    expect(onValuesChange).toHaveBeenCalledWith(["new", "qualified"]);
    expect(screen.getByRole("option", { name: "New" })).toHaveAttribute("aria-selected", "true");
  });

  it("exposes the list as a multi-selectable listbox", () => {
    renderMultiSelect();
    fireEvent.click(screen.getByRole("button", { name: "Any stage" }));
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-multiselectable", "true");
  });

  it("filters the local option list from the search field", () => {
    renderMultiSelect({ searchPlaceholder: "Search stages" });
    fireEvent.click(screen.getByRole("button", { name: "Any stage" }));
    fireEvent.change(screen.getByLabelText("Search stages"), { target: { value: "won" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("Search stages"), { target: { value: "zzz" } });
    expect(screen.getByText("No stages match")).toBeInTheDocument();
  });

  it("clears everything through a single control", () => {
    const onValuesChange = vi.fn();
    renderMultiSelect({ values: ["new", "won"], clearAllLabel: "Clear all", onValuesChange });
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onValuesChange).toHaveBeenCalledWith([]);
  });

  it("hides the remove affordances while readOnly, but keeps the values legible", () => {
    renderMultiSelect({ values: ["new"], readOnly: true });
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove New" })).toBeNull();
  });
});
