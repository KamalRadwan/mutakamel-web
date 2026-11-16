// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast as sonnerToast } from "sonner";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { I18nProvider } from "@/i18n/I18nContext";
import { en } from "@/i18n/dictionaries/en";
import { setLanguage } from "@/i18n/useLanguage";
import { TenantApiClientError, axiosClient, type AxiosResponse } from "@/lib/api/axiosClient";
import { formatTemplate } from "@/lib/format/template";
import {
  SEQUENCE_CODE_TAKEN_CODE,
  SEQUENCE_NOT_FOUND_CODE,
  SEQUENCE_VALUE_INVALID_CODE,
} from "./numbering-contract";
import NumberingPage from "./page";

const alphaCompanyId = "01902001-3000-7000-8000-0000000000c1";
const correlationId = "01902001-3000-7000-8000-0000000000f2";

const authState = vi.hoisted(() => ({
  user: {
    id: "01902001-3000-7000-8000-0000000000a1",
    permissions: ["numbering.read", "numbering.manage"],
    permissionScopes: {
      "numbering.read": { tenantWide: true, companyIds: [], branchIds: [] },
      "numbering.manage": {
        tenantWide: true,
        companyIds: ["01902001-3000-7000-8000-0000000000c1"],
        branchIds: [],
      },
    },
  },
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => authState,
}));

const companiesPayload = [{ id: alphaCompanyId, code: "ALPHA", name: "Alpha Trading" }];

const existingSequence = {
  id: "01902001-3000-7000-8000-000000000002",
  code: "SALES_INVOICE",
  prefix: "INV-",
  padding: 5,
  nextValue: "43",
  companyId: alphaCompanyId,
  updatedAt: "2026-08-25T10:06:00.000Z",
};

function okResponse(data: unknown, status = 200): AxiosResponse<unknown> {
  return { data, status, statusText: "OK", headers: new Headers() };
}

function pageEnvelope(rows: readonly unknown[], limit = 20) {
  return okResponse({
    success: true,
    status: "SUCCESS",
    statusCode: 200,
    data: rows,
    meta: {
      page: 1,
      limit,
      total: rows.length,
      totalPages: rows.length === 0 ? 0 : 1,
      hasNext: false,
      hasPrev: false,
    },
    correlationId,
  });
}

async function renderPage() {
  await setLanguage("en");
  return render(
    <I18nProvider initialLanguage="en">
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

afterEach(() => {
  cleanup();
  window.localStorage.removeItem("tenant_lang");
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("NumberingPage create, edit and server peek flows", () => {
  it("routes 409 SEQUENCE_CODE_TAKEN on create to editable code field with company label, retains draft, and submits cleanly after edit", async () => {
    vi.spyOn(sonnerToast, "custom").mockImplementation(() => "toast-id");
    let rows = [existingSequence];

    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) {
        return pageEnvelope(companiesPayload, 100);
      }
      return pageEnvelope(rows);
    });

    const postSpy = vi.spyOn(axiosClient, "post");
    postSpy.mockRejectedValueOnce(
      new TenantApiClientError("Conflict", {
        status: 409,
        statusText: "Conflict",
        headers: new Headers(),
        data: {
          success: false,
          statusCode: 409,
          errorCode: SEQUENCE_CODE_TAKEN_CODE,
          message: "Already exists",
          correlationId,
        },
      }),
    );

    await renderPage();
    expect(await screen.findByText("SALES_INVOICE")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: en.coreSettings.numberingCreate }));
    const createDialog = await screen.findByRole("dialog", {
      name: en.coreSettings.numberingCreateTitle,
    });
    expect(within(createDialog).queryByText(en.coreSettings.numberingCreateDescription)).toBeNull();

    fireEvent.click(
      within(createDialog).getByRole("combobox", { name: en.coreIdentity.cascade.company }),
    );
    fireEvent.click(await screen.findByRole("option", { name: "Alpha Trading" }));

    const codeInput = within(createDialog).getByRole("textbox", { name: en.coreSettings.numberingCode });
    fireEvent.change(codeInput, { target: { value: "sales_invoice" } });
    fireEvent.change(
      within(createDialog).getByRole("textbox", { name: en.coreSettings.numberingPrefix }),
      { target: { value: "PO-" } },
    );
    fireEvent.change(
      within(createDialog).getByRole("textbox", { name: en.coreSettings.numberingPadding }),
      { target: { value: "6" } },
    );
    fireEvent.change(
      within(createDialog).getByRole("textbox", { name: en.coreSettings.numberingStartValue }),
      { target: { value: "10" } },
    );

    expect(within(createDialog).getByTestId("numbering-preview").textContent).toBe("PO-000010");

    const saveButton = within(createDialog).getByRole("button", { name: en.coreSettings.save });
    fireEvent.click(saveButton);

    const expectedTaken = formatTemplate(en.coreSettings.numberingCodeTaken, { company: "Alpha Trading" });
    expect(await within(createDialog).findByText(expectedTaken)).toBeInTheDocument();
    expect(codeInput).toHaveAttribute("aria-invalid", "true");
    expect(within(createDialog).getByRole("alert")).toHaveTextContent(
      formatTemplate(en.crmShared.formErrorCount, { count: 1 }),
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(codeInput);
      expect(saveButton).toBeEnabled();
    });

    // Editing code clears the duplicate server error while preserving all other draft values.
    fireEvent.change(codeInput, { target: { value: "purchase_order" } });
    expect(within(createDialog).queryByText(expectedTaken)).toBeNull();
    expect(codeInput).not.toHaveAttribute("aria-invalid", "true");

    const createdRow = {
      id: "01902001-3000-7000-8000-000000000005",
      code: "PURCHASE_ORDER",
      prefix: "PO-",
      padding: 6,
      nextValue: "10",
      companyId: alphaCompanyId,
      updatedAt: "2026-08-25T10:10:00.000Z",
    };
    postSpy.mockImplementationOnce(async () => {
      rows = [existingSequence, createdRow];
      return okResponse({ success: true, statusCode: 201, data: createdRow, correlationId }, 201);
    });

    fireEvent.click(saveButton);
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: en.coreSettings.numberingCreateTitle }),
      ).toBeNull();
    });
    await waitFor(() => {
      const createdTableRow = within(screen.getByRole("table"))
        .getByText("PURCHASE_ORDER")
        .closest("tr");
      expect(createdTableRow).not.toBeNull();
      if (!createdTableRow) return;
      expect(within(createdTableRow).getByText("PO-")).toBeInTheDocument();
      expect(within(createdTableRow).getByText("6")).toBeInTheDocument();
      expect(within(createdTableRow).getByText("PO-000010")).toBeInTheDocument();
    });
    expect(postSpy).toHaveBeenLastCalledWith(
      "/api/tenant/core/v1/numbering",
      {
        code: "PURCHASE_ORDER",
        prefix: "PO-",
        padding: 6,
        startValue: 10,
        companyId: alphaCompanyId,
      },
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("keeps locked edit code clear on 409 conflict and transitions edit modal to NotFoundState without retry on 404", async () => {
    vi.spyOn(sonnerToast, "custom").mockImplementation(() => "toast-id");
    let rows = [existingSequence];

    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) {
        return pageEnvelope(companiesPayload, 100);
      }
      if (url.includes("/peek")) {
        return okResponse({
          success: true,
          statusCode: 200,
          data: {
            code: "SALES_INVOICE",
            companyId: alphaCompanyId,
            nextValue: "43",
            formatted: "INV-00043",
          },
          correlationId,
        });
      }
      return pageEnvelope(rows);
    });

    const patchSpy = vi.spyOn(axiosClient, "patch");
    patchSpy.mockRejectedValueOnce(
      new TenantApiClientError("Conflict", {
        status: 409,
        statusText: "Conflict",
        headers: new Headers(),
        data: {
          success: false,
          statusCode: 409,
          errorCode: SEQUENCE_CODE_TAKEN_CODE,
          message: "Conflict",
          correlationId,
        },
      }),
    );

    await renderPage();
    expect(await screen.findByText("SALES_INVOICE")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: `${en.coreSettings.numberingEditTitle}: SALES_INVOICE` }),
    );
    const editDialog = await screen.findByRole("dialog", {
      name: en.coreSettings.numberingEditTitle,
    });

    const codeInput = within(editDialog).getByRole("textbox", { name: en.coreSettings.numberingCode });
    const paddingInput = within(editDialog).getByRole("textbox", { name: en.coreSettings.numberingPadding });
    const saveButton = within(editDialog).getByRole("button", { name: en.coreSettings.save });

    fireEvent.change(paddingInput, { target: { value: "6" } });
    fireEvent.click(saveButton);

    const banner = await within(editDialog).findByRole("alert");
    expect(banner).toHaveTextContent(en.coreIdentity.errors.CONFLICT);
    expect(codeInput).toHaveAttribute("readonly");
    expect(codeInput).not.toHaveAttribute("aria-invalid", "true");
    expect(
      within(editDialog).queryByText(
        formatTemplate(en.coreSettings.numberingCodeTaken, { company: "Alpha Trading" }),
      ),
    ).toBeNull();
    expect(paddingInput).toHaveValue("6");
    await waitFor(() => expect(saveButton).toBeEnabled());

    // Subsequent 404 SEQUENCE_NOT_FOUND transitions modal to NotFoundState with NO Save/Retry button.
    rows = [];
    patchSpy.mockRejectedValueOnce(
      new TenantApiClientError("Not found", {
        status: 404,
        statusText: "Not Found",
        headers: new Headers(),
        data: {
          success: false,
          statusCode: 404,
          errorCode: SEQUENCE_NOT_FOUND_CODE,
          message: "Not found",
          correlationId,
        },
      }),
    );

    fireEvent.click(saveButton);
    expect(await within(editDialog).findByText(en.editDrawer.notFoundTitle)).toBeInTheDocument();
    expect(within(editDialog).queryByRole("button", { name: en.coreSettings.save })).toBeNull();
    expect(within(editDialog).queryByRole("button", { name: en.common.retry })).toBeNull();

    fireEvent.click(within(editDialog).getByRole("button", { name: en.detail.back }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: en.coreSettings.numberingEditTitle })).toBeNull();
      expect(screen.getByText(en.coreSettings.numberingEmpty)).toBeInTheDocument();
    });
  });

  it("reads concise server peek in edit mode, blocks lowered counters, and patches only changed fields", async () => {
    vi.spyOn(sonnerToast, "custom").mockImplementation(() => "toast-id");
    let currentRow = existingSequence;

    const getSpy = vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) {
        return pageEnvelope(companiesPayload, 100);
      }
      if (url.includes("/peek")) {
        return okResponse({
          success: true,
          status: "SUCCESS",
          statusCode: 200,
          data: {
            code: "SALES_INVOICE",
            companyId: alphaCompanyId,
            nextValue: "43",
            formatted: "INV-00043",
          },
          correlationId,
        });
      }
      return pageEnvelope([currentRow]);
    });

    const patchSpy = vi.spyOn(axiosClient, "patch").mockImplementation(async (_url, body) => {
      const patch = body as { nextValue?: number };
      currentRow = { ...currentRow, nextValue: String(patch.nextValue ?? 43) };
      return okResponse({ success: true, statusCode: 200, data: currentRow, correlationId });
    });

    await renderPage();
    expect(await screen.findByText("SALES_INVOICE")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: `${en.coreSettings.numberingEditTitle}: SALES_INVOICE` }),
    );
    const editDialog = await screen.findByRole("dialog", {
      name: en.coreSettings.numberingEditTitle,
    });

    expect(
      within(editDialog).getByRole("textbox", { name: en.coreIdentity.cascade.company }),
    ).toHaveValue("Alpha Trading");
    expect(
      within(editDialog).getByRole("textbox", { name: en.coreSettings.numberingCode }),
    ).toHaveValue("SALES_INVOICE");

    await waitFor(() => {
      expect(getSpy).toHaveBeenCalledWith(
        `/api/tenant/core/v1/numbering/SALES_INVOICE/peek?companyId=${alphaCompanyId}`,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(within(editDialog).getAllByText("INV-00043").length).toBeGreaterThanOrEqual(1);
      expect(within(editDialog).getByText(en.coreSettings.numberingDraftPreviewLabel)).toBeInTheDocument();
      expect(within(editDialog).getByText(en.coreSettings.numberingPeekNonConsumingHint)).toBeInTheDocument();
    });

    const counterInput = within(editDialog).getByRole("textbox", {
      name: en.coreSettings.numberingNextValue,
    });
    const saveButton = within(editDialog).getByRole("button", { name: en.coreSettings.save });

    fireEvent.change(counterInput, { target: { value: "40" } });
    fireEvent.click(saveButton);
    expect(
      await within(editDialog).findByText(
        formatTemplate(en.coreSettings.numberingValueBackward, { current: "43" }),
      ),
    ).toBeInTheDocument();
    expect(patchSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(saveButton).toBeEnabled());

    await act(async () => {
      fireEvent.change(counterInput, { target: { value: "50" } });
    });
    expect(within(editDialog).getByTestId("numbering-preview")).toHaveTextContent("INV-00050");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(patchSpy).toHaveBeenCalledWith(
        `/api/tenant/core/v1/numbering/${existingSequence.id}`,
        { nextValue: 50 },
        expect.objectContaining({ cache: "no-store" }),
      );
      expect(
        screen.queryByRole("dialog", { name: en.coreSettings.numberingEditTitle }),
      ).toBeNull();
    });

    await waitFor(() => {
      const updatedRow = within(screen.getByRole("table")).getByText("SALES_INVOICE").closest("tr");
      expect(updatedRow).not.toBeNull();
      if (!updatedRow) return;
      expect(within(updatedRow).getByText("INV-00050")).toBeInTheDocument();
      expect(within(updatedRow).queryByText("INV-00043")).toBeNull();
    });
  });

  it("retains modal and draft without fabricating success when create or update returns a malformed payload", async () => {
    const toastSpy = vi.spyOn(sonnerToast, "custom").mockImplementation(() => "toast-id");
    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) {
        return pageEnvelope(companiesPayload, 100);
      }
      if (url.includes("/peek")) {
        return okResponse({
          success: true,
          statusCode: 200,
          data: {
            code: "SALES_INVOICE",
            companyId: alphaCompanyId,
            nextValue: "43",
            formatted: "INV-00043",
          },
          correlationId,
        });
      }
      return pageEnvelope([existingSequence]);
    });

    // Malformed 201 create payload (numeric nextValue instead of bigint string).
    vi.spyOn(axiosClient, "post").mockResolvedValueOnce(
      okResponse(
        {
          success: true,
          statusCode: 201,
          data: { ...existingSequence, code: "PURCHASE_ORDER", nextValue: 10 },
          correlationId,
        },
        201,
      ),
    );
    // Malformed 200 update payload (numeric nextValue instead of bigint string).
    vi.spyOn(axiosClient, "patch").mockResolvedValueOnce(
      okResponse({
        success: true,
        statusCode: 200,
        data: { ...existingSequence, padding: 7, nextValue: 43 },
        correlationId,
      }),
    );

    await renderPage();
    expect(await screen.findByText("SALES_INVOICE")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: en.coreSettings.numberingCreate }));
    const createDialog = await screen.findByRole("dialog", {
      name: en.coreSettings.numberingCreateTitle,
    });
    const codeInput = within(createDialog).getByRole("textbox", { name: en.coreSettings.numberingCode });
    const prefixInput = within(createDialog).getByRole("textbox", { name: en.coreSettings.numberingPrefix });
    fireEvent.change(codeInput, { target: { value: "PURCHASE_ORDER" } });
    fireEvent.change(prefixInput, { target: { value: "PO-" } });
    fireEvent.click(within(createDialog).getByRole("button", { name: en.coreSettings.save }));

    expect(
      await within(createDialog).findByText(en.coreSettings.invalidResponseDescription),
    ).toBeInTheDocument();
    expect(codeInput).toHaveValue("PURCHASE_ORDER");
    expect(prefixInput).toHaveValue("PO-");
    expect(toastSpy).not.toHaveBeenCalled();

    // Discard create modal, then verify malformed update response also retains draft and modal.
    await waitFor(() =>
      expect(within(createDialog).getByRole("button", { name: en.common.cancel })).toBeEnabled(),
    );
    fireEvent.click(within(createDialog).getByRole("button", { name: en.common.cancel }));
    const discardModal = await screen.findByRole("alertdialog", { name: en.common.discardTitle });
    fireEvent.click(within(discardModal).getByRole("button", { name: en.common.discardConfirm }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: en.coreSettings.numberingCreateTitle })).toBeNull(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: `${en.coreSettings.numberingEditTitle}: SALES_INVOICE` }),
    );
    const editDialog = await screen.findByRole("dialog", {
      name: en.coreSettings.numberingEditTitle,
    });
    const paddingInput = within(editDialog).getByRole("textbox", {
      name: en.coreSettings.numberingPadding,
    });
    fireEvent.change(paddingInput, { target: { value: "7" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: en.coreSettings.save }));

    expect(
      await within(editDialog).findByText(en.coreSettings.invalidResponseDescription),
    ).toBeInTheDocument();
    expect(paddingInput).toHaveValue("7");
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it("handles server SEQUENCE_VALUE_INVALID race (loaded 124, server 130, input 126) without claiming stale 124 bound or clamping draft", async () => {
    vi.spyOn(sonnerToast, "custom").mockImplementation(() => "toast-id");
    const raceRow = { ...existingSequence, nextValue: "124" };

    vi.spyOn(axiosClient, "get").mockImplementation(async (url) => {
      if (url.startsWith("/api/tenant/core/v1/organization/companies")) {
        return pageEnvelope(companiesPayload, 100);
      }
      if (url.includes("/peek")) {
        return okResponse({
          success: true,
          statusCode: 200,
          data: {
            code: "SALES_INVOICE",
            companyId: alphaCompanyId,
            nextValue: "124",
            formatted: "INV-00124",
          },
          correlationId,
        });
      }
      return pageEnvelope([raceRow]);
    });

    vi.spyOn(axiosClient, "patch").mockRejectedValueOnce(
      new TenantApiClientError("Unprocessable Entity", {
        status: 422,
        statusText: "Unprocessable Entity",
        headers: new Headers(),
        data: {
          success: false,
          statusCode: 422,
          errorCode: SEQUENCE_VALUE_INVALID_CODE,
          message: "Sequence value cannot be lowered.",
          correlationId,
        },
      }),
    );

    await renderPage();
    expect(await screen.findByText("SALES_INVOICE")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: `${en.coreSettings.numberingEditTitle}: SALES_INVOICE` }),
    );
    const editDialog = await screen.findByRole("dialog", {
      name: en.coreSettings.numberingEditTitle,
    });
    const counterInput = within(editDialog).getByRole("textbox", {
      name: en.coreSettings.numberingNextValue,
    });

    expect(
      within(editDialog).queryByText(
        formatTemplate(en.coreSettings.numberingNextValueHint, { current: "124" }),
      ),
    ).toBeNull();

    // User enters 126 (>= loaded 124), passing client check, while server locked 130.
    fireEvent.change(counterInput, { target: { value: "126" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: en.coreSettings.save }));

    const expectedRaceGuidance = `${en.coreIdentity.errors.CONFLICT} — ${en.errors.reference}: ${correlationId}`;
    expect(await within(editDialog).findByText(expectedRaceGuidance)).toBeInTheDocument();
    expect(counterInput).toHaveValue("126");
    expect(counterInput).toHaveAttribute("aria-invalid", "true");
    expect(
      within(editDialog).queryByText(
        formatTemplate(en.coreSettings.numberingValueBackward, { current: "124" }),
      ),
    ).toBeNull();
  });
});
