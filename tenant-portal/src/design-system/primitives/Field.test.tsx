// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBlurValidation } from "../lib/useBlurValidation";
import { Button } from "./Button";
import { Combobox } from "./Combobox";
import { Field } from "./Field";
import { FieldControlBoundary } from "./field-control";
import { Input } from "./Input";
import { MultiSelect } from "./MultiSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { Textarea } from "./Textarea";

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

// U2/U3/U4/U5 were one defect wearing four coats: `Field` pushed its wiring
// onto its DIRECT child with cloneElement, so anything that was not itself the
// focusable element silently swallowed it. The control now CLAIMS the field
// through context, which is why every shape below works at any depth.
describe("Field reaches the control, not just the direct child", () => {
  it("names a Radix Select through its trigger, not through the Root that renders no DOM", () => {
    render(
      <Field label="Stage" hint="Pick where this lead sits." required>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">New</SelectItem>
          </SelectContent>
        </Select>
      </Field>,
    );

    // The whole point: `Select` is `SelectPrimitive.Root`, a context component
    // with no DOM node. An id handed to it lands nowhere at all.
    const trigger = screen.getByRole("combobox", { name: /Stage/ });
    expect(trigger).toHaveAttribute("aria-required", "true");

    const describedBy = trigger.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy)).toHaveTextContent("Pick where this lead sits.");
  });

  it("marks a Select invalid and describes it by the error", () => {
    render(
      <Field label="Stage" error="Pick a stage.">
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">New</SelectItem>
          </SelectContent>
        </Select>
      </Field>,
    );

    const trigger = screen.getByRole("combobox", { name: /Stage/ });
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    const describedBy = trigger.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy)).toHaveTextContent("Pick a stage.");
  });

  // U3: the password fields on /login and the action-token screen wrap their
  // input in `<div className="relative">` to position a reveal button. The
  // cloned id landed on that div and the input had no accessible name at all.
  it("names an input wrapped in a positioning div, not the div", () => {
    render(
      <Field label="Password" required>
        <div className="relative">
          <Input type="password" />
          <Button aria-label="Show password">eye</Button>
        </div>
      </Field>,
    );

    const input = screen.getByLabelText(/Password/);
    expect(input.tagName.toLowerCase()).toBe("input");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("aria-required", "true");
  });

  // U4: a feature component between the Field and the control. It neither
  // accepted nor forwarded a single prop, and did not need to start.
  it("reaches a control rendered by an intermediate component that forwards nothing", () => {
    function OpaqueEditor({ kind }: { kind: "text" | "long" }) {
      return kind === "text" ? <Input /> : <Textarea />;
    }

    render(
      <Field label="Preferred contact" hint="preferred_contact">
        <OpaqueEditor kind="text" />
      </Field>,
    );

    const input = screen.getByLabelText("Preferred contact");
    expect(input.tagName.toLowerCase()).toBe("input");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy)).toHaveTextContent("preferred_contact");
  });

  // U5: the composites put `id` on their trigger and dropped the rest.
  it("carries hint, error and required onto a Combobox trigger", () => {
    render(
      <Field label="Branch" error="Choose a branch." required>
        <Combobox
          onValueChange={() => undefined}
          options={[]}
          onSearch={() => undefined}
          placeholder="Select a branch"
          searchPlaceholder="Search branches"
          loadingLabel="Loading"
          emptyLabel="No branches"
        />
      </Field>,
    );

    const trigger = screen.getByRole("button", { name: /Branch/ });
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAttribute("aria-required", "true");
    const describedBy = trigger.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy)).toHaveTextContent("Choose a branch.");
  });

  // A MultiSelect names itself from its placeholder when it stands alone. An
  // aria-label OUTRANKS a <label for>, so keeping it inside a Field would
  // announce the placeholder in place of the field's label.
  it("lets the Field label win over a MultiSelect's own placeholder name", () => {
    render(
      <Field label="Assigned stages">
        <MultiSelect
          values={[]}
          onValuesChange={() => undefined}
          options={[{ value: "new", label: "New" }]}
          placeholder="Any stage"
          emptyLabel="None"
          moreLabel="+{count}"
          removeLabel="Remove {label}"
          overflowLabel="More stages"
        />
      </Field>,
    );

    expect(screen.getByRole("button", { name: "Assigned stages" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Any stage" })).toBeNull();
  });

  it("gives the field to exactly one control, so a second one is not a duplicate id", () => {
    render(
      <Field label="Starts at">
        <div>
          <Input type="date" />
          <FieldControlBoundary>
            <Input type="time" aria-label="Time" />
          </FieldControlBoundary>
        </div>
      </Field>,
    );

    const day = screen.getByLabelText("Starts at");
    const time = screen.getByLabelText("Time");
    expect(day).toHaveAttribute("type", "date");
    expect(time).not.toHaveAttribute("id");
    expect(document.querySelectorAll(`[id="${day.getAttribute("id")}"]`)).toHaveLength(1);
  });

  // The failure mode is invisible — nothing throws, nothing looks different,
  // the label just stops naming anything. So it is made loud in development.
  it("reports a child that never claims the label, instead of failing silently", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <Field label="Orphan">
        <span>not a control</span>
      </Field>,
    );

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Field("Orphan")'));
    spy.mockRestore();
  });

  it("stays quiet when the control is there", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <Field label="Named">
        <Input />
      </Field>,
    );

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
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
