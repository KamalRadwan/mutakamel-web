// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotFoundState } from "./NotFoundState";

afterEach(cleanup);

describe("NotFoundState", () => {
  it("offers a back-to-list link and no retry — retrying a deleted record can never succeed", () => {
    render(
      <NotFoundState
        title="This lead no longer exists"
        description="It was deleted, or the link is out of date."
        backLabel="Back to leads"
        backHref="/crm/leads"
      />,
    );

    const link = screen.getByRole("link", { name: "Back to leads" });
    expect(link).toHaveAttribute("href", "/crm/leads");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("prefers a caller-owned handler over the href when both are given", () => {
    const onBack = vi.fn();
    render(
      <NotFoundState
        title="Gone"
        backLabel="Back"
        backHref="/crm/leads"
        onBack={onBack}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
    screen.getByRole("button", { name: "Back" }).click();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("renders without any action when the caller has nowhere to send the user", () => {
    render(<NotFoundState title="Gone" backLabel="Back" />);
    expect(screen.getByText("Gone")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
