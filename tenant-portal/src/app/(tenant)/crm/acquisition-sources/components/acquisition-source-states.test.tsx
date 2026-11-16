// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TooltipProvider } from "@/design-system";
import { CreateAcquisitionSourcesModal } from "./CreateAcquisitionSourcesModal";
import { DeleteAcquisitionSourcesConfirmModal } from "./DeleteAcquisitionSourcesConfirmModal";
import { SourceIconPreview } from "./SourceIconPreview";
import { AcquisitionSourceEditModal } from "./AcquisitionSourceEditModal";
import type { useAcquisitionSourceEdit } from "../hooks/useAcquisitionSourceEdit";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));
vi.mock("@/i18n/useLanguage", async (original) => ({
  ...await original<typeof import("@/i18n/useLanguage")>(),
  useDictionary: () => en, useLanguage: () => "en", useDirection: () => "ltr",
}));
beforeEach(() => vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const source = {
  id: "01902001-3000-7000-8000-000000000001", nameAr: "الموقع", nameEn: "Website", isActive: true,
  sortOrder: 1, createdAt: "2026-08-25T10:00:00.000Z", updatedAt: "2026-08-25T10:00:00.000Z", iconUrl: null,
};
function editorState(overrides: Partial<ReturnType<typeof useAcquisitionSourceEdit>> = {}): ReturnType<typeof useAcquisitionSourceEdit> {
  return {
    selected: source, draft: { nameAr: source.nameAr, nameEn: source.nameEn, isActive: source.isActive },
    setDraft: vi.fn(), error: null, namesError: null, fieldErrors: { nameAr: undefined, nameEn: undefined },
    isSaving: false, save: vi.fn(async () => {}), isDirty: false, select: vi.fn(), close: vi.fn(), ...overrides,
  };
}

describe("source state surfaces", () => {
  it("removes the destructive action from an in-use guard and offers editing", () => {
    const confirm = vi.fn();
    const edit = vi.fn();
    render(<DeleteAcquisitionSourcesConfirmModal isOpen item={source} blocked isSubmitting={false} error={en.crmAcquisitionSources.deleteInUse}
      onConfirm={confirm} onEdit={edit} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: en.crmAcquisitionSources.deleteInUseTitle })).toBeTruthy();
    expect(screen.queryByRole("button", { name: en.common.delete })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.crmAcquisitionSources.editAction }));
    expect(edit).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("renders visible bilingual labels and connects required errors to the fields", async () => {
    const submit = vi.fn();
    render(<CreateAcquisitionSourcesModal isOpen onClose={vi.fn()} onSubmit={submit} isSubmitting={false} error={null} />);
    const arabic = screen.getByRole("textbox", { name: en.crmLeadStages.arabicName });
    const english = screen.getByRole("textbox", { name: en.crmLeadStages.englishName });
    expect(arabic.getAttribute("dir")).toBe("rtl");
    expect(english.getAttribute("dir")).toBe("ltr");
    expect(screen.getByText(en.crmAcquisitionSources.iconAfterCreateHint)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.crmAcquisitionSources.save }));
    await screen.findAllByText(en.crmAcquisitionSources.arabicRequired);
    expect(arabic.getAttribute("aria-invalid")).toBe("true");
    expect(arabic.getAttribute("aria-describedby")).toBeTruthy();
    expect(submit).not.toHaveBeenCalled();
  });

  it.each([false, true])("offers a visible icon action in Edit (existing icon: %s)", (hasIcon) => {
    const onManageIcon = vi.fn();
    const editor = editorState({ selected: { ...source, iconUrl: hasIcon ? `/api/tenant/crm/v1/acquisition-sources/${source.id}/icon?v=abc` : null } });
    render(<TooltipProvider><AcquisitionSourceEditModal editor={editor} onManageIcon={onManageIcon} /></TooltipProvider>);
    fireEvent.click(screen.getByRole("button", { name: hasIcon ? en.crmAcquisitionSources.changeIcon : en.crmAcquisitionSources.addIcon }));
    expect(onManageIcon).toHaveBeenCalledOnce();
    expect(editor.save).not.toHaveBeenCalled();
  });

  it("keeps dirty source changes in Edit and explains why the icon switch is unavailable", () => {
    const onManageIcon = vi.fn();
    render(<TooltipProvider><AcquisitionSourceEditModal editor={editorState({ isDirty: true })} onManageIcon={onManageIcon} /></TooltipProvider>);
    const button = screen.getByRole("button", { name: en.crmAcquisitionSources.addIcon });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(en.crmAcquisitionSources.iconSaveChangesFirst)).toBeTruthy();
    fireEvent.click(button);
    expect(onManageIcon).not.toHaveBeenCalled();
  });

  it("replaces an unavailable image with the neutral icon without breaking the source", () => {
    render(<TooltipProvider><SourceIconPreview source={{ ...source, iconUrl: `/api/tenant/crm/v1/acquisition-sources/${source.id}/icon?v=abc` }} /></TooltipProvider>);
    fireEvent.error(screen.getByAltText(""));
    expect(screen.queryByAltText("")).toBeNull();
  });
});
