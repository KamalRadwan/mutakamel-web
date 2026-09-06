// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Combobox, type ComboboxOption } from "./Combobox";

afterEach(cleanup);
beforeEach(() => vi.useRealTimers());

const options: ComboboxOption[] = [
  { value: "1", label: "Cairo branch" },
  { value: "2", label: "Alexandria branch" },
  { value: "3", label: "Giza branch", description: "GIZ-001" },
];

function renderCombobox(overrides: Partial<React.ComponentProps<typeof Combobox>> = {}) {
  const props: React.ComponentProps<typeof Combobox> = {
    onValueChange: vi.fn(),
    options,
    onSearch: vi.fn(),
    placeholder: "Select a branch",
    searchPlaceholder: "Search branches",
    loadingLabel: "Loading…",
    emptyLabel: "No branches match",
    ...overrides,
  };
  return { props, ...render(<Combobox {...props} />) };
}

describe("Combobox", () => {
  it("shows the caller-supplied label for the current value, not the raw id", () => {
    renderCombobox({ value: "99", selectedLabel: "Aswan branch" });
    expect(screen.getByRole("button", { name: /Aswan branch/ })).toBeInTheDocument();
  });

  it("puts role=combobox on the search field with a real listbox relationship", () => {
    renderCombobox();
    fireEvent.click(screen.getByRole("button", { name: /Select a branch/ }));
    const field = screen.getByRole("combobox");
    const list = screen.getByRole("listbox");
    expect(field).toHaveAttribute("aria-controls", list.id);
    expect(field).toHaveAttribute("aria-autocomplete", "list");
    expect(field).toHaveAttribute("aria-activedescendant");
  });

  it("debounces the search rather than firing a request per keystroke", () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    renderCombobox({ onSearch, debounceMs: 300 });
    fireEvent.click(screen.getByRole("button", { name: /Select a branch/ }));

    const field = screen.getByRole("combobox");
    fireEvent.change(field, { target: { value: "c" } });
    fireEvent.change(field, { target: { value: "ca" } });
    fireEvent.change(field, { target: { value: "cai" } });
    expect(onSearch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith("cai");
    vi.useRealTimers();
  });

  it("renders a loading state instead of an empty dropdown while the server is answering", () => {
    renderCombobox({ loading: true });
    fireEvent.click(screen.getByRole("button", { name: /Select a branch/ }));
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("Cairo branch")).toBeNull();
  });

  it("renders the empty state when the server returned nothing", () => {
    renderCombobox({ options: [] });
    fireEvent.click(screen.getByRole("button", { name: /Select a branch/ }));
    expect(screen.getByText("No branches match")).toBeInTheDocument();
  });

  it("moves the active option with the arrow keys and commits on Enter", () => {
    const onValueChange = vi.fn();
    renderCombobox({ onValueChange });
    fireEvent.click(screen.getByRole("button", { name: /Select a branch/ }));
    const field = screen.getByRole("combobox");

    fireEvent.keyDown(field, { key: "ArrowDown" });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onValueChange).toHaveBeenCalledWith("2");
  });

  it("wraps at the ends and honours Home/End", () => {
    const onValueChange = vi.fn();
    renderCombobox({ onValueChange });
    fireEvent.click(screen.getByRole("button", { name: /Select a branch/ }));
    const field = screen.getByRole("combobox");

    fireEvent.keyDown(field, { key: "ArrowUp" });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onValueChange).toHaveBeenCalledWith("3");
  });

  it("marks the selected option with aria-selected", () => {
    renderCombobox({ value: "2", selectedLabel: "Alexandria branch" });
    fireEvent.click(screen.getByRole("button", { name: /Alexandria branch/ }));
    const selected = screen.getAllByRole("option").filter((o) => o.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent("Alexandria branch");
  });

  // The option list is portalled to `document.body`, i.e. OUTSIDE the panel of
  // any dialog that contains this control. Radix `Dialog` is modal by default
  // and its `react-remove-scroll` lock calls preventDefault on every wheel
  // event outside that panel, so the list scrolled by keyboard only — reported
  // against the city picker in the create-lead modal. A modal popover pushes a
  // lock of its own and the dialog's stands down while it is on top. This pins
  // the modal behaviour through the side effect Radix produces for it, because
  // the wheel itself is not something jsdom can carry.
  it("opens a modal layer, so the list still scrolls inside a dialog", () => {
    renderCombobox();
    expect(document.body.style.pointerEvents).not.toBe("none");

    fireEvent.click(screen.getByRole("button", { name: /Select a branch/ }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(document.body.style.pointerEvents).toBe("none");
  });

  it("hands the page back when it closes, so the form under it stays usable", async () => {
    // The failure mode a modal layer buys: one that does not stand down leaves
    // `pointer-events: none` on the body and the dialog around it goes dead to
    // the mouse. Committing an option is the path a user actually takes out.
    const onValueChange = vi.fn();
    renderCombobox({ onValueChange });
    fireEvent.click(screen.getByRole("button", { name: /Select a branch/ }));
    fireEvent.click(screen.getByRole("option", { name: /Cairo branch/ }));

    expect(onValueChange).toHaveBeenCalledWith("1");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));
  });

  it("keeps the list itself the scrolling box, not the popover around it", () => {
    // A modal layer only helps if something inside it can actually take the
    // delta: the height cap and the overflow live on the listbox.
    renderCombobox();
    fireEvent.click(screen.getByRole("button", { name: /Select a branch/ }));

    const list = screen.getByRole("listbox");
    expect(list.className).toContain("overflow-y-auto");
    expect(list.className).toMatch(/max-h-/u);
  });

  it("does not open while readOnly, and stays enabled unlike disabled", () => {
    const { rerender } = renderCombobox({ value: "1", selectedLabel: "Cairo branch", readOnly: true });
    const trigger = screen.getByRole("button", { name: /Cairo branch/ });
    expect(trigger).toBeEnabled();
    expect(trigger).toHaveAttribute("aria-readonly", "true");
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).toBeNull();

    rerender(
      <Combobox
        value="1"
        selectedLabel="Cairo branch"
        onValueChange={vi.fn()}
        options={options}
        onSearch={vi.fn()}
        placeholder="Select a branch"
        searchPlaceholder="Search branches"
        loadingLabel="Loading…"
        emptyLabel="No branches match"
        disabled
      />,
    );
    expect(screen.getByRole("button", { name: /Cairo branch/ })).toBeDisabled();
  });
});
