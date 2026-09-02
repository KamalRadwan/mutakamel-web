// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { Button } from "../../primitives/Button";
import { Field } from "../../primitives/Field";
import { Input } from "../../primitives/Input";
import { FormDrawer } from "./FormDrawer";

afterEach(cleanup);

// SheetContent reads the dictionary for its close-button label.
function renderDrawer(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

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
    renderDrawer(<TwoInvalidFields />);
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
    renderDrawer(<TwoInvalidFields failOnSubmit={false} />);
    const submit = screen.getByRole("button", { name: "Save" });
    submit.focus();

    fireEvent.click(submit);

    expect(document.activeElement).toBe(submit);
  });

  it("announces the summary error so a screen reader hears it without moving focus there", () => {
    renderDrawer(
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

// U1 — this was a SheetContent wrapping a div, with the save button on an
// onClick. Enter did nothing, and 75 create/edit drawers had no form semantics
// at all.
describe("FormDrawer is a real form", () => {
  function OneField({ onSubmit, submitDisabled }: { onSubmit: () => void; submitDisabled?: boolean }) {
    const [value, setValue] = useState("");
    return (
      <FormDrawer
        open
        onOpenChange={() => undefined}
        title="Add stage"
        isDirty={false}
        isSubmitting={false}
        onSubmit={onSubmit}
        submitDisabled={submitDisabled}
        labels={labels}
      >
        <Field label="Arabic name">
          <Input value={value} onChange={(event) => setValue(event.target.value)} />
        </Field>
        <Button onClick={() => undefined}>Add a row</Button>
      </FormDrawer>
    );
  }

  it("submits on Enter from inside a field, not only on a click", () => {
    const onSubmit = vi.fn();
    renderDrawer(<OneField onSubmit={onSubmit} />);

    const input = screen.getByLabelText("Arabic name");
    fireEvent.change(input, { target: { value: "مرحلة" } });

    const form = input.closest("form");
    expect(form).not.toBeNull();
    // The two things a browser needs for implicit submission: the field is IN a
    // form, and that form has a submit button. Both were missing before — the
    // drawer was a div and the save button an onClick.
    expect(form).toContainElement(screen.getByRole("button", { name: "Save" }));

    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    // jsdom does not synthesise implicit submission from a keypress, so the
    // Enter above cannot assert on its own. requestSubmit() runs the real
    // submission algorithm the key would trigger — unlike fireEvent.submit,
    // which just dispatches the event and would pass on a form that had no
    // submit button at all.
    form!.requestSubmit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("puts the fields inside the form, with submit and cancel typed correctly", () => {
    renderDrawer(<OneField onSubmit={() => undefined} />);

    const form = screen.getByLabelText("Arabic name").closest("form");
    expect(form).not.toBeNull();
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("type", "button");
    expect(form).toContainElement(screen.getByRole("button", { name: "Save" }));
  });

  // Every button element in a form defaults to type="submit". Without Button's own
  // default, wrapping the drawer in a form would have turned every add-a-row,
  // remove-a-chip and reveal-password control into a save button.
  it("does not submit when an ordinary body button is clicked", () => {
    const onSubmit = vi.fn();
    renderDrawer(<OneField onSubmit={onSubmit} />);

    expect(screen.getByRole("button", { name: "Add a row" })).toHaveAttribute("type", "button");
    fireEvent.click(screen.getByRole("button", { name: "Add a row" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("refuses an Enter submit while the submit button is blocked", () => {
    const onSubmit = vi.fn();
    renderDrawer(<OneField onSubmit={onSubmit} submitDisabled />);

    screen.getByLabelText("Arabic name").closest("form")!.requestSubmit();

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
