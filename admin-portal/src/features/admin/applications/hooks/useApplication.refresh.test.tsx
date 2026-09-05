// @vitest-environment jsdom

import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ApplicationDatabaseServerBindReceipt,
  BindApplicationDatabaseServersDto,
} from "../types";

const { getMock, getManifestsMock, bindMock, toastMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  getManifestsMock: vi.fn(),
  bindMock: vi.fn(),
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("../api/applications.api", () => ({
  applicationsApi: {
    get: getMock,
    getManifests: getManifestsMock,
    bindDatabaseServers: bindMock,
  },
}));

// The real mutation awaits `onSuccess` — the reconciling re-read — before it
// hands the command result back to its caller. That ordering is the whole
// subject of this test, so it is reproduced rather than stubbed away.
vi.mock("@/shared/hooks/useActionMutation", () => ({
  useActionMutation: () => ({
    isMutating: false,
    mutate: async <TResult,>(
      _intent: unknown,
      action: (idempotencyKey: string) => Promise<TResult>,
      options?: { onSuccess?: (result: TResult) => void | Promise<void> },
    ) => {
      const result = await action("019f0000-0000-7000-8000-0000000000aa");
      await options?.onSuccess?.(result);
      return result;
    },
  }),
}));

vi.mock("@/components/ui/ToastContext", () => ({ useToast: () => toastMock }));
vi.mock("@/shared/api/normalized-api-error", () => ({
  normalizeApiError: (error: unknown) => error,
}));

import { useApplication } from "./useApplication";

const APPLICATION = { key: "crm", name: "CRM" };
const BIND_DTO: BindApplicationDatabaseServersDto = {
  databaseServerIds: ["server-a", "server-b"],
  expectedCatalogueRevision: "7",
  expectedPolicyRevision: "3",
  reason: "Roll the CRM schema onto the fleet",
};
const RECEIPT = {
  results: [
    { databaseServerId: "server-a", outcome: "BOUND" },
    { databaseServerId: "server-b", outcome: "FAILED" },
  ],
} as unknown as ApplicationDatabaseServerBindReceipt;

let dialogMounts = 0;

describe("useApplication reconciling re-read", () => {
  beforeEach(() => {
    dialogMounts = 0;
    getMock.mockReset().mockResolvedValue(APPLICATION);
    getManifestsMock.mockReset().mockResolvedValue([]);
    bindMock.mockReset().mockResolvedValue(RECEIPT);
    toastMock.error.mockReset();
  });

  /**
   * The binding command answers with a per-server report rather than throwing
   * on a partial failure, and the dialog is the only place that report is ever
   * shown. If the page blanks itself while the command's re-read is in flight,
   * the dialog holding the report is torn down and comes back empty.
   */
  it("keeps the dialog that issued a command mounted to render its receipt", async () => {
    render(<ApplicationDetailHarness applicationKey="crm" />);
    await screen.findByRole("button", { name: "Bind database servers" });
    expect(dialogMounts).toBe(1);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Bind database servers" }));
    });

    await waitFor(() =>
      expect(screen.getByTestId("bind-receipt")).toHaveTextContent(
        "server-a:BOUND server-b:FAILED",
      ),
    );
    // Not "was re-rendered with the same value": the dialog was never replaced,
    // so the operator is still looking at the instance they submitted from.
    expect(dialogMounts).toBe(1);
    expect(screen.queryByText("Loading application")).toBeNull();
    // The application was re-read, which is the point of reconciling.
    expect(getMock).toHaveBeenCalledTimes(2);
  });

  /**
   * A reconciling re-read that fails must not throw away the snapshot already
   * on screen. It reports through the toast the fetch already raises.
   */
  it("keeps the last good snapshot when the reconciling re-read fails", async () => {
    getMock
      .mockReset()
      .mockResolvedValueOnce(APPLICATION)
      .mockRejectedValue(Object.assign(new Error("gateway timeout"), {
        message: "gateway timeout",
      }));

    render(<ApplicationDetailHarness applicationKey="crm" />);
    await screen.findByRole("button", { name: "Bind database servers" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Bind database servers" }));
    });

    await waitFor(() =>
      expect(screen.getByTestId("bind-receipt")).toHaveTextContent(
        "server-a:BOUND server-b:FAILED",
      ),
    );
    expect(screen.queryByText("Application unavailable")).toBeNull();
    expect(toastMock.error).toHaveBeenCalled();
  });

  /**
   * The very first read has nothing to show, so it still owns the page-level
   * loading state — otherwise the page would render an empty detail frame.
   */
  it("still reports the first read as loading", async () => {
    let resolveFirst!: (value: unknown) => void;
    getMock.mockReset().mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );

    render(<ApplicationDetailHarness applicationKey="crm" />);
    await screen.findByText("Loading application");

    await act(async () => {
      resolveFirst(APPLICATION);
    });
    await screen.findByRole("button", { name: "Bind database servers" });
  });
});

/** Mirrors the detail route's own gates over the hook. */
function ApplicationDetailHarness({ applicationKey }: { applicationKey: string }) {
  const detail = useApplication(applicationKey);
  if (detail.isLoading) return <p>Loading application</p>;
  if (detail.error || !detail.application) return <p>Application unavailable</p>;
  return <BindReceiptDialog onBind={detail.bindDatabaseServers} />;
}

function BindReceiptDialog({
  onBind,
}: {
  onBind: (
    dto: BindApplicationDatabaseServersDto,
  ) => Promise<ApplicationDatabaseServerBindReceipt>;
}) {
  const [receipt, setReceipt] = useState<string | null>(null);
  const [mounted] = useState(() => {
    dialogMounts += 1;
    return dialogMounts;
  });

  const submit = async () => {
    const result = await onBind(BIND_DTO);
    setReceipt(
      result.results
        .map((row) => `${row.databaseServerId}:${row.outcome}`)
        .join(" "),
    );
  };

  return (
    <div data-instance={mounted}>
      <button type="button" onClick={() => void submit()}>
        Bind database servers
      </button>
      <output data-testid="bind-receipt">{receipt ?? "no-receipt"}</output>
    </div>
  );
}
