// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { useAccessibleDialog } from "./useAccessibleDialog";

function Fixture() {
  const [open, setOpen] = useState(false);
  const { dialogRef, onKeyDown, onBackdropMouseDown } = useAccessibleDialog({
    open,
    onClose: () => setOpen(false),
  });
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      {open ? (
        <div role="presentation" onMouseDown={onBackdropMouseDown}>
          <section ref={dialogRef} role="dialog" tabIndex={-1} onKeyDown={onKeyDown}>
            <button>First</button>
            <button>Last</button>
          </section>
        </div>
      ) : null}
    </>
  );
}

describe("useAccessibleDialog", () => {
  it("owns focus, traps Tab, closes on Escape, and restores focus", async () => {
    render(<Fixture />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const first = screen.getByRole("button", { name: "First" });
    const last = screen.getByRole("button", { name: "Last" });
    expect(document.activeElement).toBe(first);
    expect(document.body.style.overflow).toBe("hidden");

    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe("");
  });
});
