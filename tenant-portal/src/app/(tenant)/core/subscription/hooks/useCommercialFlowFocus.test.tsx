// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useCommercialFlowFocus } from "./useCommercialFlowFocus";

afterEach(cleanup);

function Flow({ phase, previewId, enabled = true }: { phase?: string; previewId?: string; enabled?: boolean }) {
  const headingRef = useCommercialFlowFocus(phase, previewId, enabled);
  return <><h1 ref={headingRef} tabIndex={-1}>Change</h1><button>Action</button></>;
}

it("restores heading focus through preparation, quote, apply and another change", () => {
  const { rerender } = render(<Flow phase="idle" />);
  const action = screen.getByRole("button");
  expect(screen.getByRole("heading")).not.toHaveFocus();
  for (const [phase, previewId] of [
    ["pending", undefined], ["saved", undefined], ["pending", undefined],
    ["saved", "quote-1"], ["saved", "quote-2"], ["pending", "quote-2"],
    ["complete", "quote-2"], ["idle", undefined],
  ]) {
    action.focus();
    rerender(<Flow phase={phase} previewId={previewId} />);
    expect(screen.getByRole("heading")).toHaveFocus();
  }
});

it("does not steal focus on unchanged renders, initial restoration or denied access", () => {
  const { rerender } = render(<Flow phase="saved" previewId="quote-1" />);
  const action = screen.getByRole("button");
  action.focus();
  fireEvent.click(action);
  rerender(<Flow phase="saved" previewId="quote-1" />);
  expect(action).toHaveFocus();
  rerender(<Flow phase="complete" enabled={false} />);
  expect(action).toHaveFocus();
  rerender(<Flow phase="idle" />);
  expect(action).toHaveFocus();
});
