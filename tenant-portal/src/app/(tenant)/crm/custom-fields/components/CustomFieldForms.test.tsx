// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { setLanguage } from "@/i18n/useLanguage";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { parseCrmCustomField } from "../custom-field-contract";
import { useCustomFieldEdit } from "../hooks/useCustomFieldEdit";
import { useCustomFieldRequirements } from "../hooks/useCustomFieldRequirements";
import { CreateCrmCustomFieldsModal } from "./CreateCrmCustomFieldsModal";
import { CustomFieldEditDrawer } from "./CustomFieldEditDrawer";
import { CustomFieldRequirementsDrawer } from "./CustomFieldRequirementsDrawer";

const { patch, post } = vi.hoisted(() => ({ patch: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/axiosClient", async (original) => ({
  ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: { patch, post },
}));
vi.mock("@/design-system", async (original) => ({
  ...await original<typeof import("@/design-system")>(), useToast: () => ({ success: vi.fn() }),
}));

const field = parseCrmCustomField({
  id: "0191e9a8-7f51-7b32-8d72-19f9217a41b3", ownerType: "OPPORTUNITY", fieldKey: "channel",
  nameAr: "القناة", nameEn: "Channel", type: "SELECT",
  options: [{ key: "web", nameAr: "الموقع", nameEn: "Website", sortOrder: 1, isActive: true }],
  isActive: true, isSearchable: false, sortOrder: 1,
  requirements: [{ operation: "UPDATE", entityScope: "OPPORTUNITY", isRequired: true }],
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });
beforeEach(async () => { await setLanguage("en"); });
beforeAll(() => vi.stubGlobal("ResizeObserver", class {
  observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn();
}));
afterAll(() => vi.unstubAllGlobals());

function createModal(onClose = vi.fn(), onSubmit = vi.fn().mockResolvedValue(false)) {
  render(<I18nProvider initialLanguage="en"><CreateCrmCustomFieldsModal isOpen isSubmitting={false}
    error={null} onClose={onClose} onSubmit={onSubmit} /></I18nProvider>);
  return { onClose, onSubmit };
}

function EditHarness() {
  const editor = useCustomFieldEdit(true, vi.fn(), vi.fn().mockResolvedValue(true));
  return <><button onClick={() => editor.select(field)}>Open edit</button><CustomFieldEditDrawer key={editor.selected?.id ?? "closed"} editor={editor} /></>;
}

function RulesHarness() {
  const requirements = useCustomFieldRequirements(true, vi.fn().mockResolvedValue([field]));
  return <><button onClick={() => requirements.select(field)}>Open rules</button><CustomFieldRequirementsDrawer requirements={requirements} /></>;
}

describe("custom-field centered forms", () => {
  it("guards dirty create dismissal and does not submit or save a preview", async () => {
    const { onClose, onSubmit } = createModal();
    const dialog = await screen.findByRole("dialog", { name: en.crmCustomFields.addTitle });
    expect(dialog).toHaveClass("max-w-[940px]");
    fireEvent.change(within(dialog).getByLabelText(en.crmLeadStages.englishName, { exact: false }), { target: { value: "Channel" } });
    expect(screen.getByText(en.crmCustomFields.previewHint)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: en.common.cancel }));
    const confirm = await screen.findByRole("alertdialog");
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: en.common.discardConfirm }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it("reveals an invalid collapsed metadata field after submit", async () => {
    const { onSubmit } = createModal();
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(en.crmLeadStages.arabicName, { exact: false }), { target: { value: "القناة" } });
    fireEvent.change(within(dialog).getByLabelText(en.crmLeadStages.englishName, { exact: false }), { target: { value: "Channel" } });
    fireEvent.change(within(dialog).getByLabelText(en.crmCustomFields.key, { exact: false }), { target: { value: "channel" } });
    fireEvent.click(within(dialog).getByRole("button", { name: new RegExp(en.crmCustomFields.additionalSettings) }));
    fireEvent.change(within(dialog).getByLabelText(en.crmCustomFields.displayOrder), { target: { value: "0" } });
    fireEvent.click(within(dialog).getByRole("button", { name: new RegExp(en.crmCustomFields.additionalSettings) }));
    expect(within(dialog).queryByLabelText(en.crmCustomFields.displayOrder)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: en.crmCustomFields.create }));
    expect(await within(dialog).findByLabelText(en.crmCustomFields.displayOrder)).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("opens editing in a centered modal with saved option identity intact", async () => {
    render(<I18nProvider initialLanguage="en"><EditHarness /></I18nProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Open edit" }));
    const dialog = await screen.findByRole("dialog", { name: en.crmCustomFields.editTitle });
    expect(dialog).toHaveClass("max-w-[940px]");
    expect(within(dialog).getByLabelText(en.crmCustomFields.optionKey, { exact: false })).toHaveAttribute("readonly");
    expect(within(dialog).queryByRole("button", { name: new RegExp(en.crmCustomFields.removeOption) })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: en.crmCustomFields.save })).toBeDisabled();
  });

  it("keeps scoped rules readonly and Opportunity conversion unavailable", async () => {
    render(<I18nProvider initialLanguage="en"><RulesHarness /></I18nProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Open rules" }));
    const dialog = await screen.findByRole("dialog", { name: en.crmCustomFields.requirementsTitle });
    expect(dialog).toHaveClass("max-w-[672px]");
    expect(within(dialog).getByRole("switch", { name: en.crmCustomFields.requirementOperations.CONVERT })).toBeDisabled();
    expect(within(dialog).getByText(en.crmCustomFields.scopedRulesReadOnly)).toBeInTheDocument();
    expect(within(dialog).getByText(en.crmCustomFields.requirementsSaveNote)).toBeInTheDocument();
    const updateSwitch = within(dialog).getByRole("switch", { name: en.crmCustomFields.requirementOperations.UPDATE });
    expect(updateSwitch).toHaveAttribute("aria-checked", "false");
    expect(post).not.toHaveBeenCalled();
  });

  it("recovers an options conflict without discarding renamed labels", async () => {
    patch.mockRejectedValue(new TenantApiClientError("Rejected", {
      status: 409, statusText: "Conflict", headers: new Headers(), data: { code: "CUSTOM_FIELD_OPTION_IN_USE" },
    }));
    render(<I18nProvider initialLanguage="en"><EditHarness /></I18nProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Open edit" }));
    const dialog = await screen.findByRole("dialog");
    const option = within(dialog).getByRole("group", { name: en.crmCustomFields.optionNumber(1) });
    const optionName = within(option).getByLabelText(en.crmLeadStages.englishName, { exact: false });
    fireEvent.change(optionName, { target: { value: "Renamed website" } });
    fireEvent.click(within(option).getByRole("checkbox", { name: en.common.active }));
    fireEvent.click(within(dialog).getByRole("button", { name: en.crmCustomFields.save }));
    expect(await within(dialog).findByText(en.crmCustomFields.optionInUse)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: en.crmCustomFields.save })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: en.crmCustomFields.restoreOptionActivity }));
    expect(optionName).toHaveValue("Renamed website");
    expect(within(option).getByRole("checkbox", { name: en.common.active })).toHaveAttribute("aria-checked", "true");
    expect(within(dialog).getByRole("button", { name: en.crmCustomFields.save })).toBeEnabled();
  });
});
