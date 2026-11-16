// @vitest-environment jsdom
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { QuotationPdfViewer } from "./QuotationPdfViewer";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/i18n/useLanguage", () => ({ useDictionary: () => en, useDirection: () => "ltr" }));

const download = { run: vi.fn(), busy: false, disabled: false };
const downloadName = { name: en.quotationPdf.download, exact: true };

describe("quotation PDF preview", () => {
  afterEach(cleanup);

  it("shows loading until the verified blob is ready and exposes a protected Download action", () => {
    const viewer = { open: true, setOpen: vi.fn(), url: null, error: false, loading: false, retry: vi.fn() };
    const action = { ...download, run: vi.fn() };
    const { rerender } = render(<QuotationPdfViewer viewer={viewer} download={action} />);

    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText(en.common.loading)).toBeInTheDocument();
    expect(dialog.queryByText(en.quotationPdf.ready)).toBeNull();
    expect(dialog.queryByTitle(en.quotationPdf.previewActual)).toBeNull();
    expect(dialog.queryByRole("link", downloadName)).toBeNull();
    const button = dialog.getByRole("button", downloadName);
    button.focus();
    fireEvent.click(button);
    expect(action.run).toHaveBeenCalledOnce();

    rerender(<QuotationPdfViewer viewer={viewer} download={{ ...action, busy: true, disabled: true }} />);
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(action.run).toHaveBeenCalledOnce();

    rerender(<QuotationPdfViewer viewer={{ ...viewer, url: "blob:verified" }} download={action} />);
    expect(dialog.getByText(en.quotationPdf.ready)).toBeInTheDocument();
    expect(dialog.getByTitle(en.quotationPdf.previewActual)).toHaveAttribute("src", "blob:verified");
  });

  it("offers retry and hides download when the preview fails without a current signed link", () => {
    const retry = vi.fn();
    const viewer = { open: true, setOpen: vi.fn(), url: null, error: true, loading: false, retry };
    render(<QuotationPdfViewer viewer={viewer} />);

    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("alert")).toHaveTextContent(en.tradeDocuments.errors.pdfArtifactUnavailable);
    expect(dialog.queryByText(en.quotationPdf.ready)).toBeNull();
    expect(dialog.queryByRole("button", downloadName)).toBeNull();
    fireEvent.click(dialog.getByRole("button", { name: en.quotationPdf.retry }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("reports Preview and Download failures separately and retries only Preview", () => {
    const retry = vi.fn();
    const viewer = { open: true, setOpen: vi.fn(), url: null, error: true, loading: false, retry };
    const action = { ...download, run: vi.fn(), error: "Download service is unavailable" };
    render(<QuotationPdfViewer viewer={viewer} download={action} />);

    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getAllByRole("alert")).toHaveLength(2);
    expect(dialog.getByText(en.quotationPdf.previewFailed)).toBeInTheDocument();
    expect(dialog.getByText(action.error)).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: en.quotationPdf.retry }));
    expect(retry).toHaveBeenCalledOnce();
    expect(action.run).not.toHaveBeenCalled();
  });

  it("rechecks job status after a protected artifact 404 and keeps Retry focused while busy", () => {
    const accessError = { status: 404, code: "TRADE.QUOTE.PDF_NOT_FOUND" };
    const viewer = { open: true, setOpen: vi.fn(), url: null, error: true, loading: false, retry: vi.fn(), accessError };
    const refresh = vi.fn(async () => {});
    const recovery = { refresh, busy: false, disabled: false, error: en.tradeDocuments.errors.pdfNotFound };
    const { rerender } = render(<QuotationPdfViewer viewer={{ ...viewer, error: false, url: "blob:previous" }} download={download} />);

    const dialog = within(screen.getByRole("dialog"));
    dialog.getByRole("button", downloadName).focus();
    rerender(<QuotationPdfViewer viewer={viewer} accessRecovery={recovery} />);
    expect(dialog.getByRole("alert")).toHaveTextContent(en.tradeDocuments.errors.pdfNotFound);
    expect(dialog.queryByRole("button", downloadName)).toBeNull();
    const retry = dialog.getByRole("button", { name: en.quotationPdf.retry });
    expect(retry).toHaveFocus();
    fireEvent.click(retry);
    expect(refresh).toHaveBeenCalledOnce();
    expect(viewer.retry).not.toHaveBeenCalled();

    rerender(<QuotationPdfViewer viewer={viewer} accessRecovery={{ ...recovery, busy: true }} />);
    expect(retry).toHaveFocus();
    expect(retry).toHaveAttribute("aria-busy", "true");
    expect(retry).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(retry);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("moves focus between download and refresh as the link expires and is renewed", () => {
    const viewer = { open: true, setOpen: vi.fn(), url: "blob:verified", error: false, loading: false, retry: vi.fn() };
    const refresh = vi.fn(async () => {});
    const { rerender } = render(<QuotationPdfViewer viewer={viewer} download={download} />);
    const dialog = within(screen.getByRole("dialog"));
    const frame = dialog.getByTitle(en.quotationPdf.previewActual);
    const renewal = { refresh, busy: false, disabled: false, error: null };
    dialog.getByRole("button", downloadName).focus();

    rerender(<QuotationPdfViewer viewer={viewer} renewal={renewal} />);
    expect(dialog.getByText(en.quotationPdf.expired)).toBeInTheDocument();
    expect(dialog.queryByRole("button", downloadName)).toBeNull();
    const refreshButton = dialog.getByRole("button", { name: en.quotationPdf.refreshLink });
    expect(refreshButton).toHaveFocus();
    fireEvent.click(refreshButton);
    expect(refresh).toHaveBeenCalledOnce();

    rerender(<QuotationPdfViewer viewer={viewer} renewal={{ ...renewal, busy: true }} />);
    expect(refreshButton).toHaveFocus();
    expect(refreshButton).toHaveAttribute("aria-busy", "true");
    expect(refreshButton).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(refreshButton);
    expect(refresh).toHaveBeenCalledOnce();
    expect(dialog.getByTitle(en.quotationPdf.previewActual)).toBe(frame);

    rerender(<QuotationPdfViewer viewer={viewer} renewal={{ ...renewal, error: en.quotationPdf.requestError }} />);
    expect(dialog.getByRole("alert")).toHaveTextContent(en.quotationPdf.requestError);
    expect(refreshButton).toHaveFocus();
    expect(refreshButton).not.toHaveAttribute("aria-disabled");
    fireEvent.click(refreshButton);
    expect(refresh).toHaveBeenCalledTimes(2);

    rerender(<QuotationPdfViewer viewer={viewer} download={download} />);
    expect(dialog.getByRole("button", downloadName)).toHaveFocus();
    expect(dialog.getByTitle(en.quotationPdf.previewActual)).toBe(frame);
    expect(viewer.setOpen).not.toHaveBeenCalled();
  });

  it("keeps focus on Close when the operator moves there during renewal and returns it to the trigger on Escape", async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    const refresh = vi.fn(() => promise);
    function ControlledViewer({ disabled = false }: { disabled?: boolean }) {
      const [open, setOpen] = useState(false);
      const [busy, setBusy] = useState(false);
      const [renewed, setRenewed] = useState(false);
      const viewer = { open, setOpen, url: "blob:verified", error: false, loading: false, retry: vi.fn() };
      const renew = async () => {
        setBusy(true);
        await refresh();
        setRenewed(true);
        setBusy(false);
      };
      const renewal = { refresh: renew, busy, disabled, error: null };
      return <QuotationPdfViewer viewer={viewer} download={renewed ? download : undefined} renewal={renewed ? undefined : renewal} />;
    }

    const { rerender } = render(<ControlledViewer disabled />);
    const trigger = screen.getByRole("button", { name: en.quotationPdf.previewActual });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("heading", { name: en.quotationPdf.previewActual })).toHaveFocus();
    const refreshButton = dialog.getByRole("button", { name: en.quotationPdf.refreshLink });
    expect(refreshButton).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(refreshButton);
    expect(refresh).not.toHaveBeenCalled();

    rerender(<ControlledViewer />);
    refreshButton.focus();
    fireEvent.click(refreshButton);
    expect(refresh).toHaveBeenCalledOnce();
    expect(refreshButton).toHaveAttribute("aria-busy", "true");
    expect(refreshButton).toHaveFocus();

    const close = dialog.getByRole("button", { name: en.common.close });
    close.focus();
    expect(close).toHaveFocus();
    await act(async () => { resolve(); });
    expect(dialog.getByRole("button", downloadName)).toBeInTheDocument();
    expect(close).toHaveFocus();

    fireEvent.keyDown(close, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
