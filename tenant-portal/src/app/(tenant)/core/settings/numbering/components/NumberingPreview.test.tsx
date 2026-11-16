// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError, axiosClient } from "@/lib/api/axiosClient";
import { formatTemplate } from "@/lib/format/template";
import { EMPTY_NUMBERING_FORM, SEQUENCE_NOT_FOUND_CODE } from "../numbering-contract";
import { NumberingPreview } from "./NumberingPreview";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));

const companyId = "01902001-3000-7000-8000-0000000000c1";
const correlationId = "01902001-3000-7000-8000-000000000099";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("numbering previews", () => {
  it("formats create input locally without probing codes while typing", async () => {
    vi.useFakeTimers();
    const getSpy = vi.spyOn(axiosClient, "get");
    const values = {
      ...EMPTY_NUMBERING_FORM,
      code: "I",
      prefix: "INV-",
      padding: "4",
      startValue: "7",
    };
    const { rerender } = render(<NumberingPreview values={values} showServerValue={false} />);
    for (const code of ["I", "IN", "INV"]) {
      rerender(<NumberingPreview values={{ ...values, code }} showServerValue={false} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
    }
    expect(screen.getByTestId("numbering-preview").textContent).toBe("INV-0007");
    expect(screen.queryByText(en.coreSettings.numberingPeekLabel)).toBeNull();
    expect(getSpy).not.toHaveBeenCalled();
  });

  it("renders concise formatted saved number, separate Draft preview label, non-consuming hint and exact bigint strings", async () => {
    vi.useFakeTimers();
    const huge = "9007199254740993";
    expect(huge).not.toBe(String(Number(huge)));

    const getSpy = vi.spyOn(axiosClient, "get").mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      data: {
        success: true,
        status: "SUCCESS",
        statusCode: 200,
        data: {
          code: "INV",
          companyId,
          nextValue: huge,
          formatted: `SAVED-${huge}`,
        },
        correlationId,
      },
    });
    render(
      <NumberingPreview
        values={{
          ...EMPTY_NUMBERING_FORM,
          code: "inv",
          prefix: "EDIT-",
          padding: "4",
          startValue: "9007199254740994",
          companyId,
        }}
        showServerValue
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(getSpy).toHaveBeenCalledWith(
      `/api/tenant/core/v1/numbering/INV/peek?companyId=${companyId}`,
      expect.objectContaining({ signal: expect.any(AbortSignal), cache: "no-store" }),
    );
    expect(screen.getByText(en.coreSettings.numberingPeekLabel)).toBeInTheDocument();
    expect(screen.getByText(en.coreSettings.numberingDraftPreviewLabel)).toBeInTheDocument();
    expect(screen.getByText(en.coreSettings.numberingPeekNonConsumingHint)).toBeInTheDocument();
    expect(screen.getByTestId("numbering-preview").textContent).toBe("EDIT-9007199254740994");
    expect(screen.getByText(`SAVED-${huge}`)).toBeInTheDocument();
    expect(
      screen.queryByText(
        formatTemplate(en.coreSettings.numberingPeekValue, {
          formatted: `SAVED-${huge}`,
          nextValue: huge,
        }),
      ),
    ).toBeNull();
  });

  it("keeps local draft preview independent when saved peek fails or returns 404 without blind retry", async () => {
    vi.useFakeTimers();
    const getSpy = vi.spyOn(axiosClient, "get");
    getSpy.mockRejectedValueOnce(
      new TenantApiClientError("Not found", {
        status: 404,
        statusText: "Not Found",
        headers: new Headers(),
        data: {
          success: false,
          statusCode: 404,
          errorCode: SEQUENCE_NOT_FOUND_CODE,
          message: "Sequence not found",
          correlationId,
        },
      }),
    );

    const { rerender } = render(
      <NumberingPreview
        values={{ ...EMPTY_NUMBERING_FORM, code: "MISSING", prefix: "DRF-", padding: "4", startValue: "12" }}
        showServerValue
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    // 404 renders truthful missing-record copy, NOT "New sequence" and NOT a Retry button.
    expect(screen.getByText(en.editDrawer.notFoundTitle)).toBeInTheDocument();
    expect(screen.queryByText(en.coreSettings.numberingPeekNew)).toBeNull();
    expect(screen.queryByRole("button", { name: en.common.retry })).toBeNull();
    expect(screen.getByTestId("numbering-preview")).toHaveTextContent("DRF-0012");

    // Malformed server payload (numeric nextValue instead of bigint string) surfaces failed state + Retry,
    // while local draft preview continues updating independently.
    getSpy.mockResolvedValueOnce({
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      data: {
        success: true,
        data: { code: "BROKEN", companyId: null, nextValue: 42, formatted: "0042" },
        correlationId,
      },
    });
    rerender(
      <NumberingPreview
        values={{ ...EMPTY_NUMBERING_FORM, code: "BROKEN", prefix: "PO-", padding: "5", startValue: "8" }}
        showServerValue
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(screen.getByText(en.coreSettings.numberingPeekFailed)).toBeInTheDocument();
    expect(screen.getByTestId("numbering-preview")).toHaveTextContent("PO-00008");

    rerender(
      <NumberingPreview
        values={{ ...EMPTY_NUMBERING_FORM, code: "BROKEN", prefix: "PO-", padding: "6", startValue: "19" }}
        showServerValue
      />,
    );
    expect(screen.getByText(en.coreSettings.numberingPeekFailed)).toBeInTheDocument();
    expect(screen.getByTestId("numbering-preview")).toHaveTextContent("PO-000019");

    getSpy.mockResolvedValueOnce({
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      data: {
        success: true,
        data: { code: "BROKEN", companyId: null, nextValue: "42", formatted: "PO-00042" },
        correlationId,
      },
    });
    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByText("PO-00042")).toBeInTheDocument();
    expect(screen.getByTestId("numbering-preview")).toHaveTextContent("PO-000019");
  });

  it("shows incomplete placeholder when draft prefix, padding or counter is invalid", () => {
    const { rerender } = render(
      <NumberingPreview
        values={{
          ...EMPTY_NUMBERING_FORM,
          code: "INV",
          prefix: "INV 01",
          padding: "4",
          startValue: "1",
        }}
        showServerValue={false}
      />,
    );
    expect(screen.getByTestId("numbering-preview").textContent).toBe(
      en.coreSettings.numberingPreviewIncomplete,
    );

    rerender(
      <NumberingPreview
        values={{
          ...EMPTY_NUMBERING_FORM,
          code: "INV",
          prefix: "INV-",
          padding: "4",
          startValue: "0",
        }}
        showServerValue={false}
      />,
    );
    expect(screen.getByTestId("numbering-preview").textContent).toBe(
      en.coreSettings.numberingPreviewIncomplete,
    );
  });
});
