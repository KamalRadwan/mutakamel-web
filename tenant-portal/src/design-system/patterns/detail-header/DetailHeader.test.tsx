// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Badge } from "../../primitives/Badge";
import { Button } from "../../primitives/Button";
import { PageHeader } from "../page-header/PageHeader";
import { DetailHeader } from "./DetailHeader";

afterEach(cleanup);

describe("DetailHeader", () => {
  it("renders the record name as the page heading", () => {
    render(<DetailHeader title="Acme Holding" backLabel="Back to customers" backHref="/crm" />);
    expect(screen.getByRole("heading", { level: 1, name: "Acme Holding" })).toBeInTheDocument();
  });

  it("puts the status badge inside the heading line, not beside the actions", () => {
    render(
      <DetailHeader
        title="Acme Holding"
        backLabel="Back"
        backHref="/crm"
        status={<Badge tone="positive">Active customer</Badge>}
      />,
    );
    expect(screen.getByText("Active customer")).toBeInTheDocument();
  });

  it("renders the back control as a link when given an href", () => {
    render(<DetailHeader title="Acme" backLabel="Back to customers" backHref="/crm/customers" />);
    expect(screen.getByRole("link", { name: "Back to customers" })).toHaveAttribute(
      "href",
      "/crm/customers",
    );
  });

  it("renders the back control as a button when the caller owns navigation", () => {
    const onBack = vi.fn();
    render(<DetailHeader title="Acme" backLabel="Back" onBack={onBack} />);
    screen.getByRole("button", { name: "Back" }).click();
    expect(onBack).toHaveBeenCalled();
  });

  it("renders no back control at all when there is nowhere to go", () => {
    render(<DetailHeader title="Acme" backLabel="Back" />);
    expect(screen.queryByRole("link", { name: "Back" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("has no primary action unless one is given — the ceiling is not a quota", () => {
    render(
      <DetailHeader
        title="Jane Doe"
        backLabel="Back"
        backHref="/crm"
        secondaryActions={<Button variant="outline">Edit</Button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("renders its primary action through PageHeader's own implementation (1.43)", () => {
    const onClick = vi.fn();
    const { container: detail } = render(
      <DetailHeader title="Lead" backLabel="Back" primaryAction={{ label: "Convert", onClick }} />,
    );
    const detailPrimary = detail.querySelector("button:last-of-type")!.className;

    cleanup();
    const { container: page } = render(<PageHeader title="Leads" primaryAction={{ label: "Convert", onClick }} />);
    const pagePrimary = page.querySelector("button:last-of-type")!.className;

    // Identical classes because it is literally the same component rendering
    // it. The two headers cannot drift on the one-filled-primary rule.
    expect(detailPrimary).toBe(pagePrimary);
  });
});
