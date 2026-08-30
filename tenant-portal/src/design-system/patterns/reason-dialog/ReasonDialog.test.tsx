// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReasonDialog, type ReasonDialogLabels } from "./ReasonDialog";

afterEach(cleanup);

const labels: ReasonDialogLabels = {
  reason: "Reason",
  reasonPlaceholder: "Why is this being closed?",
  confirm: "Confirm",
  cancel: "Cancel",
};

function renderDialog(overrides: Partial<React.ComponentProps<typeof ReasonDialog>> = {}) {
  const props: React.ComponentProps<typeof ReasonDialog> = {
    open: true,
    onOpenChange: vi.fn(),
    title: "Mark as lost",
    onConfirm: vi.fn(),
    labels,
    ...overrides,
  };
  return { props, ...render(<ReasonDialog {...props} />) };
}

describe("ReasonDialog", () => {
  it("keeps confirm disabled until a non-blank reason is typed when the reason is required", () => {
    renderDialog({ reasonRequired: true });
    const confirm = screen.getByRole("button", { name: labels.confirm });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Budget cut" } });
    expect(confirm).toBeEnabled();
  });

  it("allows an empty reason when the reason is optional", () => {
    const { props } = renderDialog();
    const confirm = screen.getByRole("button", { name: labels.confirm });
    expect(confirm).toBeEnabled();
    confirm.click();
    expect(props.onConfirm).toHaveBeenCalledWith("");
  });

  it("caps the reason at the length the caller declares", () => {
    renderDialog({ maxLength: 120 });
    expect(screen.getByRole("textbox")).toHaveAttribute("maxlength", "120");
    expect(screen.getByText("0/120")).toBeInTheDocument();
  });

  it("uses the destructive confirm only when the caller says the action is destructive", () => {
    const { rerender } = renderDialog();
    expect(screen.getByRole("button", { name: labels.confirm }).className).not.toContain(
      "bg-destructive",
    );

    rerender(
      <ReasonDialog
        open
        onOpenChange={vi.fn()}
        title="Mark as lost"
        onConfirm={vi.fn()}
        destructive
        labels={labels}
      />,
    );
    expect(screen.getByRole("button", { name: labels.confirm }).className).toContain(
      "bg-destructive",
    );
  });

  it("hands the typed reason to onConfirm verbatim", () => {
    const { props } = renderDialog({ reasonRequired: true });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Lost on price" } });
    screen.getByRole("button", { name: labels.confirm }).click();
    expect(props.onConfirm).toHaveBeenCalledWith("Lost on price");
  });

  it("refuses to close while submitting", () => {
    const { props } = renderDialog({ loading: true });
    screen.getByRole("button", { name: labels.cancel }).click();
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });

  it("renders a non-field rejection in-body rather than leaving it to a toast", () => {
    renderDialog({ error: "The opportunity already moved to WON." });
    expect(screen.getByRole("alert")).toHaveTextContent("The opportunity already moved to WON.");
  });

  it("never carries a previous attempt's reason into a reopened dialog", () => {
    const props = {
      onOpenChange: vi.fn(),
      title: "Mark as lost",
      onConfirm: vi.fn(),
      labels,
    };
    const { rerender } = render(<ReasonDialog open {...props} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Lost on price" } });
    expect(screen.getByRole("textbox")).toHaveValue("Lost on price");

    rerender(<ReasonDialog open={false} {...props} />);
    rerender(<ReasonDialog open {...props} />);

    expect(screen.getByRole("textbox")).toHaveValue("");
  });
});
