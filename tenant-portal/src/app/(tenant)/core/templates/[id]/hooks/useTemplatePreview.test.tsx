// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { TemplatePreviewJob } from "../../template-lifecycle-contract";
import type { TemplateDetail } from "../../templates-contract";
import { TemplatePreviewPanel } from "../components/TemplatePreviewPanel";
import { useTemplatePreview } from "./useTemplatePreview";

const io = vi.hoisted(() => ({ request: vi.fn(), status: vi.fn() }));
let dictionary = en;
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionary }) }));
vi.mock("@/design-system", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/design-system")>(),
  useToast: () => ({ errorFromApi: vi.fn(), outcomeFromApi: vi.fn() }),
}));
vi.mock("../../template-lifecycle-api", () => ({
  requestPdfPreview: io.request,
  fetchPreviewJob: io.status,
  previewArtifactHref: (id: string) => `/preview-jobs/${id}/artifact`,
  previewTemplateEmail: vi.fn(),
  previewTemplateHtml: vi.fn(),
}));

const template: TemplateDetail = {
  id: "01900100-0000-7000-8000-000000000001", code: "QUOTE", name: "Quotation",
  description: null, documentType: "QUOTATION", outputChannel: "PRINT",
  layoutMode: "HYBRID_DOCUMENT", lifecycleStatus: "ACTIVE", locale: "en-US",
  direction: "LTR", dataSourceKey: "TRADE_QUOTATION_PRINT_V1", scope: { type: "TENANT" },
  systemProtected: false, definitionRevision: 2, definitionEtag: '"2"', etag: '"2"',
  draft: { draftId: "01900100-0000-7000-8000-000000000002", revision: 3, validationState: "PASSED" },
  currentDraft: { draftId: "01900100-0000-7000-8000-000000000002", revision: 3,
    validationState: "PASSED", contentChecksum: "a".repeat(64), etag: '"3"' },
  currentPublishedVersion: null,
  createdAt: "2026-10-17T00:00:00.000Z", updatedAt: "2026-10-17T00:00:00.000Z",
};
const job: TemplatePreviewJob = {
  renderJobId: "01900100-0000-7000-8000-000000000003",
  status: "PENDING", attemptCount: 0, createdAt: template.createdAt,
  nextRetryAt: null, failureCode: null, artifact: null,
};

function Preview() {
  const preview = useTemplatePreview(template, true);
  return <TemplatePreviewPanel template={template} preview={preview} />;
}

async function startPreview() {
  render(<Preview />);
  fireEvent.change(screen.getByRole("textbox", { name: dictionary.coreOperations.templates.fixtureKey }), {
    target: { value: "fixture" },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: dictionary.coreOperations.templates.previewPdf }));
  });
}

async function advancePolls(count: number) {
  for (let index = 0; index < count; index += 1) {
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  dictionary = en;
  io.request.mockResolvedValue(job.renderJobId);
  io.status.mockResolvedValue(job);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("PDF preview monitoring recovery", () => {
  it.each([
    ["English", en, "PENDING"],
    ["Arabic", ar, "RETRYING"],
  ] as const)("resumes the same job after 60 pending responses in %s", async (_language, copy, status) => {
    dictionary = copy;
    io.status.mockResolvedValue({ ...job, status });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    await startPreview();
    await advancePolls(58);
    expect(io.status).toHaveBeenCalledTimes(59);
    expect(screen.queryByText(copy.coreOperations.templates.pdfMonitoringPaused)).toBeNull();
    await advancePolls(1);
    expect(io.status).toHaveBeenCalledTimes(60);
    expect(screen.getByRole("status").textContent).toContain(copy.coreOperations.templates.pdfMonitoringPaused);
    expect(screen.getByRole("status").getAttribute("aria-busy")).toBeNull();
    expect(screen.queryByText(copy.coreOperations.templates.jobFailed)).toBeNull();
    await advancePolls(10);
    expect(io.status).toHaveBeenCalledTimes(60);

    io.status.mockResolvedValue({ ...job, status: "COMPLETED", artifact: {
      downloadUrlExpiresAt: "2026-10-19T00:00:00.000Z", sizeBytes: 1234, pageCount: 1,
    } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: copy.coreOperations.templates.pdfResumeMonitoring }));
    });
    expect(io.status).toHaveBeenCalledTimes(61);
    expect(io.status.mock.calls.every(([id]) => id === job.renderJobId)).toBe(true);
    expect(io.request).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(copy.coreOperations.templates.pdfMonitoringPaused)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: copy.coreOperations.templates.jobDownload }));
    expect(open).toHaveBeenCalledWith(`/preview-jobs/${job.renderJobId}/artifact`, "_blank", "noopener,noreferrer");
    await advancePolls(2);
    expect(io.status).toHaveBeenCalledTimes(61);
  });

  it("bounds each resumed window and stops timers on unmount", async () => {
    await startPreview();
    await advancePolls(59);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.coreOperations.templates.pdfResumeMonitoring }));
    });
    await advancePolls(59);
    expect(io.status).toHaveBeenCalledTimes(120);
    expect(screen.getByText(en.coreOperations.templates.pdfMonitoringPaused)).toBeTruthy();
    expect(io.request).toHaveBeenCalledTimes(1);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: en.coreOperations.templates.pdfResumeMonitoring }));
    });
    cleanup();
    await advancePolls(2);
    expect(io.status).toHaveBeenCalledTimes(121);
  });
});
