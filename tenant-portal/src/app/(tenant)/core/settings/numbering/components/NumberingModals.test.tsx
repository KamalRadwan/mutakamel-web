// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast as sonnerToast } from "sonner";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { I18nProvider } from "@/i18n/I18nContext";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { setLanguage } from "@/i18n/useLanguage";
import { TenantApiClientError, axiosClient, type AxiosResponse } from "@/lib/api/axiosClient";
import { formatTemplate } from "@/lib/format/template";
import { MAX_SAFE_COUNTER_STRING, type NumberingSequence } from "../numbering-contract";
import NumberingPage from "../page";

const alphaCompanyId = "01902001-3000-7000-8000-0000000000c1";
const correlationId = "01902001-3000-7000-8000-0000000000f5";

const defaultUser = () => ({
  id: "01902001-3000-7000-8000-0000000000a1",
  permissions: ["numbering.read", "numbering.manage"],
  permissionScopes: {
    "numbering.read": { tenantWide: true, companyIds: [], branchIds: [] },
    "numbering.manage": { tenantWide: true, companyIds: [alphaCompanyId], branchIds: [] },
  },
});

const authState = vi.hoisted(() => ({
  user: {
    id: "01902001-3000-7000-8000-0000000000a1",
    permissions: ["numbering.read", "numbering.manage"],
    permissionScopes: {
      "numbering.read": { tenantWide: true, companyIds: [], branchIds: [] },
      "numbering.manage": { tenantWide: true, companyIds: ["01902001-3000-7000-8000-0000000000c1"], branchIds: [] },
    },
  },
}));

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => authState }));

const companiesPayload = [{ id: alphaCompanyId, code: "ALPHA", name: "Alpha Trading" }];

const hugeSequence: NumberingSequence = {
  id: "01902001-3000-7000-8000-000000000010", code: "JOURNAL_ENTRY", prefix: "INV-",
  padding: 5, nextValue: "9007199254740993", companyId: alphaCompanyId, updatedAt: "2026-08-25T10:06:00.000Z",
};

const tenantWideSequence: NumberingSequence = {
  id: "01902001-3000-7000-8000-000000000011", code: "TENANT_QUOTE", prefix: "TQ-",
  padding: 4, nextValue: "12", companyId: null, updatedAt: "2026-08-25T10:07:00.000Z",
};

function okResponse(data: unknown, status = 200): AxiosResponse<unknown> {
  return { data, status, statusText: "OK", headers: new Headers() };
}

function pageEnvelope(rows: readonly unknown[], limit = 20) {
  return okResponse({
    success: true, status: "SUCCESS", statusCode: 200, data: rows,
    meta: { page: 1, limit, total: rows.length, totalPages: rows.length === 0 ? 0 : 1, hasNext: false, hasPrev: false },
    correlationId,
  });
}

async function renderPage(language: "en" | "ar" = "en") {
  await setLanguage(language);
  return render(
    <I18nProvider initialLanguage={language}>
      <TooltipProvider>
        <NumberingPage />
      </TooltipProvider>
    </I18nProvider>,
  );
}

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => undefined;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => undefined;
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => undefined;
});

beforeEach(() => {
  authState.user = defaultUser();
  vi.spyOn(sonnerToast, "custom").mockImplementation(() => "toast-id");
});

afterEach(() => {
  cleanup();
  window.localStorage.removeItem("tenant_lang");
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Numbering centered compact modals, validation, bigint & busy guards", () => {
  it("validates create blur/submit errors with linked summary focus, enforces MAX_SAFE_INTEGER and omits empty prefix", async () => {
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) =>
      url.startsWith("/api/tenant/core/v1/organization/companies") ? pageEnvelope(companiesPayload, 100) : pageEnvelope([]),
    );
    const postSpy = vi.spyOn(axiosClient, "post").mockResolvedValue(
      okResponse({
        success: true, statusCode: 201, correlationId,
        data: { ...hugeSequence, code: "PAYMENT_RUN", prefix: null, padding: 12, nextValue: MAX_SAFE_COUNTER_STRING, companyId: null },
      }, 201),
    );

    await renderPage("en");
    fireEvent.click(await screen.findByRole("button", { name: en.coreSettings.numberingCreate }));
    const dialog = await screen.findByRole("dialog", { name: en.coreSettings.numberingCreateTitle });
    expect(dialog.querySelector("aside")).toBeNull();

    const codeInput = within(dialog).getByRole("textbox", { name: en.coreSettings.numberingCode });
    const prefixInput = within(dialog).getByRole("textbox", { name: en.coreSettings.numberingPrefix });
    const paddingInput = within(dialog).getByRole("textbox", { name: en.coreSettings.numberingPadding });
    const startInput = within(dialog).getByRole("textbox", { name: en.coreSettings.numberingStartValue });
    const closeButton = within(dialog).getByRole("button", { name: en.common.close });
    const saveButton = within(dialog).getByRole("button", { name: en.coreSettings.save });

    await waitFor(() => expect(document.activeElement).toBe(codeInput));
    expect(document.activeElement).not.toBe(closeButton);

    fireEvent.change(prefixInput, { target: { value: "INV\u202E" } });
    fireEvent.blur(prefixInput);
    expect(await within(dialog).findByText(en.coreSettings.numberingFormPrefix)).toBeInTheDocument();

    fireEvent.change(codeInput, { target: { value: "-bad" } });
    fireEvent.change(paddingInput, { target: { value: "13" } });
    fireEvent.change(startInput, { target: { value: "9007199254740992" } });
    fireEvent.click(saveButton);

    const summary = await within(dialog).findByRole("alert");
    expect(summary).toHaveTextContent(formatTemplate(en.crmShared.formErrorCount, { count: 4 }));
    await waitFor(() => expect(document.activeElement).toBe(codeInput));

    fireEvent.click(within(summary).getByRole("link", { name: en.coreSettings.numberingPrefix }));
    expect(document.activeElement).toBe(prefixInput);
    expect(postSpy).not.toHaveBeenCalled();

    fireEvent.change(codeInput, { target: { value: "payment_run" } });
    fireEvent.change(prefixInput, { target: { value: "" } });
    fireEvent.change(paddingInput, { target: { value: "12" } });
    fireEvent.change(startInput, { target: { value: MAX_SAFE_COUNTER_STRING } });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledOnce();
      expect(postSpy).toHaveBeenCalledWith(
        "/api/tenant/core/v1/numbering",
        { code: "PAYMENT_RUN", padding: 12, startValue: 9007199254740991 },
        expect.objectContaining({ cache: "no-store" }),
      );
    });
  });

  it("keeps Code/Scope readOnly on edit, preserves bigint > MAX_SAFE_INTEGER, clears empty prefix and omits unchanged fields", async () => {
    let currentRow: NumberingSequence = { ...hugeSequence };
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) return pageEnvelope(companiesPayload, 100);
      if (url.includes("/peek")) {
        return okResponse({
          success: true, correlationId,
          data: {
            code: currentRow.code, companyId: currentRow.companyId, nextValue: currentRow.nextValue,
            formatted: `${currentRow.prefix ?? ""}${currentRow.nextValue}`,
          },
        });
      }
      return pageEnvelope([currentRow]);
    });
    const patchSpy = vi.spyOn(axiosClient, "patch").mockImplementation(async (_url, body) => {
      const patch = body as { prefix?: string; padding?: number };
      currentRow = {
        ...currentRow,
        prefix: patch.prefix === "" ? null : (patch.prefix ?? currentRow.prefix),
        padding: patch.padding ?? currentRow.padding,
      };
      return okResponse({ success: true, statusCode: 200, data: currentRow, correlationId });
    });

    await renderPage("en");
    fireEvent.click(
      await screen.findByRole("button", { name: `${en.coreSettings.numberingEditTitle}: JOURNAL_ENTRY` }),
    );
    const editDialog = await screen.findByRole("dialog", { name: en.coreSettings.numberingEditTitle });

    const codeInput = within(editDialog).getByRole("textbox", { name: en.coreSettings.numberingCode });
    const scopeInput = within(editDialog).getByRole("textbox", { name: en.coreIdentity.cascade.company });
    const prefixInput = within(editDialog).getByRole("textbox", { name: en.coreSettings.numberingPrefix });
    const counterInput = within(editDialog).getByRole("textbox", { name: en.coreSettings.numberingNextValue });

    await waitFor(() => expect(document.activeElement).toBe(prefixInput));
    expect(
      within(editDialog).queryByText(
        formatTemplate(en.coreSettings.numberingNextValueHint, { current: hugeSequence.nextValue }),
      ),
    ).toBeNull();

    expect(codeInput).toHaveAttribute("readonly");
    expect(codeInput.parentElement).toHaveAttribute("dir", "ltr");
    expect(codeInput).not.toBeDisabled();
    expect(scopeInput).toHaveAttribute("readonly");
    expect(scopeInput).not.toBeDisabled();
    expect(counterInput).toHaveValue("9007199254740993");
    expect(within(editDialog).getByTestId("numbering-preview")).toHaveTextContent("INV-9007199254740993");

    fireEvent.change(codeInput, { target: { value: "HACKED" } });
    fireEvent.change(scopeInput, { target: { value: "Other" } });
    expect(codeInput).toHaveValue("JOURNAL_ENTRY");
    expect(scopeInput).toHaveValue("Alpha Trading");

    // 1. Preserve prefix when unchanged and patch only padding.
    fireEvent.change(within(editDialog).getByRole("textbox", { name: en.coreSettings.numberingPadding }), {
      target: { value: "8" },
    });
    fireEvent.click(within(editDialog).getByRole("button", { name: en.coreSettings.save }));
    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith(
        `/api/tenant/core/v1/numbering/${hugeSequence.id}`,
        { padding: 8 },
        expect.objectContaining({ cache: "no-store" }),
      );
      expect(screen.queryByRole("dialog", { name: en.coreSettings.numberingEditTitle })).toBeNull();
    });

    // 2. Clear prefix with explicit { prefix: "" } while omitting unchanged huge nextValue, code and companyId.
    fireEvent.click(
      await screen.findByRole("button", { name: `${en.coreSettings.numberingEditTitle}: JOURNAL_ENTRY` }),
    );
    const secondDialog = await screen.findByRole("dialog", { name: en.coreSettings.numberingEditTitle });
    fireEvent.change(within(secondDialog).getByRole("textbox", { name: en.coreSettings.numberingPrefix }), {
      target: { value: "" },
    });
    expect(within(secondDialog).getByTestId("numbering-preview")).toHaveTextContent("9007199254740993");
    fireEvent.click(within(secondDialog).getByRole("button", { name: en.coreSettings.save }));
    await waitFor(() => {
      expect(patchSpy).toHaveBeenLastCalledWith(
        `/api/tenant/core/v1/numbering/${hugeSequence.id}`,
        { prefix: "" },
        expect.objectContaining({ cache: "no-store" }),
      );
    });
  });

  it("blocks duplicate submission and busy dismissal, retains draft on failure, and confirms dirty discard", async () => {
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) =>
      url.startsWith("/api/tenant/core/v1/organization/companies") ? pageEnvelope(companiesPayload, 100) : pageEnvelope([]),
    );
    let rejectPost: ((reason: unknown) => void) | null = null;
    const postSpy = vi.spyOn(axiosClient, "post").mockImplementation(
      () => new Promise<AxiosResponse<unknown>>((_resolve, reject) => { rejectPost = reject; }),
    );

    await renderPage("en");
    fireEvent.click(await screen.findByRole("button", { name: en.coreSettings.numberingCreate }));
    const dialog = await screen.findByRole("dialog", { name: en.coreSettings.numberingCreateTitle });

    const codeInput = within(dialog).getByRole("textbox", { name: en.coreSettings.numberingCode });
    fireEvent.change(codeInput, { target: { value: "CREDIT_NOTE" } });

    const formElement = dialog.querySelector("form");
    expect(formElement).not.toBeNull();
    if (!formElement) return;
    fireEvent.submit(formElement);
    fireEvent.submit(formElement);
    expect(postSpy).toHaveBeenCalledOnce();

    await waitFor(() => {
      expect(within(dialog).getByRole("button", { name: en.common.cancel })).toBeDisabled();
      expect(within(dialog).getByRole("button", { name: en.common.close })).toBeDisabled();
    });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByText(en.common.discardTitle)).toBeNull();
    expect(screen.getByRole("dialog", { name: en.coreSettings.numberingCreateTitle })).toBeInTheDocument();

    await act(async () => {
      rejectPost?.(
        new TenantApiClientError("Server error", {
          status: 503, statusText: "Service Unavailable", headers: new Headers(),
          data: { success: false, statusCode: 503, correlationId },
        }),
      );
    });
    expect(codeInput).toHaveValue("CREDIT_NOTE");

    fireEvent.keyDown(dialog, { key: "Escape" });
    const confirmDialog = await screen.findByRole("alertdialog", { name: en.common.discardTitle });
    fireEvent.click(within(confirmDialog).getByRole("button", { name: en.common.discardConfirm }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: en.coreSettings.numberingCreateTitle })).toBeNull();
    });
  });

  it("enforces company-only manage scope and renders Arabic RTL labels cleanly", async () => {
    authState.user = {
      ...defaultUser(),
      permissionScopes: {
        "numbering.read": { tenantWide: true, companyIds: [], branchIds: [] },
        "numbering.manage": { tenantWide: false, companyIds: [alphaCompanyId], branchIds: [] },
      },
    };
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) =>
      url.startsWith("/api/tenant/core/v1/organization/companies")
        ? pageEnvelope(companiesPayload, 100)
        : pageEnvelope([tenantWideSequence, hugeSequence]),
    );

    await renderPage("ar");
    expect(await screen.findByText("JOURNAL_ENTRY")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `${ar.coreSettings.numberingEditTitle}: TENANT_QUOTE` })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: ar.coreSettings.numberingCreate }));
    const dialog = await screen.findByRole("dialog", { name: ar.coreSettings.numberingCreateTitle });
    const arCodeInput = within(dialog).getByRole("textbox", { name: ar.coreSettings.numberingCode });
    await waitFor(() => expect(document.activeElement).toBe(arCodeInput));
    const scopeCombo = within(dialog).getByRole("combobox", { name: ar.coreIdentity.cascade.company });
    expect(scopeCombo).toHaveTextContent("Alpha Trading");
    fireEvent.click(scopeCombo);
    expect(screen.queryByRole("option", { name: ar.coreSettings.numberingTenantWide })).toBeNull();
  });
});
