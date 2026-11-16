// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Field } from "@/design-system";
import { I18nProvider } from "@/i18n/I18nContext";
import type { CustomFieldItem } from "../../custom-fields/custom-field-contract";
import { CustomFieldValueInput } from "./CustomFieldValueInput";
import { toLocalCustomFieldDateTime } from "../custom-field-datetime";

// Radix Switch measures its thumb through ResizeObserver, which jsdom does not
// implement. The stub only has to exist.
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(cleanup);

function definition(overrides: Partial<CustomFieldItem>): CustomFieldItem {
  return {
    id: "0199a0f0-0000-7000-8000-000000000001",
    ownerType: "LEAD",
    fieldKey: "preferred_contact",
    nameAr: "طريقة التواصل",
    nameEn: "Preferred contact",
    type: "TEXT",
    optionsCount: 0,
    options: [],
    isSearchable: false,
    isActive: true,
    sortOrder: 1,
    requirements: [],
    ...overrides,
  };
}

function renderInField(field: CustomFieldItem, value: unknown = null, onChange: (next: unknown) => void = () => undefined) {
  return render(
    <I18nProvider>
      <Field
        label={field.nameAr}
        hint={field.fieldKey}
        error="هذه القيمة غير صالحة."
        required
      >
        <CustomFieldValueInput
          field={field}
          value={value}
          disabled={false}
          onChange={onChange}
        />
      </Field>
    </I18nProvider>,
  );
}

// U4 — `CustomFieldValuesPanel` wraps this editor in a `Field`, but the editor
// neither accepted nor forwarded `id` or any aria-*. Every text, number, date,
// email, phone, URL and select value in the panel was therefore unnamed. It
// still forwards nothing: the primitive it renders claims the field itself.
describe("CustomFieldValueInput inside a Field", () => {
  it("keeps labels visible and suppresses duplicate placeholders only when requested", () => {
    const field = definition({ type: "TEXT" });
    render(<I18nProvider><Field showLabel label={field.nameAr}><CustomFieldValueInput field={field} value={null} disabled={false} onChange={vi.fn()} showPlaceholder={false} /></Field></I18nProvider>);
    const control = screen.getByLabelText(field.nameAr);
    expect(control).toHaveAttribute("placeholder", "");
    expect(document.querySelector(`label[for="${control.id}"]`)).not.toHaveClass("sr-only");
  });

  it("preserves existing placeholder behavior for other forms", () => {
    const field = definition({ type: "TEXT" });
    renderInField(field);
    expect(screen.getByLabelText(new RegExp(`^${field.nameAr}`)).getAttribute("placeholder")).toBeTruthy();
  });

  it("shows a stored zoned datetime locally without writing on mount, and sends zoned edits", () => {
    const field = definition({ type: "DATETIME" });
    const original = "2026-11-04T10:30:15.125+02:00";
    const onChange = vi.fn();
    renderInField(field, original, onChange);
    const control = screen.getByLabelText(new RegExp(`^${field.nameAr}`));
    expect(control).toHaveAttribute("type", "datetime-local");
    expect(control).toHaveValue(toLocalCustomFieldDateTime(original));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(control, { target: { value: "2026-11-05T16:45" } });
    expect(onChange).toHaveBeenLastCalledWith(new Date(2026, 10, 5, 16, 45, 0, 0).toISOString());
  });

  it("emits null when a datetime is deliberately cleared", () => {
    const field = definition({ type: "DATETIME" });
    const onChange = vi.fn();
    renderInField(field, "2026-11-04T10:30:00Z", onChange);
    fireEvent.change(screen.getByLabelText(new RegExp(`^${field.nameAr}`)), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it.each(["TEXT", "TEXTAREA"] as const)("emits null when the %s input is cleared", (type) => {
    const field = definition({ type });
    const onChange = vi.fn();
    renderInField(field, "previous", onChange);

    fireEvent.change(screen.getByLabelText(new RegExp(`^${field.nameAr}`)), { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("emits null when the last multi-select option is removed", () => {
    const field = definition({
      type: "MULTI_SELECT",
      optionsCount: 1,
      options: [{ key: "email", nameAr: "بريد", nameEn: "Email", sortOrder: 1, isActive: true }],
    });
    const onChange = vi.fn();
    renderInField(field, ["email"], onChange);

    fireEvent.click(screen.getByRole("button", { name: /بريد|Email/ }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it.each([
    ["TEXT", "text"],
    ["NUMBER", "number"],
    ["DATE", "date"],
    ["EMAIL", "email"],
    ["PHONE", "tel"],
    ["URL", "url"],
  ] as const)("names the %s editor and wires its error", (type, inputType) => {
    const field = definition({ type });
    renderInField(field);

    const control = screen.getByLabelText(new RegExp(`^${field.nameAr}`));
    expect(control).toHaveAttribute("type", inputType);
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(control).toHaveAttribute("aria-required", "true");

    const describedBy = control.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy)).toHaveTextContent("هذه القيمة غير صالحة.");
  });

  it("names the TEXTAREA editor", () => {
    const field = definition({ type: "TEXTAREA" });
    renderInField(field);

    expect(screen.getByLabelText(new RegExp(`^${field.nameAr}`)).tagName.toLowerCase()).toBe(
      "textarea",
    );
  });

  it("names the SELECT editor through its trigger", () => {
    const field = definition({
      type: "SELECT",
      optionsCount: 1,
      options: [{ key: "email", nameAr: "بريد", nameEn: "Email", sortOrder: 1, isActive: true }],
    });
    renderInField(field);

    const trigger = screen.getByRole("combobox", { name: new RegExp(`^${field.nameAr}`) });
    expect(trigger).toHaveAttribute("aria-invalid", "true");
  });

  it("names the MULTI_SELECT editor through its trigger", () => {
    const field = definition({
      type: "MULTI_SELECT",
      optionsCount: 1,
      options: [{ key: "email", nameAr: "بريد", nameEn: "Email", sortOrder: 1, isActive: true }],
    });
    renderInField(field, []);

    expect(screen.getByRole("button", { name: new RegExp(`^${field.nameAr}`) })).toBeInTheDocument();
  });

  // The boolean branch used to carry its own aria-label, which would now
  // OUTRANK the Field's real <label> and announce the same string twice over.
  it("names the BOOLEAN editor from the Field's label, not a duplicate aria-label", () => {
    const field = definition({ type: "BOOLEAN" });
    renderInField(field, true);

    const control = screen.getByRole("switch", { name: new RegExp(`^${field.nameAr}`) });
    expect(control).not.toHaveAttribute("aria-label");
  });
});
