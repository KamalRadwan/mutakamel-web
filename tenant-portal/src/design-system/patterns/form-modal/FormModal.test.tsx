// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { Button } from "../../primitives/Button";
import { Field } from "../../primitives/Field";
import { Input } from "../../primitives/Input";
import { FormModal, type FormModalProps } from "./FormModal";
import { FormSection } from "./FormSection";

afterEach(cleanup);

// DialogContent reads the dictionary for its close-button label.
function renderModal(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

const labels = {
  submit: "Create",
  cancel: "Cancel",
  discardTitle: "Discard?",
  discardDescription: "Changes will be lost.",
  discardConfirm: "Discard",
  discardCancel: "Keep editing",
  sections: "Form sections",
  sectionInvalid: "has errors",
  close: "Close",
};

function Modal(overrides: Partial<FormModalProps> = {}) {
  const props: FormModalProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: "Add lead",
    isDirty: false,
    isSubmitting: false,
    onSubmit: vi.fn(),
    labels,
    children: (
      <FormSection id="company" title="Company">
        <Field label="Company name">
          <Input />
        </Field>
      </FormSection>
    ),
    ...overrides,
  };
  return <FormModal {...props} />;
}

describe("FormModal is a real form", () => {
  it("submits on Enter from inside a field, not only on a click", () => {
    const onSubmit = vi.fn();
    renderModal(<Modal onSubmit={onSubmit} />);

    const input = screen.getByLabelText("Company name");
    const form = input.closest("form");
    expect(form).not.toBeNull();
    // The two things a browser needs for implicit submission: the field is IN
    // a form, and that form has a submit button.
    expect(form).toContainElement(screen.getByRole("button", { name: "Create" }));

    form!.requestSubmit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("types the footer buttons so only Create submits", () => {
    renderModal(<Modal />);
    expect(screen.getByRole("button", { name: "Create" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("type", "button");
  });

  it("refuses an Enter submit while submit is blocked", () => {
    const onSubmit = vi.fn();
    renderModal(<Modal onSubmit={onSubmit} submitDisabled />);
    screen.getByLabelText("Company name").closest("form")!.requestSubmit();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("FormModal dirty guard", () => {
  it("asks before discarding, and closes only once the user confirms", () => {
    const onOpenChange = vi.fn();
    renderModal(<Modal isDirty onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText("Discard?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes straight away when nothing was typed", () => {
    const onOpenChange = vi.fn();
    renderModal(<Modal onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

// The same rule FormDrawer carries — both take it from useFormShell, and this
// is the assertion that keeps the second surface honest.
describe("FormModal focus after a failed submit", () => {
  function TwoInvalidFields() {
    const [submitted, setSubmitted] = useState(false);
    return (
      <FormModal
        open
        onOpenChange={() => undefined}
        title="Add lead"
        isDirty={false}
        isSubmitting={false}
        onSubmit={() => setSubmitted(true)}
        labels={labels}
      >
        <FormSection id="company" title="Company">
          <Field label="Company name" error={submitted ? "Required." : undefined}>
            <Input />
          </Field>
          <Field label="Legal name" error={submitted ? "Required." : undefined}>
            <Input />
          </Field>
        </FormSection>
      </FormModal>
    );
  }

  it("lands on the first invalid field, not on the submit button", () => {
    renderModal(<TwoInvalidFields />);
    const submit = screen.getByRole("button", { name: "Create" });
    submit.focus();

    fireEvent.click(submit);

    expect(document.activeElement).toBe(screen.getByLabelText("Company name"));
  });

  it("announces a write failure without stealing focus for it", () => {
    renderModal(<Modal error="The server rejected this request." />);
    expect(screen.getByRole("alert")).toHaveTextContent("The server rejected this request.");
  });
});

describe("FormModal section index", () => {
  const sections = [
    { id: "company", label: "Company" },
    { id: "contacts", label: "Contacts", invalid: true },
  ];

  it("names the index and marks the section that has errors", () => {
    renderModal(
      <Modal sections={sections}>
        <FormSection id="company" title="Company">
          <Field label="Company name">
            <Input />
          </Field>
        </FormSection>
        <FormSection id="contacts" title="Contacts">
          <Field label="Contact name">
            <Input />
          </Field>
        </FormSection>
      </Modal>,
    );

    const nav = screen.getByRole("navigation", { name: "Form sections" });
    expect(nav).toBeInTheDocument();
    // The invalid section says so to a screen reader, not only in colour.
    expect(screen.getByText("has errors")).toBeInTheDocument();
  });

  it("moves focus to a section's heading when its index entry is used", () => {
    renderModal(
      <Modal sections={sections}>
        <FormSection id="company" title="Company">
          <Field label="Company name">
            <Input />
          </Field>
        </FormSection>
        <FormSection id="contacts" title="Contacts">
          <Field label="Contact name">
            <Input />
          </Field>
        </FormSection>
      </Modal>,
    );

    const nav = screen.getByRole("navigation", { name: "Form sections" });
    const entry = within(nav).getByRole("button", { name: /Contacts/ });
    fireEvent.click(entry);

    // Scrolling alone moves the eye and leaves the keyboard behind.
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Contacts", level: 3 }),
    );
  });
});

describe("FormModal card size", () => {
  const sections = [{ id: "company", label: "Company" }];

  it("drops the section index, which the full size still renders", () => {
    const card = renderModal(<Modal size="card" sections={sections} />);
    expect(
      screen.queryByRole("navigation", { name: "Form sections" }),
    ).not.toBeInTheDocument();

    card.unmount();

    renderModal(<Modal sections={sections} />);
    expect(screen.getByRole("navigation", { name: "Form sections" })).toBeInTheDocument();
  });

  it("still renders the form and its actions at both sizes", () => {
    for (const size of ["card", "full"] as const) {
      const rendered = renderModal(<Modal size={size} sections={sections} />);

      const input = screen.getByLabelText("Company name");
      expect(input.closest("form")).not.toBeNull();
      expect(screen.getByRole("button", { name: "Create" })).toHaveAttribute("type", "submit");
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();

      rendered.unmount();
    }
  });

  // The card is `DialogContent size="2xl"` with its own layout overridden, so
  // the size only works if tailwind-merge actually drops what `2xl` brings.
  it("resolves the centred card's own grid and padding away", () => {
    renderModal(<Modal size="card" />);

    const content = screen.getByRole("dialog");
    expect(content).toHaveClass("flex", "flex-col", "gap-0", "p-0", "max-w-[672px]");
    expect(content).not.toHaveClass("grid");
    expect(content).not.toHaveClass("gap-4");
    expect(content).not.toHaveClass("p-6");
  });
});

// A section index entry does not double as a submit button — every button in a
// form defaults to type="submit" without the Button primitive's own default.
describe("FormModal index entries are not submit buttons", () => {
  it("does not submit when an index entry is clicked", () => {
    const onSubmit = vi.fn();
    renderModal(
      <Modal
        onSubmit={onSubmit}
        sections={[{ id: "company", label: "Company" }]}
        footerLeading={<Button onClick={() => undefined}>Reset</Button>}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Form sections" });
    fireEvent.click(within(nav).getByRole("button", { name: /Company/ }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
