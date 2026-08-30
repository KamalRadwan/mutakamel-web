// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConflictDialog, type ConflictDialogLabels } from "./ConflictDialog";

afterEach(cleanup);

const labels: ConflictDialogLabels = {
  yourChanges: "Your changes",
  theirChanges: "Their changes",
  reload: "Reload and reapply",
  overwrite: "Overwrite",
  cancel: "Cancel",
};

function renderDialog(overrides: Partial<React.ComponentProps<typeof ConflictDialog>> = {}) {
  const props: React.ComponentProps<typeof ConflictDialog> = {
    open: true,
    onOpenChange: vi.fn(),
    title: "This record changed",
    description: "Someone else saved it while you were editing.",
    onReload: vi.fn(),
    onCancel: vi.fn(),
    labels,
    ...overrides,
  };
  return { props, ...render(<ConflictDialog {...props} />) };
}

describe("ConflictDialog", () => {
  it("renders every string from labels and never from a dictionary", () => {
    renderDialog();
    expect(screen.getByRole("heading", { name: /This record changed/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: labels.reload })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: labels.cancel })).toBeInTheDocument();
  });

  it("omits the overwrite action entirely when overwriting is not permitted", () => {
    renderDialog();
    expect(screen.queryByRole("button", { name: labels.overwrite })).toBeNull();
  });

  it("offers overwrite as a destructive action when the caller allows it", () => {
    const onOverwrite = vi.fn();
    renderDialog({ onOverwrite });
    const button = screen.getByRole("button", { name: labels.overwrite });
    button.click();
    expect(onOverwrite).toHaveBeenCalledOnce();
  });

  it("renders both change slots when given, so the user can compare before choosing", () => {
    renderDialog({
      yourChanges: <span>Owner: Layla</span>,
      theirChanges: <span>Owner: Omar</span>,
    });
    expect(screen.getByText("Your changes")).toBeInTheDocument();
    expect(screen.getByText("Their changes")).toBeInTheDocument();
    expect(screen.getByText("Owner: Layla")).toBeInTheDocument();
    expect(screen.getByText("Owner: Omar")).toBeInTheDocument();
  });

  it("routes the cancel button through onCancel and then closes", () => {
    const { props } = renderDialog();
    screen.getByRole("button", { name: labels.cancel }).click();
    expect(props.onCancel).toHaveBeenCalledOnce();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("refuses to dismiss while a resolution is in flight", () => {
    const { props } = renderDialog({ loading: true });
    screen.getByRole("button", { name: labels.cancel }).click();
    expect(props.onCancel).not.toHaveBeenCalled();
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });
});
