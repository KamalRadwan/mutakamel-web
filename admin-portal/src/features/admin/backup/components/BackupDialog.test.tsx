// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button, Input } from "@/design-system";
import { BackupDialog } from "./BackupDialog";

vi.mock("@/i18n/I18nContext", () => {
  const value = {
    lang: "en",
    dir: "ltr",
    t: { common: { cancel: "Cancel", close: "Close" } },
  };
  return {
    useI18n: () => value,
    useOptionalI18n: () => value,
  };
});

afterEach(() => cleanup());

describe("BackupDialog", () => {
  it("focuses a persistent command error and returns focus when closed", async () => {
    render(<DialogHarness />);

    const trigger = screen.getByRole("button", { name: "Open command" });
    trigger.focus();
    fireEvent.click(trigger);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The command was rejected.");
    expect(alert).toHaveTextContent("BACKUP.INVALID_STATE");
    await waitFor(() => expect(alert).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

function DialogHarness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>Open command</Button>
      <BackupDialog
        open={open}
        title="Run backup command"
        description="Review the command before submitting."
        confirmLabel="Run command"
        onClose={() => setOpen(false)}
        onConfirm={() => undefined}
        error={{
          isNormalized: true,
          httpStatus: 409,
          errorCategory: "CONFLICT",
          errorCode: "BACKUP.INVALID_STATE",
          correlationId: "01900000-0000-7000-8000-000000000001",
          message: "The command was rejected.",
        }}
      >
        <Input aria-label="Audit reason" />
      </BackupDialog>
    </>
  );
}
