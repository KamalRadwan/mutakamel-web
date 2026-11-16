// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { DETAIL_WITH_REVISION } from "../hooks/quotation-composer.test-fixtures";
import { QuotationWorkspaceActions, type QuotationWorkspaceActionState } from "./QuotationWorkspaceActions";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));
afterEach(cleanup);

function state(overrides: Partial<QuotationWorkspaceActionState> = {}): QuotationWorkspaceActionState {
  return { savedQuotation: null, isDetailsCurrent: false, savingStep: "idle", resetComposer: vi.fn(),
    hasPopulatedLines: true, canSubmitHeaderOnly: true, partialHeaderConflict: false, isReloadingDetails: false,
    submit: vi.fn(async () => true), write: { isBlocked: false }, ...overrides };
}

function renderActions(composer: QuotationWorkspaceActionState) {
  return render(<TooltipProvider><QuotationWorkspaceActions composer={composer} /></TooltipProvider>);
}

async function openMenu() {
  fireEvent.pointerDown(screen.getByRole("button", { name: en.common.actions }), { button: 0, ctrlKey: false });
  return screen.findByRole("menu");
}

describe("quotation workspace compact actions", () => {
  it("moves mobile draft navigation and header-only save into an operable menu", async () => {
    const composer = state();
    renderActions(composer);
    expect(screen.getByTestId("quotation-desktop-actions")).toHaveClass("hidden", "md:flex");
    expect(screen.getByRole("button", { name: en.common.actions })).toHaveClass("w-8", "px-0");
    await openMenu();
    expect(screen.getByRole("menuitem", { name: en.tradeDocuments.quotations.back })).toHaveAttribute("href", TENANT_ROUTES.tradeQuotations);
    fireEvent.click(screen.getByRole("menuitem", { name: en.tradeDocuments.quotations.saveHeaderOnly }));
    expect(composer.submit).toHaveBeenCalledExactlyOnceWith({ headerOnly: true });
  });

  it.each([
    { canSubmitHeaderOnly: false }, { partialHeaderConflict: true }, { isReloadingDetails: true },
  ])("preserves header-only write fences in the compact menu: %o", async (boundary) => {
    const composer = state(boundary);
    renderActions(composer);
    await openMenu();
    const action = screen.getByRole("menuitem", { name: en.tradeDocuments.quotations.saveHeaderOnly });
    expect(action).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(action);
    expect(composer.submit).not.toHaveBeenCalled();
  });

  it("retains saved sharing and real navigation and executes create-another from the menu", async () => {
    const composer = state({ savedQuotation: DETAIL_WITH_REVISION, isDetailsCurrent: true });
    renderActions(composer);
    expect(screen.getAllByRole("group", { name: en.tradeDocuments.quotations.shareGroupLabel })).toHaveLength(1);
    await openMenu();
    expect(screen.getByRole("menuitem", { name: en.quotationExperience.openSaved })).toHaveAttribute("href", `${TENANT_ROUTES.tradeQuotations}/${DETAIL_WITH_REVISION.id}`);
    expect(screen.queryByRole("menuitem", { name: en.tradeDocuments.quotations.saveHeaderOnly })).toBeNull();
    expect(screen.getByRole("menuitem", { name: en.tradeDocuments.quotations.shareEmailTooltip })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: en.tradeDocuments.quotations.shareWhatsAppTooltip })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: en.tradeDocuments.quotations.shareTelegramTooltip })).toBeVisible();
    fireEvent.click(screen.getByRole("menuitem", { name: en.quotationExperience.createAnother }));
    expect(composer.resetComposer).toHaveBeenCalledOnce();
  });

  it("keeps confirmed-detail and unknown-write restrictions on saved mobile actions", async () => {
    const composer = state({ savedQuotation: DETAIL_WITH_REVISION, write: { isBlocked: true } });
    renderActions(composer);
    expect(screen.queryByRole("group", { name: en.tradeDocuments.quotations.shareGroupLabel })).toBeNull();
    await openMenu();
    const action = screen.getByRole("menuitem", { name: en.quotationExperience.createAnother });
    expect(action).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(action);
    expect(composer.resetComposer).not.toHaveBeenCalled();
  });
});
