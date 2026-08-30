// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BulkResultPanel, type BulkFailure, type BulkResultPanelLabels } from "./BulkResultPanel";

afterEach(cleanup);

const labels: BulkResultPanelLabels = {
  title: "Bulk delete finished",
  summary: "38 of 50 succeeded",
  failuresHeading: "Failed",
  retryFailed: "Retry the 12 that failed",
  dismiss: "Dismiss",
};

const failures: BulkFailure[] = [
  { id: "a", label: "Layla Hassan", reason: "Converted leads cannot be deleted" },
  { id: "b", label: "Omar Nasser", reason: "Owned by another branch" },
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof BulkResultPanel>> = {}) {
  const props: React.ComponentProps<typeof BulkResultPanel> = {
    succeededCount: 38,
    failures,
    onDismiss: vi.fn(),
    labels,
    ...overrides,
  };
  return { props, ...render(<BulkResultPanel {...props} />) };
}

describe("BulkResultPanel", () => {
  it("shows the partial-success summary AND every failure with its own reason", () => {
    renderPanel();
    expect(screen.getByText("38 of 50 succeeded")).toBeInTheDocument();
    expect(screen.getByText("Layla Hassan")).toBeInTheDocument();
    expect(screen.getByText("Converted leads cannot be deleted")).toBeInTheDocument();
    expect(screen.getByText("Omar Nasser")).toBeInTheDocument();
    expect(screen.getByText("Owned by another branch")).toBeInTheDocument();
  });

  it("is an in-body persistent region, not a toast", () => {
    const { container } = renderPanel();
    const region = container.querySelector("[role='status']");
    expect(region?.tagName.toLowerCase()).toBe("section");
  });

  it("drops the failure list and the retry action when everything succeeded", () => {
    renderPanel({ succeededCount: 50, failures: [] });
    expect(screen.queryByText(labels.failuresHeading)).toBeNull();
    expect(screen.queryByRole("button", { name: labels.retryFailed })).toBeNull();
    expect(screen.getByRole("button", { name: labels.dismiss })).toBeInTheDocument();
  });

  it("reads a run where nothing succeeded as a failure, not a partial success", () => {
    const { container } = renderPanel({ succeededCount: 0 });
    expect(container.querySelector("[role='status']")?.className).toContain("border-negative-200");

    cleanup();
    const partial = renderPanel({ succeededCount: 38 });
    expect(partial.container.querySelector("[role='status']")?.className).toContain(
      "border-caution-200",
    );
  });

  it("retries only the failures when the caller supports it", () => {
    const onRetryFailed = vi.fn();
    renderPanel({ onRetryFailed });
    screen.getByRole("button", { name: labels.retryFailed }).click();
    expect(onRetryFailed).toHaveBeenCalledOnce();
  });
});
