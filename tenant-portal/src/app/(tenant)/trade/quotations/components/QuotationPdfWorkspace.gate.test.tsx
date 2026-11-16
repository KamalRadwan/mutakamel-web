// @vitest-environment jsdom
import type { ReactElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog, DialogTrigger } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { QuotationPdfWorkspace } from "./QuotationPdfWorkspace";
import { DETAIL_WITH_REVISION, HEADERS } from "../hooks/quotation-composer.test-fixtures";
import type { TradePdfJobState } from "../../documents/hooks/useTradePdfJob";

const state = vi.hoisted(() => ({
  eligible: false,
  canChangeTemplate: true,
  locked: false,
  cancelledJobStatus: undefined as "COMPLETED" | undefined,
  language: "en" as "ar" | "en",
  writeErrorMessage: undefined as string | undefined,
  templateErrorReference: undefined as string | undefined,
  writeError: null as TradePdfJobState["write"]["writeError"],
  openTemplates: vi.fn(),
  unknown: false,
  job: null as TradePdfJobState["job"],
  uiStatus: null as TradePdfJobState["uiStatus"],
  refresh: vi.fn(),
  render: vi.fn(),
  download: vi.fn(),
}));
vi.mock("../hooks/useQuotationPdfWorkspace", () => ({
  useQuotationPdfWorkspace: () => ({
    t: state.language === "ar" ? ar : en,
    eligible: state.eligible,
    canChangeTemplate: state.canChangeTemplate,
    locked: state.locked,
    cancelledJobStatus: state.cancelledJobStatus,
    reason: en.quotationPdf.savedDraftHint,
    locale: "en-US",
    timeZone: "Africa/Cairo",
    viewer: {},
    library: { setOpen: state.openTemplates },
    writeErrorMessage: state.writeErrorMessage,
    templateErrorReference: state.templateErrorReference,
    pdf: {
      job: state.job,
      uiStatus: state.uiStatus,
      refresh: state.refresh,
      write: { ambiguous: state.unknown ? { operation: "PDF" } : null, writeError: state.writeError },
    },
    render: state.render,
    download: state.download,
  }),
}));
vi.mock("../../documents/components/TradeBoundaryStates", () => ({ TradeWriteOutcome: () => <p>Recover the original PDF request</p> }));
vi.mock("./QuotationTemplateGallery", () => ({
  QuotationTemplateGallery: ({ trigger }: { trigger: ReactElement }) => (
    <Dialog open={false} onOpenChange={state.openTemplates}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <p>Template gallery</p>
    </Dialog>
  ),
}));
vi.mock("./QuotationPdfViewer", () => ({
  QuotationPdfViewer: ({ renewal }: { renewal?: { refresh: () => Promise<void> } }) => (
    <div>
      <p>Actual viewer</p>
      {renewal ? <button onClick={() => void renewal.refresh()}>Refresh from viewer</button> : null}
    </div>
  ),
}));

describe("quotation PDF workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.eligible = false;
    state.canChangeTemplate = true;
    state.locked = false;
    state.cancelledJobStatus = undefined;
    state.language = "en";
    state.writeErrorMessage = undefined;
    state.templateErrorReference = undefined;
    state.writeError = null;
    state.unknown = false;
    state.job = null;
    state.uiStatus = null;
  });
  afterEach(cleanup);
  it("shows a disabled export gate for DRAFT without exposing licensed configuration", () => {
    render(<QuotationPdfWorkspace quotation={DETAIL_WITH_REVISION} headers={HEADERS} />);
    expect(screen.getByText(en.quotationPdf.awaitingIssueTitle)).toBeTruthy();
    expect(screen.getByRole("button", { name: en.quotationPdf.exportPdf })).toBeDisabled();
    expect(screen.queryByText(en.quotationPdf.language)).toBeNull(); expect(screen.queryByText(en.quotationPdf.changeTemplate)).toBeNull();
    expect(screen.queryByText("Template gallery")).toBeNull(); expect(screen.queryByText("Actual viewer")).toBeNull();
  });
  it("keeps an existing unknown PDF request recoverable when eligibility changes", () => {
    state.unknown = true;
    render(<QuotationPdfWorkspace quotation={DETAIL_WITH_REVISION} headers={HEADERS} />);
    expect(screen.getByText("Recover the original PDF request")).toBeTruthy();
    expect(screen.getByRole("button", { name: en.quotationPdf.exportPdf })).toBeDisabled();
  });

  it.each(["en", "ar"] as const)("shows the settled request without offering a canceled quotation file in %s", (language) => {
    state.language = language;
    state.cancelledJobStatus = "COMPLETED";
    const copy = (language === "ar" ? ar : en).quotationPdf;

    render(<QuotationPdfWorkspace quotation={DETAIL_WITH_REVISION} headers={HEADERS} />);

    expect(screen.getByText(copy.previousRequestCompleted)).toHaveAttribute("role", "status");
    expect(screen.queryByText(copy.ready)).toBeNull();
    expect(screen.queryByRole("button", { name: copy.download })).toBeNull();
  });

  it.each([
    ["en", "noEligibleDefaultTemplate"], ["ar", "noEligibleDefaultTemplate"],
    ["en", "immutableTemplateIncompatible"], ["ar", "immutableTemplateIncompatible"],
  ] as const)("shows %s template refusal %s with the support reference and existing switch action", (language, copy) => {
    const t = language === "ar" ? ar : en;
    const correlationId = "019f0000-0000-7000-8000-000000000090";
    state.eligible = true;
    state.language = language;
    state.writeErrorMessage = t.quotationPdf[copy];
    state.templateErrorReference = correlationId;
    state.writeError = { status: 422, code: "TRADE.QUOTE.PDF_TEMPLATE_INCOMPATIBLE", correlationId };
    render(<QuotationPdfWorkspace quotation={{ ...DETAIL_WITH_REVISION, lifecycleStatus: "SENT" }} headers={HEADERS} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(t.quotationPdf[copy]);
    expect(alert).toHaveTextContent(t.errors.reference);
    expect(alert).toHaveTextContent(correlationId);
    expect(screen.queryByText(t.quotationPdf.queued)).toBeNull();
    expect(screen.queryByText(t.quotationPdf.failed)).toBeNull();
    const changeTemplate = screen.getByRole("button", { name: t.quotationPdf.changeTemplate });
    expect(changeTemplate).toHaveAttribute("type", "button");
    expect(changeTemplate).toBeEnabled();
    changeTemplate.focus();
    expect(changeTemplate).toHaveFocus();
    fireEvent.click(changeTemplate);
    expect(state.openTemplates).toHaveBeenCalledWith(true);
  });

  it.each(["en", "ar"] as const)("keeps the %s action disabled when template access is denied", language => {
    const t = language === "ar" ? ar : en;
    state.eligible = true;
    state.language = language;
    state.canChangeTemplate = false;
    state.writeError = { status: 422, code: "TRADE.QUOTE.PDF_TEMPLATE_INCOMPATIBLE" };
    state.writeErrorMessage = `${t.quotationPdf.defaultTemplateUnavailable} ${t.quotationPdf.defaultTemplateAdminHelp}`;
    render(<QuotationPdfWorkspace quotation={{ ...DETAIL_WITH_REVISION, lifecycleStatus: "SENT" }} headers={HEADERS} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(t.quotationPdf.defaultTemplateAdminHelp);
    expect(alert).not.toHaveTextContent(t.quotationPdf.templateLibraryCheck);
    const changeTemplate = screen.getByRole("button", { name: t.quotationPdf.changeTemplate });
    expect(changeTemplate).toBeDisabled();
    fireEvent.click(changeTemplate);
    expect(state.openTemplates).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: t.quotationPdf.generate })).toBeEnabled();
  });

  it("shows terminal failure without claiming the job is retrying", () => {
    state.eligible = true;
    state.uiStatus = "FAILED";
    state.job = { ...completedJob(null), status: "RETRYING", failure: { code: "TRADE.QUOTE.PDF_RENDER_FAILED", terminal: true } };
    render(<QuotationPdfWorkspace quotation={DETAIL_WITH_REVISION} headers={HEADERS} />);

    expect(screen.getByRole("alert")).toHaveTextContent(en.quotationPdf.failed);
    expect(screen.queryByText(en.quotationPdf.retrying)).toBeNull();
    expect(screen.getByRole("button", { name: en.quotationPdf.generateAgain })).toBeEnabled();
  });

  it("lets the user check the original completed job when artifact metadata is missing", () => {
    state.eligible = true;
    state.uiStatus = "ARTIFACT_EXPIRED";
    state.job = completedJob(null);
    render(<QuotationPdfWorkspace quotation={DETAIL_WITH_REVISION} headers={HEADERS} />);

    expect(screen.getByRole("status")).toHaveTextContent(en.tradeDocuments.errors.pdfArtifactUnavailable);
    expect(screen.queryByRole("button", { name: en.quotationPdf.download })).toBeNull();
    expect(screen.queryByText("Actual viewer")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.quotationPdf.resume }));
    expect(state.refresh).toHaveBeenCalledOnce();
    expect(state.render).not.toHaveBeenCalled();
  });

  it("keeps the verified preview available while refreshing an expired download link", () => {
    const downloadUrl = "https://files.example.test/quotation.pdf?signature=example";
    state.eligible = true;
    state.job = completedJob({ checksum: "checksum", sizeBytes: 100, pageCount: 1,
      completedAt: "2026-11-13T02:00:00.000Z", downloadUrl, downloadExpiresAt: "2026-11-13T02:05:00.000Z" });
    state.uiStatus = "SUCCEEDED";
    const { rerender } = render(<QuotationPdfWorkspace quotation={DETAIL_WITH_REVISION} headers={HEADERS} />);
    expect(screen.queryByRole("link", { name: en.quotationPdf.download })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.quotationPdf.download }));
    expect(state.download).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Refresh from viewer" })).toBeNull();

    state.uiStatus = "ARTIFACT_EXPIRED";
    rerender(<QuotationPdfWorkspace quotation={DETAIL_WITH_REVISION} headers={HEADERS} />);
    expect(screen.getByText("Actual viewer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.quotationPdf.download })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Refresh from viewer" }));
    expect(state.refresh).toHaveBeenCalledOnce();
  });

  it.each(["en", "ar"] as const)("links to the exact completed PDF workspace in %s", (language) => {
    state.eligible = true;
    state.language = language;
    state.job = completedJob({ checksum: "checksum", sizeBytes: 100, pageCount: 1,
      completedAt: "2026-11-13T02:00:00.000Z", downloadUrl: "https://files.example.test/signed",
      downloadExpiresAt: "2026-11-13T02:05:00.000Z" });
    const t = language === "ar" ? ar : en;
    const workspace = <QuotationPdfWorkspace quotation={DETAIL_WITH_REVISION} headers={HEADERS} />;
    const { rerender } = render(workspace);
    expect(screen.queryByRole("link", { name: t.quotationPdf.openPdfWorkspace })).toBeNull();

    state.uiStatus = "SUCCEEDED";
    rerender(<QuotationPdfWorkspace quotation={DETAIL_WITH_REVISION} headers={HEADERS} />);
    const link = screen.getByRole("link", { name: t.quotationPdf.openPdfWorkspace });
    expect(link).toHaveAttribute("href",
      `/trade/quotations/${DETAIL_WITH_REVISION.id}?pdfJobId=${state.job.renderJobId}#quotation-pdf-workspace`);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(state.render).not.toHaveBeenCalled();
    expect(state.download).not.toHaveBeenCalled();
  });
});

function completedJob(artifact: NonNullable<TradePdfJobState["job"]>["artifact"]): NonNullable<TradePdfJobState["job"]> {
  return { renderJobId: "01890000-0000-7000-8000-000000000002", status: "COMPLETED", attemptCount: 1,
    failure: null, statusUrl: "/api/tenant/trade/v1/quotations/job", artifact };
}
