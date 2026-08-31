// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AmbiguousOutcomePanel,
  type AmbiguousOutcomeLabels,
} from "./AmbiguousOutcomePanel";

afterEach(cleanup);

const labels: AmbiguousOutcomeLabels = {
  title: "This write may not have applied",
  operation: "Operation",
  idempotencyKey: "Idempotency key",
  correlationId: "Correlation ID",
  retry: "Retry safely",
  dismiss: "Dismiss",
};

const KEY = "0198f2a1-4c3b-7bd2-9f10-6a1c2d3e4f50";

function renderPanel(overrides: Partial<React.ComponentProps<typeof AmbiguousOutcomePanel>> = {}) {
  const props: React.ComponentProps<typeof AmbiguousOutcomePanel> = {
    operation: "Create lead stage",
    idempotencyKey: KEY,
    description: "The request was sent but the response never arrived.",
    onRetry: vi.fn(),
    onDismiss: vi.fn(),
    labels,
    ...overrides,
  };
  return { props, ...render(<AmbiguousOutcomePanel {...props} />) };
}

describe("AmbiguousOutcomePanel", () => {
  it("carries the operation, the idempotency key and a retry-exact action", () => {
    renderPanel();
    expect(screen.getByText("Create lead stage")).toBeInTheDocument();
    expect(screen.getByText(KEY)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: labels.retry })).toBeInTheDocument();
  });

  it("renders the idempotency key in monospace, wrapping rather than overflowing", () => {
    renderPanel();
    // <bdi> so bidirectional reordering cannot mangle a Latin key inside
    // Arabic chrome, and wrap-anywhere (never break-all) so a 36-character
    // token cannot push the panel off screen — B11.
    const value = screen.getByText(KEY);
    expect(value.tagName).toBe("BDI");
    expect(value.parentElement).toHaveClass("font-mono");
    expect(value.parentElement).toHaveClass("wrap-anywhere");
    expect(value.parentElement).not.toHaveClass("break-all");
  });

  it("is a persistent in-body status region, not a transient announcement", () => {
    const { container } = renderPanel();
    const region = container.querySelector("[role='status']");
    expect(region).not.toBeNull();
    expect(region?.tagName.toLowerCase()).toBe("section");
  });

  it("shows the correlation id only when the transport captured one", () => {
    renderPanel();
    expect(screen.queryByText(labels.correlationId)).toBeNull();

    cleanup();
    renderPanel({ correlationId: "req-4821" });
    expect(screen.getByText("req-4821")).toBeInTheDocument();
  });

  it("stays until the user resolves it — dismissing is an explicit action", () => {
    const { props } = renderPanel();
    screen.getByRole("button", { name: labels.dismiss }).click();
    expect(props.onDismiss).toHaveBeenCalledOnce();
  });

  it("blocks dismissal while a retry is in flight", () => {
    const { props } = renderPanel({ retrying: true });
    screen.getByRole("button", { name: labels.dismiss }).click();
    expect(props.onDismiss).not.toHaveBeenCalled();
  });
});
