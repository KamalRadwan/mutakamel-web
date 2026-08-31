// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditDrawer, type EditDrawerProps } from "./EditDrawer";

afterEach(cleanup);

function renderDrawer(overrides: Partial<EditDrawerProps> = {}) {
  const props: EditDrawerProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: "Edit branch",
    isDirty: false,
    isSubmitting: false,
    onSubmit: vi.fn(),
    labels: {
      submit: "Save changes",
      cancel: "Cancel",
      discardTitle: "Discard unsaved changes?",
      discardDescription: "Your changes have not been saved.",
      discardConfirm: "Discard",
      discardCancel: "Keep editing",
      loadErrorTitle: "Could not load this branch",
      retry: "Try again",
      notFoundTitle: "This branch no longer exists",
      notFoundBack: "Close",
      revert: "Revert",
      delete: "Delete",
    },
    children: <p>Form fields</p>,
    ...overrides,
  };
  return { props, ...render(<EditDrawer {...props} />) };
}

describe("EditDrawer", () => {
  it("renders the form once the record has loaded", () => {
    renderDrawer();
    expect(screen.getByText("Form fields")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("blocks submit and hides the form while the record loads", () => {
    renderDrawer({ isLoading: true });
    expect(screen.queryByText("Form fields")).toBeNull();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("renders a retryable error for a failed LOAD, not a submit error", () => {
    const onRetryLoad = vi.fn();
    renderDrawer({ loadError: "Gateway timeout", onRetryLoad });
    expect(screen.getByText("Could not load this branch")).toBeInTheDocument();
    expect(screen.getByText("Gateway timeout")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetryLoad).toHaveBeenCalled();
  });

  it("renders a deleted record WITHOUT a retry — retrying cannot change the answer", () => {
    renderDrawer({ notFound: true });
    expect(screen.getByText("This branch no longer exists")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("does not fire the dirty guard when the record never loaded", () => {
    const onOpenChange = vi.fn();
    renderDrawer({ isDirty: true, notFound: true, onOpenChange });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Discard unsaved changes?")).toBeNull();
  });

  it("still fires the dirty guard on a loaded, edited record", () => {
    const onOpenChange = vi.fn();
    renderDrawer({ isDirty: true, onOpenChange });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText("Discard unsaved changes?")).toBeInTheDocument();
  });

  it("enables revert only once something has changed", () => {
    const { unmount } = renderDrawer({ onRevert: vi.fn() });
    expect(screen.getByRole("button", { name: "Revert" })).toBeDisabled();
    unmount();
    renderDrawer({ onRevert: vi.fn(), isDirty: true });
    expect(screen.getByRole("button", { name: "Revert" })).toBeEnabled();
  });

  it("reports a delete intent without confirming it here", () => {
    const onDelete = vi.fn();
    renderDrawer({ onDelete });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalled();
  });

  it("omits delete and revert entirely when no handler is passed", () => {
    renderDrawer();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Revert" })).toBeNull();
  });

  it("renders the caller's conflict surface alongside the drawer", () => {
    renderDrawer({ conflict: <p>Someone else saved this branch</p> });
    expect(screen.getByText("Someone else saved this branch")).toBeInTheDocument();
  });
});
