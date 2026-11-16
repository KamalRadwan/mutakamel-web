// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FileUploadProps } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { ImportSourcePanel } from "./ImportSourcePanel";
import { useImportRuns } from "../hooks/useImportRuns";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  toast: { success: vi.fn(), outcomeFromApi: vi.fn() },
  scope: { headers: {}, permissions: ["trade.import.execute"], isTenantOwner: false },
}));

vi.mock("@/design-system", async (original) => ({
  ...await original<typeof import("@/design-system")>(),
  useToast: () => mocks.toast,
  // Exercise the panel's callback contract; shared picker screening has its own specs.
  FileUpload: ({ files, onFilesAdded, onRemove, onReject, labels, disabled }: FileUploadProps) => (
    <div>
      <input type="file" aria-label={labels.browse} disabled={disabled}
        onChange={(event) => onFilesAdded(Array.from(event.target.files ?? []))} />
      <button disabled={disabled} onClick={() => onReject?.(["Picker rejected this file"])}>
        Reject file
      </button>
      {files.map((entry) => (
        <div key={entry.id}>
          <span>{entry.file.name}</span>
          <span>{entry.status}</span>
          {entry.status === "uploading" && <div role="progressbar" aria-label="Uploading" />}
          <button disabled={disabled} aria-label={labels.remove.replace("{name}", entry.file.name)}
            onClick={() => onRemove(entry.id)}>Remove</button>
        </div>
      ))}
    </div>
  ),
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: null }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("../../trade-advanced-scope", () => ({
  useTradeScope: () => mocks.scope,
  useTradeBranchSelection: () => ({ branchIds: [], branchId: "", selectBranch: vi.fn() }),
  hasTradePermission: () => true,
}));
vi.mock("../../trade-api", () => ({
  tradeGet: mocks.get,
  tradePost: mocks.post,
  isTradeReplay: () => false,
}));

const previousSourceId = "01902001-3000-7000-8000-000000000001";
const uploadedSourceId = "01902001-3000-7000-8000-000000000002";

function UploadPanel() {
  const runs = useImportRuns();
  return (
    <ImportSourcePanel
      lang={runs.lang}
      sourceId={runs.sourceId}
      mappingId={runs.mappingId}
      onSourceIdChange={runs.setSourceId}
      onMappingIdChange={runs.setMappingId}
      onUpload={runs.uploadSource}
      onPreview={runs.startPreview}
      pending={runs.pending}
      disabled={!runs.canExecute}
      error={runs.formError}
    />
  );
}

async function renderPanel() {
  await act(async () => { render(<UploadPanel />); });
}

function selectFile(name = "source.csv") {
  fireEvent.change(screen.getByLabelText(en.tradeAutomation.uploadBrowse), {
    target: { files: [new File(["sku\nitem"], name, { type: "text/csv" })] },
  });
}

beforeEach(() => {
  mocks.get.mockReset().mockResolvedValue({ data: { items: [], total: 0, page: 1, limit: 50 } });
  mocks.post.mockReset();
  mocks.toast.success.mockReset();
  mocks.toast.outcomeFromApi.mockReset().mockReturnValue(false);
});
afterEach(cleanup);

describe("import source upload readiness", () => {
  it.each([
    [413, "TRADE.IMPORT.FILE_TOO_LARGE", en.tradeAutomation.errorFileTooLarge],
    [403, "TRADE.AUTH.TARGET_DENIED", en.tradeCommon.actionFailed],
    [422, "TRADE.IMPORT.FILE_REJECTED", en.tradeAutomation.errorFileRejected],
  ] as const)("clears the chip and previous source after an HTTP %s rejection", async (status, code, message) => {
    mocks.post.mockRejectedValueOnce(new TenantApiClientError("Upload rejected", {
      status, statusText: "Rejected", headers: new Headers(), data: { errorCode: code },
    }));
    await renderPanel();
    const source = screen.getByPlaceholderText(en.tradeAutomation.sourceId);
    fireEvent.change(source, { target: { value: previousSourceId } });
    selectFile();

    await waitFor(() => expect(screen.getByText(message)).toBeInTheDocument());
    expect(source).toHaveValue("");
    expect(screen.queryByText("source.csv")).not.toBeInTheDocument();
    expect(screen.queryByText("ready")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.tradeAutomation.queuePreview })).toBeDisabled();
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });

  it("keeps preview disabled until the current upload supplies a source ID", async () => {
    let finish!: (value: { data: { id: string }; headers: Headers }) => void;
    mocks.post.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await renderPanel();
    const source = screen.getByPlaceholderText(en.tradeAutomation.sourceId);
    const preview = screen.getByRole("button", { name: en.tradeAutomation.queuePreview });
    expect(preview).toBeDisabled();
    fireEvent.change(source, { target: { value: previousSourceId } });
    selectFile();

    expect(source).toHaveValue("");
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(preview).toBeDisabled();
    await act(async () => {
      finish({ data: { id: uploadedSourceId }, headers: new Headers() });
    });

    expect(source).toHaveValue(uploadedSourceId);
    expect(screen.getByText("source.csv")).toBeInTheDocument();
    expect(screen.getByText("ready")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(preview).toBeEnabled();
    expect(mocks.toast.success).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: en.tradeAutomation.uploadRemove.replace("{name}", "source.csv") }));
    expect(source).toHaveValue("");
    expect(screen.queryByText("source.csv")).not.toBeInTheDocument();
    expect(preview).toBeDisabled();
  });

  it("clears an existing source when the picker rejects a file", async () => {
    await renderPanel();
    const source = screen.getByPlaceholderText(en.tradeAutomation.sourceId);
    fireEvent.change(source, { target: { value: previousSourceId } });
    fireEvent.click(screen.getByRole("button", { name: "Reject file" }));

    expect(source).toHaveValue("");
    expect(screen.getByRole("button", { name: en.tradeAutomation.queuePreview })).toBeDisabled();
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
