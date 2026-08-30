// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BulkConfirmDialog } from "./BulkConfirmDialog";

afterEach(cleanup);

const labels = { confirm: "Delete 50 leads", cancel: "Cancel" };

function renderDialog(overrides: Partial<React.ComponentProps<typeof BulkConfirmDialog>> = {}) {
  const props: React.ComponentProps<typeof BulkConfirmDialog> = {
    open: true,
    onOpenChange: vi.fn(),
    title: "Delete the selected leads?",
    description: "This will delete 50 leads.",
    onConfirm: vi.fn(),
    labels,
    ...overrides,
  };
  return { props, ...render(<BulkConfirmDialog {...props} />) };
}

describe("BulkConfirmDialog", () => {
  it("shows the caller-formatted scope so the user sees what is about to happen", () => {
    renderDialog();
    expect(screen.getByText("This will delete 50 leads.")).toBeInTheDocument();
  });

  it("hosts a summary of the affected records, which ConfirmActionModal cannot", () => {
    renderDialog({
      summary: (
        <ul>
          <li>Layla Hassan</li>
          <li>Omar Nasser</li>
        </ul>
      ),
    });
    expect(screen.getByText("Layla Hassan")).toBeInTheDocument();
    expect(screen.getByText("Omar Nasser")).toBeInTheDocument();
  });

  it("styles the confirm destructively only when asked", () => {
    renderDialog({ destructive: true });
    expect(screen.getByRole("button", { name: labels.confirm }).className).toContain(
      "bg-destructive",
    );
  });

  it("refuses to close while the bulk write is running", () => {
    const { props } = renderDialog({ loading: true });
    screen.getByRole("button", { name: labels.cancel }).click();
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });

  it("confirms exactly once per click", () => {
    const { props } = renderDialog();
    screen.getByRole("button", { name: labels.confirm }).click();
    expect(props.onConfirm).toHaveBeenCalledOnce();
  });
});
