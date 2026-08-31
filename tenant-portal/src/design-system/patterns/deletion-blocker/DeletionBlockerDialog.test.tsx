// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeletionBlockerDialog, type DeletionBlockerDialogProps } from "./DeletionBlockerDialog";

afterEach(cleanup);

function renderDialog(overrides: Partial<DeletionBlockerDialogProps> = {}) {
  const props: DeletionBlockerDialogProps = {
    open: true,
    onOpenChange: vi.fn(),
    recordName: "Cairo Holding",
    blockers: [
      { id: "branches", label: "Branches", count: "3", examples: ["HQ", "Nasr City"], href: "/core/organization/branches" },
      { id: "users", label: "Placed users", count: "12" },
    ],
    labels: {
      title: "This company cannot be deleted yet",
      description: "Deal with the items below first, then try again.",
      blockersHeading: "What is blocking it",
      view: "View {label}",
      close: "Close",
    },
    ...overrides,
  };
  return { props, ...render(<DeletionBlockerDialog {...props} />) };
}

describe("DeletionBlockerDialog", () => {
  it("names the record and lists every blocker", () => {
    renderDialog();
    expect(screen.getByText("Cairo Holding")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toHaveLength(2);
    expect(items[0]).toContain("Branches");
    expect(items[1]).toContain("Placed users");
  });

  it("shows counts and examples so the reason is concrete", () => {
    renderDialog();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("HQ, Nasr City")).toBeInTheDocument();
  });

  it("links only the blockers the caller gave a destination", () => {
    renderDialog();
    expect(screen.getByRole("link", { name: "View Branches" })).toHaveAttribute(
      "href",
      "/core/organization/branches",
    );
    expect(screen.queryByRole("link", { name: "View Placed users" })).toBeNull();
  });

  it("offers NO delete-anyway path — the backend already refused", () => {
    renderDialog();
    const buttons = screen.getAllByRole("button").map((button) => button.textContent);
    expect(buttons.filter((label) => label === "Close")).toHaveLength(1);
    expect(buttons.some((label) => /delete/i.test(label ?? ""))).toBe(false);
  });

  it("closes through its own control", () => {
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });
    screen.getByRole("button", { name: "Close" }).click();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
