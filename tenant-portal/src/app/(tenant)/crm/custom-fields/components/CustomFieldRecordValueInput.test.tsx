// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Field } from "@/design-system";
import { I18nProvider } from "@/i18n/I18nContext";
import type { CustomFieldItem } from "../custom-field-contract";
import { CustomFieldRecordValueInput } from "./CustomFieldRecordValueInput";

const field: CustomFieldItem = { id: "0191e9a8-7f51-7b32-8d72-19f9217a41b3", ownerType: "LEAD",
  fieldKey: "consent", nameAr: "موافقة التواصل", nameEn: "Contact consent", type: "BOOLEAN",
  options: [], optionsCount: 0, sortOrder: 1, isActive: true, isSearchable: false, requirements: [] };
beforeEach(() => { document.cookie = "tenant_lang=en; Path=/"; });
afterEach(cleanup);
describe("Boolean custom-field values", () => {
  it("does not display an absent value as false, and explicitly selects false when stored", () => {
    const onChange = vi.fn();
    const view = (value: unknown) => <I18nProvider initialLanguage="en"><Field label={field.nameEn}>
      <CustomFieldRecordValueInput field={field} value={value} readOnly={false} disabled={false} onChange={onChange} />
    </Field></I18nProvider>;
    const { rerender } = render(view(null));
    expect(screen.getByRole("radiogroup", { name: field.nameEn })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").every((item) => item.getAttribute("aria-checked") === "false")).toBe(true);
    rerender(view(false));
    expect(screen.getByRole("radio", { name: "No" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Yes" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

