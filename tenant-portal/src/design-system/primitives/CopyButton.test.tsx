// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "./CopyButton";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const CORRELATION_ID = "0f9c0a2e-7c1e-4a0f-9a5f-1f2b3c4d5e6f";

function stubClipboard(writeText: () => Promise<void>) {
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
}

function labels() {
  return { copyLabel: "Copy correlation ID", copiedLabel: "Copied", failedLabel: "Could not copy" };
}

describe("CopyButton", () => {
  it("writes the value verbatim, with no trimming or normalisation", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    render(<CopyButton value={CORRELATION_ID} {...labels()} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy correlation ID" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(CORRELATION_ID));
  });

  it("confirms through an aria-live region rather than by renaming the button", async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    render(<CopyButton value={CORRELATION_ID} {...labels()} />);

    const live = screen.getByRole("status");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toHaveTextContent("");

    fireEvent.click(screen.getByRole("button", { name: "Copy correlation ID" }));
    await waitFor(() => expect(live).toHaveTextContent("Copied"));
    // The button keeps its name, so it is not re-announced as a new control.
    expect(screen.getByRole("button", { name: "Copy correlation ID" })).toBeInTheDocument();
  });

  it("never claims success when the clipboard write actually failed", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("NotAllowedError")));
    render(<CopyButton value={CORRELATION_ID} {...labels()} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy correlation ID" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Could not copy"));
    expect(screen.getByRole("status")).not.toHaveTextContent("Copied");
  });

  it("renders icon-only by default and labelled on request", () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    const { rerender } = render(<CopyButton value={CORRELATION_ID} {...labels()} />);
    expect(screen.getByRole("button", { name: "Copy correlation ID" })).toHaveTextContent("");

    rerender(<CopyButton value={CORRELATION_ID} {...labels()} showLabel />);
    expect(screen.getByRole("button", { name: "Copy correlation ID" })).toHaveTextContent(
      "Copy correlation ID",
    );
  });
});
