// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./ContextMenu";

afterEach(cleanup);

function renderMenu(onDelete = vi.fn()) {
  render(
    <ContextMenu>
      <ContextMenuTrigger>Lead row</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>Actions</ContextMenuLabel>
        <ContextMenuItem>Open</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={onDelete}>
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>,
  );
  return { onDelete };
}

describe("ContextMenu", () => {
  it("stays closed until the trigger is right-clicked", () => {
    renderMenu();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens on contextmenu and exposes real menu semantics", () => {
    renderMenu();
    fireEvent.contextMenu(screen.getByText("Lead row"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem")).toHaveLength(2);
  });

  it("runs the selected item's handler", () => {
    const { onDelete } = renderMenu();
    fireEvent.contextMenu(screen.getByText("Lead row"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("tints only the destructive item, and from the semantic token", () => {
    renderMenu();
    fireEvent.contextMenu(screen.getByText("Lead row"));
    expect(screen.getByRole("menuitem", { name: "Delete" }).className).toContain("text-destructive");
    expect(screen.getByRole("menuitem", { name: "Open" }).className).not.toContain("text-destructive");
  });

  it("sits on the dropdown layer rather than a bare z-index", () => {
    renderMenu();
    fireEvent.contextMenu(screen.getByText("Lead row"));
    const menu = screen.getByRole("menu");
    expect(menu.className).toContain("z-(--z-dropdown)");
    expect(menu.className).not.toMatch(/(?:^|\s)z-\d+/);
  });
});
