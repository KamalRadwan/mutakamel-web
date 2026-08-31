// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceCard } from "./WorkspaceCard";

afterEach(cleanup);

describe("WorkspaceCard", () => {
  it("exposes an activatable card as a button, and a plain one as neither", () => {
    const { rerender } = render(<WorkspaceCard onActivate={vi.fn()}>Acme</WorkspaceCard>);
    expect(screen.getByRole("button")).toHaveAttribute("tabindex", "0");

    rerender(<WorkspaceCard>Acme</WorkspaceCard>);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens on Enter", () => {
    const onActivate = vi.fn();
    render(<WorkspaceCard onActivate={onActivate}>Acme</WorkspaceCard>);
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it("leaves Space to the board's drag lift when told to", () => {
    const onActivate = vi.fn();
    render(
      <WorkspaceCard onActivate={onActivate} activateOnSpace={false}>
        Acme
      </WorkspaceCard>,
    );
    fireEvent.keyDown(screen.getByRole("button"), { key: " " });
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("does not open the card when the pointer travelled — that was a drag (V5)", () => {
    const onActivate = vi.fn();
    render(<WorkspaceCard onActivate={onActivate}>Acme</WorkspaceCard>);
    const surface = screen.getByRole("button");

    fireEvent.pointerDown(surface, { clientX: 10, clientY: 10 });
    fireEvent.click(surface, { clientX: 60, clientY: 90 });
    expect(onActivate).not.toHaveBeenCalled();

    fireEvent.pointerDown(surface, { clientX: 10, clientY: 10 });
    fireEvent.click(surface, { clientX: 11, clientY: 12 });
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it("keeps the selection checkbox and the action slot outside the activation surface", () => {
    const onActivate = vi.fn();
    const onSelectedChange = vi.fn();
    render(
      <WorkspaceCard
        onActivate={onActivate}
        onSelectedChange={onSelectedChange}
        selectLabel="Select this item"
        actions={<span data-testid="card-actions" />}
      >
        Acme
      </WorkspaceCard>,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Select this item" });
    const surface = screen.getByRole("button", { name: "Acme" });
    expect(surface).not.toContainElement(checkbox);
    expect(surface).not.toContainElement(screen.getByTestId("card-actions"));

    fireEvent.click(checkbox);
    expect(onSelectedChange).toHaveBeenCalledWith(true);
    expect(onActivate).not.toHaveBeenCalled();
  });
});
