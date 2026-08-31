// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BulkActionBar, type BulkActionBarLabels } from "./BulkActionBar";

afterEach(cleanup);

const labels: BulkActionBarLabels = { selection: "12 selected", clear: "Clear" };

describe("BulkActionBar", () => {
  it("renders nothing at zero selection rather than an empty strip", () => {
    const { container } = render(
      <BulkActionBar selectedCount={0} actions={[]} onClear={vi.fn()} labels={labels} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the caller-formatted selection count and every action", () => {
    const assign = vi.fn();
    render(
      <BulkActionBar
        selectedCount={12}
        actions={[
          { id: "assign", label: "Assign owner", onSelect: assign },
          { id: "delete", label: "Delete", onSelect: vi.fn(), destructive: true },
        ]}
        onClear={vi.fn()}
        labels={labels}
      />,
    );

    expect(screen.getByText("12 selected")).toBeInTheDocument();
    screen.getByRole("button", { name: "Assign owner" }).click();
    expect(assign).toHaveBeenCalledOnce();
  });

  it("styles a destructive action destructively and never renders a filled primary", () => {
    render(
      <BulkActionBar
        selectedCount={3}
        actions={[{ id: "delete", label: "Delete", onSelect: vi.fn(), destructive: true }]}
        onClear={vi.fn()}
        labels={labels}
      />,
    );

    expect(screen.getByRole("button", { name: "Delete" }).className).toContain("bg-destructive");
    for (const button of screen.getAllByRole("button")) {
      expect(button.className).not.toContain("bg-primary");
    }
  });

  it("disables every action while a bulk write is in flight", () => {
    render(
      <BulkActionBar
        selectedCount={3}
        actions={[{ id: "delete", label: "Delete", onSelect: vi.fn() }]}
        onClear={vi.fn()}
        disabled
        labels={labels}
      />,
    );

    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
  });

  it("honours a per-action disabled flag independently of the bar", () => {
    render(
      <BulkActionBar
        selectedCount={3}
        actions={[
          { id: "assign", label: "Assign owner", onSelect: vi.fn(), disabled: true },
          { id: "export", label: "Export", onSelect: vi.fn() },
        ]}
        onClear={vi.fn()}
        labels={labels}
      />,
    );

    expect(screen.getByRole("button", { name: "Assign owner" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
  });
});
