// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { CurrencyRatesSection } from "./CurrencyRatesSection";
import { useCurrencyRates, type CurrencyRateView } from "../hooks/useCurrencyRates";

const mocks = vi.hoisted(() => ({
  lang: "en" as "en" | "ar",
  list: vi.fn(),
  upsert: vi.fn(),
  batch: vi.fn(),
  resetKey: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/auth/RequirePermission", () => ({ useHasPermission: () => true }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: mocks.lang, t: mocks.lang === "ar" ? ar : en }),
  useOptionalI18n: () => ({ lang: mocks.lang, t: mocks.lang === "ar" ? ar : en }),
}));
vi.mock("@/components/ui/ToastContext", () => ({ useToast: () => mocks.toast }));
vi.mock("@/features/admin/applications/api/applications.api", () => ({
  applicationsApi: { listCurrencyRates: mocks.list, upsertCurrencyRate: mocks.upsert, batchUpsertCurrencyRates: mocks.batch },
}));
vi.mock("@/shared/hooks/useIdempotency", () => ({
  useIdempotency: () => ({ getIdempotencyKey: () => "019f0000-0000-7000-8000-000000000001", resetKey: mocks.resetKey }),
}));

const eur = { currencyCode: "EUR", currencyUnitsPerUsd: "0.930000000000", isActive: true };
const sar = { currencyCode: "SAR", currencyUnitsPerUsd: "3.750000000000", isActive: false };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("currency rate confirmations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lang = "en";
    mocks.list.mockResolvedValue([eur, sar]);
    mocks.upsert.mockResolvedValue(eur);
    mocks.batch.mockResolvedValue([eur, sar]);
  });
  afterEach(cleanup);

  for (const lang of ["en", "ar"] as const) {
    it(`confirms a single large edit before sending approval in ${lang}`, async () => {
      mocks.lang = lang;
      const copy = (lang === "ar" ? ar : en).settings.currencyRates;
      const egp = { currencyCode: "EGP", currencyUnitsPerUsd: "30", isActive: true };
      mocks.list.mockResolvedValue([egp]);
      mocks.upsert.mockResolvedValue({ ...egp, currencyUnitsPerUsd: "48" });
      render(<CurrencyRatesSection />);
      const row = await screen.findByRole("row", { name: /EGP/ });
      fireEvent.click(within(row).getByRole("button", { name: copy.edit }));
      const editor = await screen.findByRole("dialog", { name: copy.editRateTitle("EGP") });
      fireEvent.change(within(editor).getByRole("textbox", { name: copy.unitsLabel }), { target: { value: "48" } });
      fireEvent.click(within(editor).getByRole("button", { name: copy.save }));
      let dialog = await screen.findByRole("alertdialog", { name: copy.confirmSingleTitle });
      expect(dialog).toHaveTextContent(copy.confirmRateDiff("EGP", "30", "48", copy.statusActive, copy.statusActive));
      expect(mocks.upsert).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole("button", { name: copy.cancel }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(within(editor).getByRole("textbox", { name: copy.unitsLabel })).toHaveValue("48");
      expect(mocks.upsert).not.toHaveBeenCalled();
      fireEvent.click(within(editor).getByRole("button", { name: copy.save }));
      dialog = await screen.findByRole("alertdialog");
      fireEvent.click(within(dialog).getByRole("button", { name: copy.confirmApply }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(mocks.upsert).toHaveBeenCalledWith("EGP", {
        currencyUnitsPerUsd: "48", isActive: true, confirmLargeChange: true,
      }, expect.any(String));
    });

    for (const kind of ["single", "batch"] as const) {
      it(`sends the confirmed ${kind} large-change payload and localizes a 422 in ${lang}`, async () => {
        mocks.lang = lang;
        const copy = (lang === "ar" ? ar : en).settings.currencyRates.validation;
        const egp = { currencyCode: "EGP", currencyUnitsPerUsd: "30", isActive: true };
        mocks.list.mockResolvedValue([egp]);
        const save = kind === "single" ? mocks.upsert : mocks.batch;
        save.mockRejectedValue({ response: { status: 422, data: {
          success: false, errorCode: "CURRENCY_RATE_CHANGE_TOO_LARGE", message: "private server detail", correlationId: "corr-large",
        } } });
        const { result } = renderHook(() => useCurrencyRates());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        await act(async () => {
          if (kind === "single") await result.current.upsertRate("EGP", "48");
          else result.current.requestBatchConfirmation([{ ...egp, currencyUnitsPerUsd: "48" }]);
        });
        expect(save).not.toHaveBeenCalled();
        await act(async () => { expect(await result.current.confirmRateChange()).toBe(false); });
        const dto = { currencyUnitsPerUsd: "48", isActive: true, confirmLargeChange: true };
        if (kind === "single") expect(save).toHaveBeenCalledWith("EGP", dto, expect.any(String));
        else expect(save).toHaveBeenCalledWith({ rates: [{ currencyCode: "EGP", ...dto }] }, expect.any(String));
        expect(result.current.error).toBe(`${copy.rateChangeTooLarge} · corr-large`);
        expect(mocks.toast.error).toHaveBeenLastCalledWith(copy.actionFailedTitle, `${copy.rateChangeTooLarge} · corr-large`);
        expect(result.current.confirmation).not.toBeNull();
        expect(result.current.rates).toEqual([egp]);
        save.mockResolvedValue(kind === "single" ? { ...egp, currencyUnitsPerUsd: "48" } : [{ ...egp, currencyUnitsPerUsd: "48" }]);
        mocks.list.mockResolvedValue([{ ...egp, currencyUnitsPerUsd: "48" }]);
        await act(async () => { expect(await result.current.confirmRateChange()).toBe(true); });
        expect(result.current.confirmation).toBeNull();
        expect(result.current.rates[0].currencyUnitsPerUsd).toBe("48");
      });
    }

    it(`keeps table state unchanged on reader failures in ${lang}`, async () => {
      mocks.lang = lang;
      const copy = (lang === "ar" ? ar : en).settings.currencyRates.validation;
      const { result } = renderHook(() => useCurrencyRates());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const previous = result.current.rates;
      const readerError = new Error("Invalid currency rate response");
      mocks.list.mockRejectedValue(readerError);
      await act(async () => { await result.current.fetchRates(); });
      expect(result.current.rates).toBe(previous);
      expect(result.current.error).toBe(copy.loadFailed);
      mocks.upsert.mockRejectedValue(readerError);
      await act(async () => { await result.current.upsertRate("EUR", "0.94"); });
      await act(async () => { expect(await result.current.confirmRateChange()).toBe(false); });
      expect(result.current.rates).toBe(previous);
      expect(result.current.error).toBe(copy.saveFailed);
      mocks.batch.mockRejectedValue(readerError);
      act(() => result.current.requestBatchConfirmation([eur]));
      await act(async () => { expect(await result.current.confirmRateChange()).toBe(false); });
      expect(result.current.rates).toBe(previous);
      expect(result.current.error).toBe(copy.batchSaveFailed);
      expect(mocks.toast.success).not.toHaveBeenCalled();
      expect(mocks.resetKey).not.toHaveBeenCalled();
    });

    it(`renders localized network load failures in ${lang}`, async () => {
      mocks.lang = lang;
      const copy = (lang === "ar" ? ar : en).settings.currencyRates.validation;
      mocks.list.mockRejectedValue(new TypeError("Failed to fetch: private transport detail"));
      render(<CurrencyRatesSection />);
      expect(await screen.findByText(copy.loadFailed)).toBeInTheDocument();
      expect(screen.queryByText(/private transport detail/)).toBeNull();
      expect(mocks.toast.error).toHaveBeenCalledWith(copy.actionFailedTitle, copy.loadFailed);
    });

    it(`localizes save failures, retains correlation IDs, and preserves validation in ${lang}`, async () => {
      mocks.lang = lang;
      const copy = (lang === "ar" ? ar : en).settings.currencyRates.validation;
      const { result } = renderHook(() => useCurrencyRates());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      mocks.upsert.mockRejectedValue(new Error("Network Error: private detail"));
      await act(async () => { await result.current.upsertRate("EUR", "0.94"); });
      await act(async () => { expect(await result.current.confirmRateChange()).toBe(false); });
      expect(result.current.error).toBe(copy.saveFailed);
      expect(mocks.toast.error).toHaveBeenLastCalledWith(copy.actionFailedTitle, copy.saveFailed);
      const correlationId = "019f0000-0000-7000-8000-000000000001";
      mocks.batch.mockRejectedValue({ response: { status: 500, data: {
        success: false, errorCode: "UNEXPECTED_FAILURE", message: "private server detail", correlationId,
      } } });
      act(() => result.current.requestBatchConfirmation([eur]));
      await act(async () => { expect(await result.current.confirmRateChange()).toBe(false); });
      expect(result.current.error).toBe(`${copy.batchSaveFailed} · ${correlationId}`);
      expect(mocks.toast.error).toHaveBeenLastCalledWith(copy.actionFailedTitle, `${copy.batchSaveFailed} · ${correlationId}`);
      await act(async () => { expect(await result.current.upsertRate("USD", "1")).toBe(false); });
      expect(result.current.error).toBe(copy.usdImmutable);
      expect(() => result.current.requestBatchConfirmation([])).toThrow(copy.atLeastOneRate);
      expect(() => result.current.requestBatchConfirmation([eur, eur])).toThrow(copy.batchCodesUnique);
    });

    it(`preserves localized batch-line validation in ${lang}`, async () => {
      mocks.lang = lang;
      const copy = (lang === "ar" ? ar : en).settings.currencyRates;
      render(<CurrencyRatesSection />);
      await screen.findByRole("row", { name: /EUR/ });
      fireEvent.click(screen.getByRole("button", { name: copy.batchEdit }));
      const editor = await screen.findByRole("dialog", { name: copy.batchDialogTitle });
      expect(within(editor).getByRole("button", { name: (lang === "ar" ? ar : en).common.close })).toBeInTheDocument();
      fireEvent.change(within(editor).getByRole("textbox"), { target: { value: "EUR,0.94,flase" } });
      fireEvent.click(within(editor).getByRole("button", { name: copy.saveBatch }));
      expect(within(editor).getByText(copy.validation.activeFlagInvalid)).toBeInTheDocument();
      expect(mocks.batch).not.toHaveBeenCalled();
    });

    for (const rate of [eur, sar]) {
      it(`confirms ${rate.isActive ? "deactivation" : "activation"} in ${lang} and disables row actions while saving`, async () => {
        mocks.lang = lang;
        const copy = (lang === "ar" ? ar : en).settings.currencyRates;
        const pending = deferred<CurrencyRateView>();
        mocks.upsert.mockReturnValue(pending.promise);
        render(<CurrencyRatesSection />);
        const row = await screen.findByRole("row", { name: new RegExp(rate.currencyCode) });
        const otherRow = screen.getByRole("row", { name: new RegExp(rate === eur ? "SAR" : "EUR") });
        const toggle = within(row).getByRole("button", { name: rate.isActive ? copy.deactivate : copy.activate });
        fireEvent.click(toggle);
        let dialog = await screen.findByRole("alertdialog", { name: copy.confirmStatusTitle });
        expect(dialog).toHaveTextContent(rate.currencyCode);
        expect(mocks.upsert).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole("button", { name: copy.cancel }));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
        expect(mocks.upsert).not.toHaveBeenCalled();
        fireEvent.click(toggle);
        dialog = await screen.findByRole("alertdialog");
        fireEvent.click(within(dialog).getByRole("button", { name: copy.confirmApply }));
        expect(mocks.upsert).toHaveBeenCalledTimes(1);
        expect(mocks.upsert).toHaveBeenCalledWith(rate.currencyCode,
          { currencyUnitsPerUsd: rate.currencyUnitsPerUsd, isActive: !rate.isActive, confirmLargeChange: true }, expect.any(String));
        // The modal hides the table from accessibility queries while it is open.
        for (const button of within(row).getAllByRole("button", { hidden: true })) expect(button).toBeDisabled();
        for (const button of within(otherRow).getAllByRole("button", { hidden: true })) expect(button).toBeDisabled();
        await act(async () => pending.resolve({ ...rate, isActive: !rate.isActive }));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      });
    }

    it(`previews changed rates, status-only changes, and additions before batch apply in ${lang}`, async () => {
      mocks.lang = lang;
      const copy = (lang === "ar" ? ar : en).settings.currencyRates;
      mocks.list.mockResolvedValue([eur, sar, { currencyCode: "EGP", currencyUnitsPerUsd: "48.000000000000", isActive: true }]);
      render(<CurrencyRatesSection />);
      await screen.findByRole("row", { name: /EUR/ });
      fireEvent.click(screen.getByRole("button", { name: copy.batchEdit }));
      const editor = await screen.findByRole("dialog", { name: copy.batchDialogTitle });
      const draft = "EUR,0.94,true\nSAR,3.75,true\nEGP,48,true\nGBP,0.79,false";
      fireEvent.change(within(editor).getByRole("textbox"), { target: { value: draft } });
      fireEvent.click(within(editor).getByRole("button", { name: copy.saveBatch }));
      let dialog = await screen.findByRole("alertdialog", { name: copy.confirmBatchTitle });
      expect(dialog).toHaveTextContent(copy.confirmBatchDescription(3));
      expect(dialog).toHaveTextContent(copy.confirmRateDiff("EUR", "0.93", "0.94", copy.statusActive, copy.statusActive));
      expect(dialog).toHaveTextContent(copy.confirmRateDiff("SAR", "3.75", "3.75", copy.statusInactive, copy.statusActive));
      expect(dialog).toHaveTextContent(copy.confirmRateDiff("GBP", copy.newRate, "0.79", copy.newRate, copy.statusInactive));
      expect(mocks.batch).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole("button", { name: copy.cancel }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(within(editor).getByRole("textbox")).toHaveValue(draft);
      expect(mocks.batch).not.toHaveBeenCalled();
      fireEvent.click(within(editor).getByRole("button", { name: copy.saveBatch }));
      dialog = await screen.findByRole("alertdialog");
      fireEvent.click(within(dialog).getByRole("button", { name: copy.confirmApply }));
      await waitFor(() => expect(mocks.batch).toHaveBeenCalledTimes(1));
      expect(mocks.batch).toHaveBeenCalledWith({ rates: [
        { currencyCode: "EUR", currencyUnitsPerUsd: "0.94", isActive: true, confirmLargeChange: true },
        { currencyCode: "SAR", currencyUnitsPerUsd: "3.75", isActive: true, confirmLargeChange: true },
        { currencyCode: "EGP", currencyUnitsPerUsd: "48", isActive: true, confirmLargeChange: true },
        { currencyCode: "GBP", currencyUnitsPerUsd: "0.79", isActive: false, confirmLargeChange: true },
      ] }, expect.any(String));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });
  }

  for (const first of ["single", "batch"] as const) {
    it(`synchronously prevents duplicate and overlapping writes when ${first} starts first`, async () => {
      const pending = deferred<CurrencyRateView | CurrencyRateView[]>();
      mocks.upsert.mockReturnValue(pending.promise);
      mocks.batch.mockReturnValue(pending.promise);
      const { result } = renderHook(() => useCurrencyRates());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => {
        if (first === "single") await result.current.upsertRate("EUR", "0.94");
        else result.current.requestBatchConfirmation([eur]);
      });
      let write!: Promise<boolean>;
      let duplicate!: Promise<boolean>;
      let overlap!: Promise<boolean>;
      act(() => {
        write = result.current.confirmRateChange();
        duplicate = result.current.confirmRateChange();
        overlap = result.current.upsertRate("EUR", "0.95");
        result.current.requestBatchConfirmation([sar]);
      });
      expect(await duplicate).toBe(false);
      expect(await overlap).toBe(false);
      expect(mocks.upsert).toHaveBeenCalledTimes(first === "single" ? 1 : 0);
      expect(mocks.batch).toHaveBeenCalledTimes(first === "batch" ? 1 : 0);
      await act(async () => {
        pending.reject(new Error("write failed"));
        expect(await write).toBe(false);
      });
      expect(result.current.isSaving).toBe(false);
      expect(mocks.resetKey).not.toHaveBeenCalled();
      mocks.upsert.mockResolvedValue(eur);
      mocks.batch.mockResolvedValue([eur]);
      await act(async () => { expect(await result.current.upsertRate("EUR", "0.94")).toBe(true); });
      await act(async () => { expect(await result.current.confirmRateChange()).toBe(true); });
      expect(mocks.resetKey).toHaveBeenCalledTimes(1);
    });
  }

  for (const kind of ["status", "batch"] as const) {
    it(`accepts one of two rapid ${kind} confirmation clicks`, async () => {
      const pending = deferred<CurrencyRateView | CurrencyRateView[]>();
      mocks.upsert.mockReturnValue(pending.promise);
      mocks.batch.mockReturnValue(pending.promise);
      const { result } = renderHook(() => useCurrencyRates());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => {
        if (kind === "status") result.current.toggleRateStatus(eur);
        else result.current.requestBatchConfirmation([{ ...eur, currencyUnitsPerUsd: "0.94" }]);
      });
      let write!: Promise<boolean>;
      let duplicate!: Promise<boolean>;
      act(() => {
        write = result.current.confirmRateChange();
        duplicate = result.current.confirmRateChange();
      });
      expect(await duplicate).toBe(false);
      expect(mocks.upsert).toHaveBeenCalledTimes(kind === "status" ? 1 : 0);
      expect(mocks.batch).toHaveBeenCalledTimes(kind === "batch" ? 1 : 0);
      await act(async () => {
        pending.resolve(kind === "status" ? { ...eur, isActive: false } : [eur]);
        await write;
      });
      expect(result.current.confirmation).toBeNull();
    });
  }
});
