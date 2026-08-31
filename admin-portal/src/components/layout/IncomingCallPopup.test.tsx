// @vitest-environment jsdom

import { useRef, useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IncomingCallPopup } from "./IncomingCallPopup";

describe("IncomingCallPopup", () => {
  it("focuses Answer, contains keyboard focus, and returns focus after Escape", async () => {
    const answerCall = vi.fn();
    render(<IncomingCallHarness onAnswer={answerCall} />);

    const opener = screen.getByRole("button", { name: "Simulate incoming UI state" });
    opener.focus();
    fireEvent.click(opener);

    const dialog = await screen.findByRole("alertdialog", { name: "Incoming call" });
    const dismiss = screen.getByRole("button", { name: "Dismiss alert" });
    const answer = screen.getByRole("button", { name: "Answer" });
    const decline = screen.getByRole("button", { name: "Decline" });

    expect(dialog).toBeInTheDocument();
    await waitFor(() => expect(answer).toHaveFocus());

    decline.focus();
    fireEvent.keyDown(decline, { key: "Tab" });
    expect(dismiss).toHaveFocus();

    fireEvent.keyDown(dismiss, { key: "Tab", shiftKey: true });
    expect(decline).toHaveFocus();

    fireEvent.keyDown(decline, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
    expect(answerCall).not.toHaveBeenCalled();
  });

  it("returns focus to the stable phone control when the prior target is unavailable", async () => {
    render(<AutomaticIncomingCallHarness />);

    const fallback = screen.getByText("Phone dock").closest("button");
    expect(fallback).not.toBeNull();
    const decline = await screen.findByRole("button", { name: "Decline" });
    fireEvent.keyDown(decline, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(fallback).toHaveFocus());
  });
});

function IncomingCallHarness({ onAnswer }: { onAnswer: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Simulate incoming UI state
      </button>
      <IncomingCallPopup
        open={open}
        phoneNumber="1001"
        displayName="Support desk"
        lang="en"
        onAnswer={onAnswer}
        onDecline={() => undefined}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function AutomaticIncomingCallHarness() {
  const [open, setOpen] = useState(true);
  const fallbackFocusRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={fallbackFocusRef} type="button">
        Phone dock
      </button>
      <IncomingCallPopup
        open={open}
        phoneNumber="1001"
        lang="en"
        onAnswer={() => undefined}
        onDecline={() => undefined}
        onClose={() => setOpen(false)}
        fallbackFocusRef={fallbackFocusRef}
      />
    </>
  );
}
