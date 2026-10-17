// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { I18nProvider } from "@/i18n/I18nContext";
import type { Uom } from "../uom-contract";
import { CreateUomDrawer, EditUomDrawer } from "./UomDrawers";

afterEach(cleanup);

function renderWithI18n(ui: React.ReactElement) {
  return render(
    <I18nProvider>
      <TooltipProvider>{ui}</TooltipProvider>
    </I18nProvider>,
  );
}

const SAMPLE_UOM: Uom = {
  id: "01890a5d-ac96-774b-bcce-b302099a8057",
  code: "CTN",
  displayName: "Master Carton",
  localizedNames: { ar: "كرتونة", en: "Carton", fr: "Carton FR" },
  status: "ACTIVE",
  version: 4,
  updatedAt: "2026-08-31T09:00:00.000Z",
};

describe("CreateUomDrawer", () => {
  it("renders the Split-Workbench preview rail, readiness checklist, and quick packaging presets", () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    renderWithI18n(
      <CreateUomDrawer
        isOpen
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText(ar.trade.uomLivePreviewTitle)).toBeInTheDocument();
    expect(screen.getByText(ar.trade.uomReadinessTitle)).toBeInTheDocument();
    expect(screen.getByText(ar.trade.uomQuickPresetsTitle)).toBeInTheDocument();

    // Clicking a quick packaging preset pre-fills the form fields
    fireEvent.click(screen.getByRole("button", { name: "CTN-24" }));
    expect(screen.getByDisplayValue("CTN-24")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("Carton of 24 pieces").length).toBeGreaterThan(0);
  });

  it("switches to the 119-unit Standard Library Picker and pre-fills a selected template", () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    renderWithI18n(
      <CreateUomDrawer
        isOpen
        initialEntryMode="library"
        existingCodes={new Set(["PCS"])}
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText(ar.trade.uomLibraryAlreadyAdded)).toBeInTheDocument();

    const useButtons = screen.getAllByRole("button", {
      name: ar.trade.uomLibraryUseTemplate,
    });
    expect(useButtons.length).toBeGreaterThan(0);
    fireEvent.click(useButtons[0]!);

    // Switches back to custom mode with the chosen starter unit populated
    expect(screen.getByDisplayValue("UNIT")).toBeInTheDocument();
  });

  it("offers one-click auto-fix suggestions when an invalid code is blurred", () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    renderWithI18n(
      <CreateUomDrawer
        isOpen
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const codeInput = screen.getByLabelText(new RegExp(ar.trade.uomCode, "u"));
    fireEvent.change(codeInput, { target: { value: "24 BOX" } });
    fireEvent.blur(codeInput);

    expect(
      screen.getByText(new RegExp(ar.trade.uomAutoFixTitle, "u")),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "BOX-24" }));
    expect(screen.getByDisplayValue("BOX-24")).toBeInTheDocument();
  });

  it("shows duplicate code resolution suggestions when isCodeTaken is true", () => {
    const onInspect = vi.fn();
    renderWithI18n(
      <CreateUomDrawer
        isOpen
        isCodeTaken
        existingCodes={new Set(["CTN"])}
        onInspectExistingCode={onInspect}
        isSubmitting={false}
        error={ar.trade.uomCodeTaken}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(false)}
      />,
    );

    expect(
      screen.getByText(ar.trade.uomDuplicateAssistantTitle),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "UOM-24" })).toBeInTheDocument();
  });
});

describe("EditUomDrawer", () => {
  it("locks the code, initializes stored extraLocales, and tracks pending revisions in the diff rail", () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    renderWithI18n(
      <EditUomDrawer
        uom={SAMPLE_UOM}
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText("If-Match: v4")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Master Carton")).toBeInTheDocument();
    // Stored French locale `fr: "Carton FR"` is loaded in the extra locales builder
    expect(screen.getByLabelText(ar.trade.uomLocale_fr)).toHaveValue("Carton FR");

    // Add Turkish (`tr`) export locale
    fireEvent.click(screen.getByRole("button", { name: "tr" }));
    const trInput = screen.getByLabelText(ar.trade.uomLocale_tr);
    fireEvent.change(trInput, { target: { value: "Koli" } });

    // Modify display name and verify diff summary updates
    const displayInput = screen.getByLabelText(
      new RegExp(ar.trade.uomDisplayName, "u"),
    );
    fireEvent.change(displayInput, { target: { value: "Export Carton" } });
    expect(screen.getAllByText("Export Carton").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: ar.trade.save }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "CTN",
        displayName: "Export Carton",
        extraLocales: { fr: "Carton FR", tr: "Koli" },
      }),
    );
  });
});
