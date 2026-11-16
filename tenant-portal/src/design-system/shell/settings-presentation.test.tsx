// @vitest-environment jsdom

import { fireEvent, cleanup, render, screen } from "@testing-library/react";
import { createPortal } from "react-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PageHeader } from "../patterns/page-header/PageHeader";
import { Badge } from "../primitives/Badge";
import { SettingsPresentationContext } from "./settings-presentation";

afterEach(cleanup);

describe("Settings presentation scope", () => {
  it("removes the visible intro while keeping the accessible name and working actions", () => {
    const onCreate = vi.fn();
    render(<SettingsPresentationContext.Provider value>
      <PageHeader title="Lead Stages" description="Define the lead lifecycle."
        leading={<button>Back</button>} secondaryActions={<button>Reload</button>}
        primaryAction={{ label: "Add stage", onClick: onCreate }} />
      {createPortal(<Badge>Active</Badge>, document.body)}
    </SettingsPresentationContext.Provider>);
    expect(screen.getByRole("heading", { name: "Lead Stages" })).toHaveClass("sr-only");
    expect(screen.queryByText("Define the lead lifecycle.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reload" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Add stage" }));
    expect(onCreate).toHaveBeenCalledOnce();
    expect(screen.getByText("Active")).toHaveClass("rounded-full", "h-4");
  });

  it("preserves ordinary page intros and badge presentation outside Settings", () => {
    render(<><PageHeader title="Leads" description="Workspace records" /><Badge>Active</Badge></>);
    expect(screen.getByRole("heading", { name: "Leads" })).not.toHaveClass("sr-only");
    expect(screen.getByText("Workspace records")).toBeVisible();
    expect(screen.getByText("Active")).toHaveClass("rounded-sm");
  });
});
