// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Field } from "../../primitives/Field";
import { Input } from "../../primitives/Input";
import { FormDrawer } from "./FormDrawer";

afterEach(cleanup);

const labels = {
  submit: "Save",
  cancel: "Cancel",
  discardTitle: "Discard?",
  discardDescription: "Changes will be lost.",
  discardConfirm: "Discard",
  discardCancel: "Keep editing",
};

// B2 — after a rejected submit, focus lands on the FIRST invalid field.
// docs/design/patterns.md#focus-after-a-failed-submit.
function TwoInvalidFields({ failOnSubmit = true }: { failOnSubmit?: boolean }) {
  const [submitted, setSubmitted] = useState(false);
  const showErrors = submitted && failOnSubmit;
  return (
    <FormDrawer
      open
      onOpenChange={() => undefined}
      title="Add stage"
      isDirty={false}
      isSubmitting={false}
      onSubmit={() => setSubmitted(true)}
      labels={labels}
    >
      <Field label="Arabic name" error={showErrors ? "Required." : undefined}>
        <Input />
      </Field>
      <Field label="English name" error={showErrors ? "Required." : undefined}>
        <Input />
      </Field>
    </FormDrawer>
  );
}

describe("FormDrawer", () => {
  it("moves focus to the first invalid field after a failed submit, not the submit button", () => {
    render(<TwoInvalidFields />);
    const submit = screen.getByRole("button", { name: "Save" });
    // Sit on the submit button first: that is exactly the failure mode this
    // rule exists to prevent — a screen-reader user hears "there are errors"
    // and is then parked on a button with no route to the wrong field.
    submit.focus();

    fireEvent.click(submit);

    expect(document.activeElement).toBe(screen.getByLabelText("Arabic name"));
    expect(document.activeElement).not.toBe(screen.getByLabelText("English name"));
  });

  it("leaves focus where the user put it when nothing is invalid", () => {
    render(<TwoInvalidFields failOnSubmit={false} />);
    const submit = screen.getByRole("button", { name: "Save" });
    submit.focus();

    fireEvent.click(submit);

    expect(document.activeElement).toBe(submit);
  });

  it("announces the summary error so a screen reader hears it without moving focus there", () => {
    render(
      <FormDrawer
        open
        onOpenChange={() => undefined}
        title="Add stage"
        isDirty={false}
        isSubmitting={false}
        onSubmit={() => undefined}
        error="The server rejected this request."
        labels={labels}
      >
        <Field label="Arabic name">
          <Input />
        </Field>
      </FormDrawer>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("The server rejected this request.");
  });
});
