// @vitest-environment jsdom

import { useMemo, useRef } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  useOperatorRefreshGuard,
  type OperatorRefreshPauseReason,
} from "./useOperatorRefreshGuard";

interface HarnessProps {
  modalOrMenuOpen?: boolean;
  operatorPaused?: boolean;
  activeCall?: boolean;
}

function GuardHarness(props: HarnessProps) {
  const regionRef = useRef<HTMLElement>(null);
  const regionRefs = useMemo(() => [regionRef], []);
  const guard = useOperatorRefreshGuard({
    ownedRegionRefs: regionRefs,
    ...props,
  });

  return (
    <div>
      <section ref={regionRef}>
        <label>
          Owned editor
          <input />
        </label>
        <button type="button">Owned action</button>
        <button type="button" data-refresh-disruptive-focus>
          Disruptive owned action
        </button>
        <span>Selectable dashboard text</span>
      </section>
      <button type="button">Outside action</button>
      <output data-testid="paused">{String(guard.isPaused)}</output>
      <output data-testid="automatic">
        {String(guard.isAutomaticallyPaused)}
      </output>
      <output data-testid="reasons">{guard.pauseReasons.join(",")}</output>
    </div>
  );
}

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  vi.restoreAllMocks();
});

describe("useOperatorRefreshGuard", () => {
  it("ignores ordinary action focus but pauses disruptive focus or editing inside an owned region", async () => {
    render(<GuardHarness />);

    await focus(
      screen.getByRole("button", { name: "Outside action" }),
    );
    expectPaused(false, []);

    await focus(screen.getByRole("button", { name: "Owned action" }));
    expectPaused(false, []);

    await focus(
      screen.getByRole("button", { name: "Disruptive owned action" }),
    );
    expectPaused(true, ["region-focus"]);

    await focus(screen.getByRole("textbox", { name: "Owned editor" }));
    expectPaused(true, ["active-editing"]);

    await focus(
      screen.getByRole("button", { name: "Outside action" }),
    );
    expectPaused(false, []);
  });

  it("pauses while text is selected inside the owned region", () => {
    render(<GuardHarness />);
    const textNode = screen.getByText("Selectable dashboard text").firstChild;
    expect(textNode).not.toBeNull();

    const range = document.createRange();
    range.setStart(textNode!, 0);
    range.setEnd(textNode!, 10);
    act(() => {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
    expectPaused(true, ["region-selection"]);

    act(() => {
      window.getSelection()?.removeAllRanges();
      document.dispatchEvent(new Event("selectionchange"));
    });
    expectPaused(false, []);
  });

  it("uses typed overlay, operator, and active-call signals", () => {
    const { rerender } = render(<GuardHarness modalOrMenuOpen />);
    expectPaused(true, ["modal-or-menu"]);

    rerender(<GuardHarness activeCall />);
    expectPaused(true, ["active-call"]);

    rerender(<GuardHarness operatorPaused />);
    expectPaused(true, ["operator"]);
    expect(screen.getByTestId("automatic")).toHaveTextContent("false");

    rerender(<GuardHarness />);
    expectPaused(false, []);
  });

  it("pauses while the page is hidden and resumes when visible", () => {
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("visible");
    render(<GuardHarness />);
    expectPaused(false, []);

    act(() => {
      visibility.mockReturnValue("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expectPaused(true, ["page-hidden"]);

    act(() => {
      visibility.mockReturnValue("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expectPaused(false, []);
  });
});

function expectPaused(
  paused: boolean,
  reasons: readonly OperatorRefreshPauseReason[],
): void {
  expect(screen.getByTestId("paused")).toHaveTextContent(String(paused));
  expect(screen.getByTestId("reasons")).toHaveTextContent(reasons.join(","));
}

async function focus(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.focus();
    await Promise.resolve();
  });
}
