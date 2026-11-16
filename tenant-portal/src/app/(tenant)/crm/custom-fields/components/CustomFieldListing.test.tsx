// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataTable, TooltipProvider } from "@/design-system";
import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import type { CustomFieldItem } from "../custom-field-contract";
import { useCustomFieldColumns } from "./useCustomFieldColumns";

const field: CustomFieldItem = { id: "0191e9a8-7f51-7b32-8d72-19f9217a41b3", ownerType: "LEAD",
  fieldKey: "preferred_channel", nameAr: "قناة التواصل", nameEn: "Preferred channel", type: "TEXT",
  options: [], optionsCount: 0, sortOrder: 1, isActive: true, isSearchable: false, requirements: [] };
const edit = vi.fn();
const requirements = vi.fn();
function Listing({ active = true }: { active?: boolean }) {
  const columns = useCustomFieldColumns({ canManage: true, busy: false, edit, requirements });
  return <DataTable isLoading={false} columns={columns} rows={[{ ...field, isActive: active }]} rowKey={(item) => item.id}
    showRowNumbers={false} labels={{ retry: en.common.retry, errorTitle: "Error", emptyTitle: "Empty",
      selectAll: "Select all", selectRow: "Select", sortAscending: "Ascending", sortDescending: "Descending",
      notSorted: "Not sorted", pagination: { previous: "Previous", next: "Next", summary: () => "" } }} />;
}
beforeEach(() => { document.cookie = "tenant_lang=en; Path=/"; });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("Custom Fields listing", () => {
  it("keeps each bilingual name and its direction in a separate column", () => {
    render(<I18nProvider initialLanguage="en"><TooltipProvider><Listing /></TooltipProvider></I18nProvider>);
    expect(screen.getByRole("columnheader", { name: "Arabic name" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "English name" })).toBeInTheDocument();
    expect(screen.getByText(field.nameAr)).toHaveAttribute("dir", "rtl");
    expect(screen.getByText(field.nameEn)).toHaveAttribute("dir", "ltr");
    expect(screen.getByText(field.fieldKey)).toHaveAttribute("dir", "ltr");
    expect(screen.getByText(field.nameAr).closest("td")).not.toBe(screen.getByText(field.nameEn).closest("td"));
  });
  it("permits editing an inactive field while refusing to change its requirement rules", () => {
    render(<I18nProvider initialLanguage="en"><TooltipProvider><Listing active={false} /></TooltipProvider></I18nProvider>);
    const rules = screen.getByRole("button", { name: /Field requirements:/ });
    expect(rules).toBeDisabled();
    fireEvent.click(rules);
    expect(requirements).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Edit custom field:/ }));
    expect(edit).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
  });
});

