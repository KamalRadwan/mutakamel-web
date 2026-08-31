// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CommandPalette, type CommandPaletteProps } from "./CommandPalette";

// jsdom has no layout, so two browser APIs cmdk relies on are simply absent:
// ResizeObserver (it drives --cmdk-list-height) and Element.scrollIntoView
// (it keeps the keyboard-selected item in view). Both stubs exist so the
// component can mount; neither simulates anything, and no assertion below
// depends on them.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(cleanup);

function renderPalette(overrides: Partial<CommandPaletteProps> = {}) {
  const props: CommandPaletteProps = {
    open: true,
    onOpenChange: vi.fn(),
    groups: [
      {
        id: "crm",
        heading: "CRM Module",
        items: [
          { id: "/crm/leads", label: "Leads", keywords: ["/crm/leads"], onSelect: vi.fn() },
          { id: "/crm/opportunities", label: "Opportunities", onSelect: vi.fn() },
        ],
      },
      {
        id: "account",
        items: [{ id: "/core/authentication", label: "Authentication", onSelect: vi.fn() }],
      },
    ],
    labels: {
      title: "Command palette",
      description: "Search and jump to any screen you can reach.",
      placeholder: "Search screens…",
      empty: "Nothing matches that.",
    },
    ...overrides,
  };
  return { props, ...render(<CommandPalette {...props} />) };
}

describe("CommandPalette", () => {
  it("renders every group and item it is given", () => {
    renderPalette();
    expect(screen.getByText("CRM Module")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("carries an accessible name, since it has no visible title", () => {
    renderPalette();
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
  });

  it("filters items by label", () => {
    renderPalette();
    fireEvent.change(screen.getByPlaceholderText("Search screens…"), { target: { value: "oppor" } });
    const visible = screen.getAllByRole("option").map((option) => option.textContent);
    expect(visible).toEqual(["Opportunities"]);
  });

  it("also matches the extra keywords a route carries", () => {
    renderPalette();
    fireEvent.change(screen.getByPlaceholderText("Search screens…"), {
      target: { value: "/crm/leads" },
    });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Leads"]);
  });

  it("renders its own empty state when nothing matches", () => {
    renderPalette();
    fireEvent.change(screen.getByPlaceholderText("Search screens…"), { target: { value: "zzzz" } });
    expect(screen.getByText("Nothing matches that.")).toBeInTheDocument();
  });

  it("runs the item's own handler on select", () => {
    const onSelect = vi.fn();
    renderPalette({
      groups: [{ id: "crm", items: [{ id: "/crm/leads", label: "Leads", onSelect }] }],
    });
    fireEvent.click(screen.getByRole("option", { name: "Leads" }));
    expect(onSelect).toHaveBeenCalled();
  });

  it("drops a group with no items rather than rendering an empty heading", () => {
    renderPalette({
      groups: [
        { id: "crm", heading: "CRM Module", items: [] },
        { id: "core", heading: "Core", items: [{ id: "a", label: "Users", onSelect: vi.fn() }] },
      ],
    });
    expect(screen.queryByText("CRM Module")).toBeNull();
    expect(screen.getByText("Core")).toBeInTheDocument();
  });

  it("styles cmdk WITHOUT a component stylesheet — every part carries a className (1.40)", () => {
    renderPalette();
    // The attributes exist; nothing selects on them from a stylesheet, and the
    // one part with no className prop is reached by a utility on its parent.
    // Queried from document, because DialogContent portals out of `container`.
    const group = document.querySelector("[cmdk-group]")!;
    expect(group.className).toContain("[&_[cmdk-group-heading]]:text-xs");
    expect(document.querySelector("[cmdk-item]")!.className).toContain("rounded-xs");
    expect(document.querySelector("[cmdk-list]")!.className).toContain("overflow-y-auto");
  });
});
