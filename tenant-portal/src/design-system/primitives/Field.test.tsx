// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useBlurValidation } from "../lib/useBlurValidation";
import { Button } from "./Button";
import { Field } from "./Field";
import { Input } from "./Input";

afterEach(cleanup);

describe("Field", () => {
  it("wires a stable htmlFor/id pair so the label targets the control", () => {
    render(
      <Field label="Email">
        <Input type="email" />
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toBeInstanceOf(HTMLInputElement);
  });

  it("wires aria-describedby to hint text when there is no error", () => {
    render(
      <Field label="Email" hint="We will never share this.">
        <Input type="email" />
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent("We will never share this.");
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("wires aria-describedby to the error and sets aria-invalid when an error is present", () => {
    render(
      <Field label="Email" hint="We will never share this." error="Enter a valid email address.">
        <Input type="email" />
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");

    const describedBy = input.getAttribute("aria-describedby") ?? "";
    const describedIds = describedBy.split(" ");
    const describedText = describedIds.map((id) => document.getElementById(id)?.textContent).join(" ");
    expect(describedText).toContain("Enter a valid email address.");
  });

  it("marks the control aria-required when required is set", () => {
    render(
      <Field label="Email" required>
        <Input type="email" />
      </Field>,
    );
    expect(screen.getByLabelText(/Email/)).toHaveAttribute("aria-required", "true");
  });

  // B16 — readOnly and disabled are different states and must not be
  // conflated. docs/design/primitives.md#readonly-is-not-disabled.
  it("renders readOnly as readOnly, never as disabled", () => {
    render(
      <Field label="Branch" readOnly hint="Editable in Organization settings.">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Branch");
    expect(input).toHaveAttribute("aria-readonly", "true");
    expect(input).toHaveProperty("readOnly", true);
    expect(input).not.toBeDisabled();
    expect(screen.getByText("Editable in Organization settings.")).toBeInTheDocument();
  });

  it("leaves a normal field untouched by the readOnly wiring", () => {
    render(
      <Field label="Branch">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Branch");
    expect(input).not.toHaveAttribute("aria-readonly");
    expect(input).toHaveProperty("readOnly", false);
  });
});

// B10 — validate on blur, never on keystroke.
// docs/design/primitives.md#validate-on-blur-not-on-keystroke.
describe("useBlurValidation", () => {
  function EmailField() {
    const [value, setValue] = useState("");
    const validation = useBlurValidation(value, (next) =>
      next.includes("@") ? undefined : "Enter a valid email address.",
    );
    return (
      <Field label="Email" error={validation.error}>
        <Input value={value} onChange={(event) => setValue(event.target.value)} {...validation.fieldProps} />
      </Field>
    );
  }

  const ERROR = "Enter a valid email address.";

  it("stays silent while the user is still typing", () => {
    render(<EmailField />);
    const input = screen.getByLabelText("Email");
    fireEvent.change(input, { target: { value: "a" } });
    expect(screen.queryByText(ERROR)).toBeNull();
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("shows the error on blur, then clears it live once the value is valid", () => {
    render(<EmailField />);
    const input = screen.getByLabelText("Email");
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.blur(input);
    expect(screen.getByText(ERROR)).toBeInTheDocument();

    // Already errored, so it re-validates on change rather than making the
    // user blur again to be told they fixed it.
    fireEvent.change(input, { target: { value: "a@example.com" } });
    expect(screen.queryByText(ERROR)).toBeNull();
  });

  it("does not arm the field when it blurs valid", () => {
    render(<EmailField />);
    const input = screen.getByLabelText("Email");
    fireEvent.change(input, { target: { value: "a@b.com" } });
    fireEvent.blur(input);
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.queryByText(ERROR)).toBeNull();
  });

  it("reveal() shows the error on a field that was never blurred", () => {
    function SubmitForm() {
      const [value, setValue] = useState("");
      const validation = useBlurValidation(value, (next) => (next ? undefined : "Required."));
      return (
        <>
          <Field label="Name" error={validation.error}>
            <Input value={value} onChange={(event) => setValue(event.target.value)} {...validation.fieldProps} />
          </Field>
          <Button onClick={validation.reveal}>Save</Button>
        </>
      );
    }
    render(<SubmitForm />);
    expect(screen.queryByText("Required.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Required.")).toBeInTheDocument();
  });
});
