// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AsyncJobState, type AsyncJobStateLabels, type AsyncJobStatus } from "./AsyncJobState";

afterEach(cleanup);

const labels: AsyncJobStateLabels = {
  queued: "Queued",
  running: "Rendering",
  succeeded: "Ready",
  failed: "Render failed",
  artifactExpired: "The file expired",
  download: "Download",
  retry: "Run again",
  cancel: "Cancel",
};

function renderJob(
  status: AsyncJobStatus,
  overrides: Partial<React.ComponentProps<typeof AsyncJobState>> = {},
) {
  const props: React.ComponentProps<typeof AsyncJobState> = {
    status,
    operation: "Quotation PDF",
    labels,
    ...overrides,
  };
  return { props, ...render(<AsyncJobState {...props} />) };
}

describe("AsyncJobState", () => {
  it.each<[AsyncJobStatus, string]>([
    ["QUEUED", labels.queued],
    ["RUNNING", labels.running],
    ["SUCCEEDED", labels.succeeded],
    ["FAILED", labels.failed],
    ["ARTIFACT_EXPIRED", labels.artifactExpired],
  ])("renders %s with its own label", (status, label) => {
    renderJob(status);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText("Quotation PDF")).toBeInTheDocument();
  });

  it("marks in-flight states aria-busy and shows the pending dot, not a progress bar", () => {
    const { container } = renderJob("RUNNING");
    expect(container.querySelector("[role='status']")).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector(".dot-pending")).not.toBeNull();
    expect(container.querySelector("[role='progressbar']")).toBeNull();
  });

  it("does not claim busy once the job has settled", () => {
    const { container } = renderJob("SUCCEEDED");
    expect(container.querySelector("[role='status']")).not.toHaveAttribute("aria-busy");
    expect(container.querySelector(".dot-pending")).toBeNull();
  });

  it("offers download only on success", () => {
    const onDownload = vi.fn();
    renderJob("RUNNING", { onDownload });
    expect(screen.queryByRole("button", { name: labels.download })).toBeNull();

    cleanup();
    renderJob("SUCCEEDED", { onDownload });
    screen.getByRole("button", { name: labels.download }).click();
    expect(onDownload).toHaveBeenCalledOnce();
  });

  it("offers a re-run on failure and on an expired artifact, but never on success", () => {
    const onRetry = vi.fn();
    renderJob("FAILED", { onRetry });
    expect(screen.getByRole("button", { name: labels.retry })).toBeInTheDocument();

    cleanup();
    renderJob("ARTIFACT_EXPIRED", { onRetry });
    expect(screen.getByRole("button", { name: labels.retry })).toBeInTheDocument();

    cleanup();
    renderJob("SUCCEEDED", { onRetry });
    expect(screen.queryByRole("button", { name: labels.retry })).toBeNull();
  });

  it("offers cancel only while the job is still cancellable", () => {
    const onCancel = vi.fn();
    renderJob("QUEUED", { onCancel });
    expect(screen.getByRole("button", { name: labels.cancel })).toBeInTheDocument();

    cleanup();
    renderJob("FAILED", { onCancel });
    expect(screen.queryByRole("button", { name: labels.cancel })).toBeNull();
  });

  it("renders the failure reason the caller supplies", () => {
    renderJob("FAILED", { detail: "Template asset missing" });
    expect(screen.getByText("Template asset missing")).toBeInTheDocument();
  });
});
