// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { I18nProvider, type Language } from "@/i18n/I18nContext";
import { setLanguage } from "@/i18n/useLanguage";
import { formatTemplate } from "@/lib/format/template";
import {
  buildCreateTaxRequest,
  buildUpdateTaxRequest,
  type Tax,
  type TaxFormValues,
} from "../tax-contract";
import { CreateTaxModal } from "./CreateTaxModal";
import { EditTaxModal } from "./EditTaxModal";

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (typeof HTMLElement.prototype.hasPointerCapture === "undefined") {
  HTMLElement.prototype.hasPointerCapture = () => false;
}
if (typeof HTMLElement.prototype.setPointerCapture === "undefined") {
  HTMLElement.prototype.setPointerCapture = () => {};
}
if (typeof HTMLElement.prototype.releasePointerCapture === "undefined") {
  HTMLElement.prototype.releasePointerCapture = () => {};
}
if (typeof Element.prototype.scrollIntoView === "undefined") {
  Element.prototype.scrollIntoView = () => {};
}

const companyA = { id: "01902001-3000-7000-8000-0000000000c1", code: "ACME", name: "Acme Retail" };
const companyB = { id: "01902001-3000-7000-8000-0000000000c2", code: "NOOR", name: "شركة النور" };

const existingTax: Tax = {
  id: "01902001-3000-7000-8000-000000000011",
  code: "VAT14",
  name: "Value added tax",
  rate: "14.0000",
  isInclusive: false,
  companyId: companyA.id,
  status: "ACTIVE",
  updatedAt: "2026-11-01T10:00:00.000Z",
};

function wrapProviders(ui: React.ReactElement, lang: Language = "en") {
  return (
    <I18nProvider initialLanguage={lang}>
      <TooltipProvider>{ui}</TooltipProvider>
    </I18nProvider>
  );
}

async function renderWithLocale(
  ui: React.ReactElement,
  lang: Language = "en",
  theme: "light" | "dark" = "light",
) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = lang;
  await act(async () => {
    await setLanguage(lang);
  });
  return render(wrapProviders(ui, lang));
}

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
  document.documentElement.dir = "ltr";
  document.documentElement.lang = "en";
  window.localStorage.removeItem("tenant_lang");
  vi.restoreAllMocks();
});

describe("CreateTaxModal & EditTaxModal", () => {
  it("renders centered compact modal without drawer/aside, links summary errors to fields, retains draft on duplicate code, and builds CreateTaxRequest", async () => {
    const submittedPayloads: unknown[] = [];
    const onSubmit = vi.fn(async (values: TaxFormValues) => {
      submittedPayloads.push(buildCreateTaxRequest(values));
      return true;
    });
    const onClose = vi.fn();
    const modalUi = (error: string | null) => (
      <CreateTaxModal
        isOpen
        companies={[companyA, companyB]}
        tenantWideAllowed
        onClose={onClose}
        onSubmit={onSubmit}
        isSubmitting={false}
        error={error}
      />
    );

    const { rerender } = await renderWithLocale(modalUi(null), "en", "light");

    const dialog = await screen.findByRole("dialog");
    expect(dialog.className).toContain("start-1/2");
    expect(dialog.querySelector("aside")).toBeNull();
    expect(within(dialog).getByText(en.coreSettings.taxScopeDeterminesHint)).toBeInTheDocument();
    expect(
      within(dialog).getByRole("combobox", { name: en.coreSettings.taxCompanyOptional }),
    ).toBeInTheDocument();

    const codeInput = within(dialog).getByLabelText(new RegExp(`^${en.coreSettings.taxCode}`));
    const nameInput = within(dialog).getByLabelText(new RegExp(`^${en.coreSettings.taxName}`));
    const rateInput = within(dialog).getByLabelText(new RegExp(`^${en.coreSettings.taxRate}`));
    const inclusiveSwitch = within(dialog).getByRole("switch", {
      name: en.coreSettings.taxPriceIncludes,
    });

    fireEvent.change(rateInput, { target: { value: "101" } });
    fireEvent.click(within(dialog).getByRole("button", { name: en.coreSettings.taxCreateSubmit }));

    expect(onSubmit).not.toHaveBeenCalled();
    const expectedSummaryHeading = formatTemplate(en.crmShared.formErrorCount, { count: 3 });
    const summaryAlert = await within(dialog).findByRole("alert", {
      name: expectedSummaryHeading,
    });
    expect(summaryAlert).toHaveTextContent(expectedSummaryHeading);
    expect(summaryAlert).not.toHaveTextContent(en.coreSettings.taxFormCode);
    expect(summaryAlert).not.toHaveTextContent(en.coreSettings.taxFormName);
    expect(summaryAlert).not.toHaveTextContent(en.coreSettings.taxFormRate);
    expect(within(dialog).getByText(en.coreSettings.taxFormCode)).toBeInTheDocument();
    expect(within(dialog).getByText(en.coreSettings.taxFormName)).toBeInTheDocument();
    expect(within(dialog).getByText(en.coreSettings.taxFormRate)).toBeInTheDocument();

    expect(
      within(summaryAlert).getByRole("link", { name: en.coreSettings.taxCode }),
    ).toHaveAttribute("href", "#tax-create-field-code");
    expect(
      within(summaryAlert).getByRole("link", { name: en.coreSettings.taxName }),
    ).toHaveAttribute("href", "#tax-create-field-name");
    const rateSummaryLink = within(summaryAlert).getByRole("link", {
      name: en.coreSettings.taxRate,
    });
    expect(rateSummaryLink).toHaveAttribute("href", "#tax-create-field-rate");
    fireEvent.click(rateSummaryLink);
    expect(document.activeElement).toBe(rateInput);

    onSubmit.mockImplementationOnce(async () => false);
    fireEvent.change(codeInput, { target: { value: " vat14 " } });
    fireEvent.change(nameInput, { target: { value: "  Standard VAT  " } });
    fireEvent.change(rateInput, { target: { value: "14.2575" } });
    fireEvent.click(inclusiveSwitch);
    fireEvent.click(within(dialog).getByRole("button", { name: en.coreSettings.taxCreateSubmit }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const duplicateMessage = formatTemplate(en.coreSettings.taxCodeTaken, {
      company: en.coreSettings.taxTenantWide,
    });
    rerender(wrapProviders(modalUi(duplicateMessage), "en"));

    expect(await within(dialog).findByText(duplicateMessage)).toBeInTheDocument();
    const duplicateSummary = within(dialog).getByRole("alert", {
      name: formatTemplate(en.crmShared.formErrorCount, { count: 1 }),
    });
    expect(duplicateSummary).not.toHaveTextContent(duplicateMessage);
    const codeSummaryLink = within(duplicateSummary).getByRole("link", {
      name: en.coreSettings.taxCode,
    });
    expect(codeSummaryLink).toHaveAttribute("href", "#tax-create-field-code");
    fireEvent.click(codeSummaryLink);
    expect(document.activeElement).toBe(codeInput);
    expect(codeInput).toHaveValue(" VAT14 ");
    expect(nameInput).toHaveValue("  Standard VAT  ");
    expect(rateInput).toHaveValue("14.2575");
    expect(inclusiveSwitch).toHaveAttribute("aria-checked", "true");

    fireEvent.change(codeInput, { target: { value: " vat15 " } });
    expect(within(dialog).queryByText(duplicateMessage)).toBeNull();

    fireEvent.click(within(dialog).getByRole("button", { name: en.coreSettings.taxCreateSubmit }));
    await waitFor(() => expect(submittedPayloads).toHaveLength(1));
    expect(submittedPayloads[0]).toEqual({
      code: "VAT15",
      name: "Standard VAT",
      rate: 14.2575,
      isInclusive: true,
    });
  });

  it("renders EditTaxModal in dark Arabic RTL with readonly Scope/Code at full contrast, omits equivalent-scale rate on name-only save, validates 4-decimal bounds, and updates Status", async () => {
    const patchPayloads: Record<string, unknown>[] = [];
    let shouldCloseOnSave = false;
    const onSubmit = vi.fn(async (values: TaxFormValues) => {
      patchPayloads.push({ ...buildUpdateTaxRequest(existingTax, values) });
      return shouldCloseOnSave;
    });

    await renderWithLocale(
      <EditTaxModal
        tax={existingTax}
        companies={[companyA, companyB]}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        isSubmitting={false}
        error={null}
      />,
      "ar",
      "dark",
    );

    const dialog = await screen.findByRole("dialog");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.dir).toBe("rtl");

    const scopeInput = within(dialog).getByRole("textbox", { name: ar.coreSettings.taxCompany });
    const codeInput = within(dialog).getByRole("textbox", { name: ar.coreSettings.taxCode });
    expect(scopeInput).toHaveValue("Acme Retail");
    expect(scopeInput).toHaveAttribute("readonly");
    expect(scopeInput).not.toBeDisabled();
    expect(scopeInput.className).toContain("read-only:text-foreground");
    expect(codeInput).toHaveValue("VAT14");
    expect(codeInput).toHaveAttribute("readonly");
    expect(codeInput).not.toBeDisabled();
    expect(codeInput.className).toContain("read-only:text-foreground");

    const nameInput = within(dialog).getByLabelText(new RegExp(`^${ar.coreSettings.taxName}`));
    const rateInput = within(dialog).getByLabelText(new RegExp(`^${ar.coreSettings.taxRate}`));
    fireEvent.change(nameInput, { target: { value: "  ضريبة القيمة المضافة  " } });
    fireEvent.change(rateInput, { target: { value: "100.0001" } });
    fireEvent.click(within(dialog).getByRole("button", { name: ar.coreSettings.save }));

    expect(onSubmit).not.toHaveBeenCalled();
    const editSummaryHeading = formatTemplate(ar.crmShared.formErrorCount, { count: 1 });
    const editSummary = await within(dialog).findByRole("alert", {
      name: editSummaryHeading,
    });
    expect(editSummary).not.toHaveTextContent(ar.coreSettings.taxFormRate);
    expect(within(dialog).getByText(ar.coreSettings.taxFormRate)).toBeInTheDocument();
    const editRateLink = within(editSummary).getByRole("link", {
      name: ar.coreSettings.taxRate,
    });
    expect(editRateLink).toHaveAttribute("href", "#tax-edit-field-rate");
    fireEvent.click(editRateLink);
    expect(document.activeElement).toBe(rateInput);
    expect(nameInput).toHaveValue("  ضريبة القيمة المضافة  ");

    fireEvent.change(rateInput, { target: { value: "14" } });
    fireEvent.click(within(dialog).getByRole("button", { name: ar.coreSettings.save }));
    await waitFor(() => expect(patchPayloads).toHaveLength(1));
    expect(patchPayloads[0]).toEqual({ name: "ضريبة القيمة المضافة" });
    expect("rate" in patchPayloads[0]!).toBe(false);
    expect("code" in patchPayloads[0]!).toBe(false);
    expect("companyId" in patchPayloads[0]!).toBe(false);

    shouldCloseOnSave = true;
    fireEvent.change(rateInput, { target: { value: "15" } });

    const statusTrigger = within(dialog).getByRole("combobox", {
      name: new RegExp(`^${ar.common.status}`),
    });
    fireEvent.click(statusTrigger);
    fireEvent.click(await screen.findByRole("option", { name: ar.common.inactive }));

    fireEvent.click(within(dialog).getByRole("button", { name: ar.coreSettings.save }));

    await waitFor(() => expect(patchPayloads).toHaveLength(2));
    expect(patchPayloads[1]).toEqual({
      name: "ضريبة القيمة المضافة",
      rate: 15,
      status: "INACTIVE",
    });
    expect("code" in patchPayloads[1]!).toBe(false);
    expect("companyId" in patchPayloads[1]!).toBe(false);
  });

  it("prevents same-tick duplicate submits, dismissal while unresolved, and unhandled rejections, then guards dirty dismissal when idle", async () => {
    const onClose = vi.fn();
    let rejectInFlight: ((reason?: unknown) => void) | undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<boolean>((_resolve, reject) => {
          rejectInFlight = reject;
        }),
    );

    await renderWithLocale(
      <CreateTaxModal
        isOpen
        companies={[companyA]}
        tenantWideAllowed={false}
        onClose={onClose}
        onSubmit={onSubmit}
        isSubmitting={false}
        error={null}
      />,
      "en",
    );

    const dialog = await screen.findByRole("dialog");
    const form = dialog.querySelector("form")!;
    const codeInput = within(dialog).getByLabelText(new RegExp(`^${en.coreSettings.taxCode}`));
    const nameInput = within(dialog).getByLabelText(new RegExp(`^${en.coreSettings.taxName}`));
    const rateInput = within(dialog).getByLabelText(new RegExp(`^${en.coreSettings.taxRate}`));

    fireEvent.change(codeInput, { target: { value: "MUN25" } });
    fireEvent.change(nameInput, { target: { value: "Municipality Levy" } });
    fireEvent.change(rateInput, { target: { value: "2.5" } });

    // Same-tick double submit while parent isSubmitting is still false.
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // Dismissal attempts while unresolved neither close nor open ConfirmActionModal.
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.click(within(dialog).getByRole("button", { name: en.common.close }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();

    // Standalone rejected promise is caught safely without leaking raw text or losing draft.
    await act(async () => {
      rejectInFlight?.(new Error("Raw unhandled wire trace"));
    });
    expect(await within(dialog).findByText(en.coreSettings.taxCreateFailed)).toBeInTheDocument();
    expect(within(dialog).queryByText("Raw unhandled wire trace")).toBeNull();
    expect(codeInput).toHaveValue("MUN25");

    // Once settled and dirty, Cancel prompts ConfirmActionModal before closing.
    fireEvent.click(within(dialog).getByRole("button", { name: en.common.cancel }));
    expect(onClose).not.toHaveBeenCalled();
    const confirmDialog = await screen.findByRole("alertdialog");
    expect(within(confirmDialog).getByText(en.common.discardTitle)).toBeInTheDocument();

    fireEvent.click(within(confirmDialog).getByRole("button", { name: en.common.discardConfirm }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
