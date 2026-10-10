// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The view reads its language from the model; only the shared confirmation
// dialog reads the I18n context.
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ lang: "en" }) }));

import { TenantProvisioningWorkspaceView } from "./TenantProvisioningWorkspaceView";
import type {
  ProvisioningConfirmation,
  TenantProvisioningWorkspaceModel,
} from "../hooks/useTenantProvisioningWorkspace";
import { buildRepairOperationDto } from "../model/commands";
import {
  provisioningActionState,
  repairExitFromHistory,
} from "../model/operation-actions";
import {
  readTenantComponentInstallation,
  readTenantOperationDetail,
  readTenantOperationSummary,
  readTenantSeedState,
} from "../model/readers";
import {
  META,
  OPERATION_ID,
  RETRY_OPERATION_ID,
  componentInstallation,
  operationDetail,
  operationExits,
  operationSummary,
  seedState,
} from "../test/fixtures";

describe("TenantProvisioningWorkspaceView", () => {
  it("renders real operation progress and dispatches operation-specific cancel", () => {
    const model = makeModel();
    const { unmount } = render(<TenantProvisioningWorkspaceView model={model} />);

    expect(screen.getByText("Tenant provisioning")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("Schema installation started.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Initial provision/i })).toHaveAttribute("aria-current", "true");
    // Cancelling asks first: the click names the operation, nothing is sent.
    fireEvent.click(screen.getByRole("button", { name: "Request cancel" }));
    expect(model.requestCancel).toHaveBeenCalledWith(
      expect.objectContaining({ id: OPERATION_ID }),
    );
    expect(model.provisioning.cancelOperation).not.toHaveBeenCalled();
    unmount();

    const confirming = makeModel({ confirming: "cancel" });
    render(<TenantProvisioningWorkspaceView model={confirming} />);
    expect(
      screen.getByText("Request cancellation of Initial provision · generation 1?"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Request cancel" }));
    expect(confirming.confirmPending).toHaveBeenCalled();
  });

  it("offers re-provisioning after cancellation has completed", () => {
    const model = makeModel({ operationStatus: "CANCELLED" });
    render(<TenantProvisioningWorkspaceView model={model} />);
    fireEvent.click(screen.getByRole("button", { name: "Re-provision" }));
    expect(model.requestRetry).toHaveBeenCalledWith(
      expect.objectContaining({ id: OPERATION_ID }),
    );
  });

  it("explains pending cancellation and keeps re-provisioning visible but disabled", () => {
    render(<TenantProvisioningWorkspaceView model={makeModel({ operationStatus: "CANCEL_REQUESTED" })} />);
    expect(screen.getByRole("button", { name: "Re-provision" })).toBeDisabled();
    expect(screen.getByText(/Cancellation is still in progress/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request cancel" })).not.toBeInTheDocument();
  });

  it("blocks managed repair while cancellation is pending and links to the operation", () => {
    const model = makeModel({ section: "managed", operationStatus: "CANCEL_REQUESTED" });
    render(<TenantProvisioningWorkspaceView model={model} />);
    expect(screen.getByRole("button", { name: "Create repair" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "View current operation" }));
    expect(model.setSection).toHaveBeenCalledWith("operations");
    expect(model.provisioning.selectOperation).toHaveBeenCalledWith(OPERATION_ID);
  });

  it("offers retry for a retryable latest operation", () => {
    const model = makeModel({ operationStatus: "FAILED_RETRYABLE" });
    render(<TenantProvisioningWorkspaceView model={model} />);

    const retry = screen.getByRole("button", { name: /^Re-provision$/u });
    fireEvent.click(retry);

    expect(model.requestRetry).toHaveBeenCalledWith(
      expect.objectContaining({ id: OPERATION_ID }),
    );
  });

  it("treats a superseded retryable operation as read-only history", () => {
    const model = makeModel({
      operationStatus: "FAILED_RETRYABLE",
      selectedGeneration: 6,
      latestGeneration: 7,
    });
    render(<TenantProvisioningWorkspaceView model={model} />);

    expect(
      screen.queryByRole("button", { name: /^Re-provision$/u }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /generation 6 was superseded by generation 7; retry and cancel actions are available only for the latest operation/i,
      ),
    ).toBeInTheDocument();
    expect(model.provisioning.retryOperation).not.toHaveBeenCalled();
  });

  it("hides cancel for a superseded active operation", () => {
    const model = makeModel({ selectedGeneration: 6, latestGeneration: 7 });
    render(<TenantProvisioningWorkspaceView model={model} />);

    expect(
      screen.queryByRole("button", { name: "Request cancel" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/this is a historical operation/i),
    ).toBeInTheDocument();
    expect(model.provisioning.cancelOperation).not.toHaveBeenCalled();
  });

  it("localizes command refusals and points a release-upgrade refusal at Updates", () => {
    const model = makeModel({
      localError: "TENANT_PROVISIONING_OPERATION_SUPERSEDED",
    });
    const { unmount } = render(<TenantProvisioningWorkspaceView model={model} />);

    expect(
      screen.getByText(
        /this operation was superseded by a newer generation\. refresh the history and select the latest operation/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open updates" })).toBeNull();
    unmount();

    const lagging = makeModel({
      localError: "TENANT_PROVISIONING_RELEASE_UPGRADE_REQUIRED",
    });
    render(<TenantProvisioningWorkspaceView model={lagging} />);
    expect(
      screen.getByText(/runs an earlier release.*from the Updates section of the Provisioning tab/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open updates" }));
    expect(lagging.setSection).toHaveBeenCalledWith("updates");
  });

  it("uses add-Application terminology and contains no stale reconcile/add-module action", () => {
    const model = makeModel({ section: "managed" });
    const { container } = render(<TenantProvisioningWorkspaceView model={model} />);

    expect(screen.getByText("Add Application")).toBeInTheDocument();
    expect(screen.getByText("Create add operation")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/add module/i);
    expect(container.textContent).not.toMatch(/reconcile/i);
  });

  it("fails closed when an older seed response omits revision and enables exact resolution when exposed", () => {
    const hidden = makeModel({ section: "state", seedRevision: null });
    const { rerender } = render(
      <TenantProvisioningWorkspaceView model={hidden} />,
    );
    const disabled = screen.getByRole("button", { name: "Resolve conflict" });
    expect(disabled).toBeDisabled();
    expect(screen.getByText(/omitted expectedConflictRevision/i)).toBeInTheDocument();

    const exposed = makeModel({ section: "state", seedRevision: 3 });
    rerender(<TenantProvisioningWorkspaceView model={exposed} />);
    const enabled = screen.getByRole("button", { name: "Resolve conflict" });
    expect(enabled).toBeEnabled();
    fireEvent.click(enabled);
    expect(exposed.resolveConflict).toHaveBeenCalled();
  });

  it("renders the compact workflow in Arabic and preserves RTL direction", () => {
    const model = makeModel({ lang: "ar" });
    const { container } = render(<TenantProvisioningWorkspaceView model={model} />);

    expect(screen.getByText("تجهيز المستأجر")).toBeInTheDocument();
    expect(container.querySelector("section")?.getAttribute("dir")).toBe("rtl");
    expect(screen.getByRole("button", { name: "طلب الإلغاء" })).toBeInTheDocument();
  });

  // The step table used to print `core.foundation.schema` / `SCHEMA` /
  // `STEP_STARTED` at the reader. It names them now, and keeps the plan key
  // beside the name because that is what an operator pastes into a query.
  it("names steps, kinds and timeline events instead of printing plan keys", () => {
    render(<TenantProvisioningWorkspaceView model={makeModel()} />);

    expect(screen.getByText("Core foundation — schema")).toBeInTheDocument();
    expect(screen.getByText("core.foundation.schema")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Schema" })).toBeInTheDocument();
    expect(screen.getByText("Step started")).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "STEP_STARTED" })).toBeNull();
  });

  it("names them in Arabic too, with the key left untranslated", () => {
    render(<TenantProvisioningWorkspaceView model={makeModel({ lang: "ar" })} />);

    expect(screen.getByText("أساس النواة — المخطط")).toBeInTheDocument();
    expect(screen.getByText("core.foundation.schema")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "المخطط" })).toBeInTheDocument();
    expect(screen.getByText("بدأت الخطوة")).toBeInTheDocument();
  });

  it("disables prerequisite requests when the selected plan has none", () => {
    const model = makeModel({ section: "prerequisites", prerequisiteCount: 0 });
    render(<TenantProvisioningWorkspaceView model={model} />);

    expect(screen.getByRole("button", { name: "Request" })).toBeDisabled();
    expect(screen.getByText(/plan has no backup or maintenance prerequisites/i)).toBeInTheDocument();
  });

  it("enables prerequisite requests only when the selected plan requires them", () => {
    const model = makeModel({ section: "prerequisites", prerequisiteCount: 1 });
    render(<TenantProvisioningWorkspaceView model={model} />);

    const request = screen.getByRole("button", { name: "Request" });
    expect(request).toBeEnabled();
    fireEvent.click(request);
    expect(model.requestSelectedPrerequisites).toHaveBeenCalled();
  });
});

function makeModel(
  options: {
    lang?: "ar" | "en";
    section?: "operations" | "updates" | "state" | "prerequisites" | "managed";
    seedRevision?: number | null;
    prerequisiteCount?: number;
    operationStatus?: "RUNNING" | "FAILED_RETRYABLE" | "CANCEL_REQUESTED" | "CANCELLED";
    selectedGeneration?: number;
    latestGeneration?: number;
    localError?: string;
    confirming?: ProvisioningConfirmation["kind"];
  } = {},
): TenantProvisioningWorkspaceModel {
  const operationStatus = options.operationStatus ?? "RUNNING";
  const selectedGeneration = options.selectedGeneration ?? 1;
  const superseded =
    options.latestGeneration !== undefined &&
    options.latestGeneration > selectedGeneration;
  const summary = readTenantOperationSummary(
    operationSummary({ status: operationStatus, generation: selectedGeneration }),
  );
  const detail = readTenantOperationDetail(
    operationDetail({
      status: operationStatus,
      generation: selectedGeneration,
      prerequisiteCount: options.prerequisiteCount ?? 0,
      // A newer generation in these fixtures has always succeeded.
      exits: operationExits(operationStatus, {
        superseded,
        latestStatus: superseded ? "SUCCEEDED" : operationStatus,
      }),
    }),
  );
  const component = readTenantComponentInstallation(componentInstallation());
  const confirmation: ProvisioningConfirmation | null =
    options.confirming === "repair"
      ? { kind: "repair", component, dto: buildRepairOperationDto(component, "ADMIN.REPAIR") }
      : options.confirming
        ? { kind: options.confirming, operation: detail }
        : null;
  const operations = [summary];
  if (superseded) {
    operations.unshift(
      readTenantOperationSummary(
        operationSummary({
          id: RETRY_OPERATION_ID,
          generation: options.latestGeneration,
          type: "RETRY",
          status: "SUCCEEDED",
        }),
      ),
    );
  }
  const seed = readTenantSeedState(
    seedState(
      options.seedRevision === undefined
        ? { revision: 3 }
        : options.seedRevision === null
          ? {}
          : { revision: options.seedRevision },
    ),
  );
  const ready = <T,>(data: T) => ({
    status: "ready" as const,
    data,
    error: null,
    refreshing: false,
  });
  const noop = vi.fn();
  const asyncNoop = vi.fn().mockResolvedValue(undefined);
  const latestOperation = operations.reduce((a, b) => a.generation > b.generation ? a : b);
  return {
    lang: options.lang ?? "en",
    dir: options.lang === "ar" ? "rtl" : "ltr",
    latestOperation,
    hasOpenOperation: ["REQUESTED", "PLANNING", "QUEUED", "RUNNING", "WAITING_RETRY", "CANCEL_REQUESTED"].includes(latestOperation.status),
    operationActions: {
      cancel: provisioningActionState("cancel", detail.exits.cancel, true, false),
      retry: provisioningActionState("retry", detail.exits.retry, true, false),
    },
    repairAction: provisioningActionState(
      "repair",
      detail.exits.repair.allowed ? repairExitFromHistory(latestOperation) : detail.exits.repair,
      true,
      false,
    ),
    confirmation,
    requestCancel: noop,
    requestRetry: noop,
    requestRepair: noop,
    dismissConfirmation: noop,
    confirmPending: asyncNoop,
    section: options.section ?? "operations",
    setSection: noop,
    selectedUpdateKeys: [],
    toggleUpdate: noop,
    prerequisiteReasonCode: "ADMIN.PREREQUISITE_REQUEST",
    setPrerequisiteReasonCode: noop,
    repairComponentId: detail.steps[0]?.componentId ?? "",
    setRepairComponentId: noop,
    repairReasonCode: "ADMIN.REPAIR",
    setRepairReasonCode: noop,
    decommissionComponentId: detail.steps[0]?.componentId ?? "",
    setDecommissionComponentId: noop,
    decommissionReasonCode: "ADMIN.DECOMMISSION",
    setDecommissionReasonCode: noop,
    retentionAcknowledged: false,
    setRetentionAcknowledged: noop,
    applicationKey: "crm",
    setApplicationKey: noop,
    accessPolicyRevision: "2",
    setAccessPolicyRevision: noop,
    addApplicationReasonCode: "ADMIN.ADD_APPLICATION",
    setAddApplicationReasonCode: noop,
    managedTargets: [],
    updateManagedTarget: noop,
    addManagedTarget: noop,
    removeManagedTarget: noop,
    conflictDecision: "KEEP_TENANT_VALUE",
    setConflictDecision: noop,
    conflictReasonCode: "ADMIN.SEED_CONFLICT",
    setConflictReasonCode: noop,
    localError: options.localError ?? null,
    clearLocalError: noop,
    applySelectedUpdates: asyncNoop,
    requestSelectedPrerequisites: asyncNoop,
    submitDecommission: asyncNoop,
    submitAddApplication: asyncNoop,
    resolveConflict: vi.fn().mockResolvedValue(undefined),
    provisioning: {
      authLoading: false,
      permissions: {
        canReadOperations: true,
        canRetryOrCancel: true,
        canApplyUpdates: true,
        canReadPrerequisites: true,
        canRequestPrerequisites: true,
        canAddApplication: true,
        canRepair: true,
        canDecommission: true,
        canResolveConflicts: true,
      },
      operations: ready({ items: operations, meta: META }),
      selectedOperationId: OPERATION_ID,
      selectedOperation: ready(detail),
      selectedOperationReadAtMs: null,
      timeline: ready({
        items: [
          {
            id: "019f0000-0000-7000-8000-000000000031",
            eventId: "019f0000-0000-7000-8000-000000000030",
            sequence: "1",
            componentId: null,
            componentKey: null,
            stepId: null,
            eventType: "STEP_STARTED",
            phase: "INSTALLING",
            status: "RUNNING",
            actor: { type: "SYSTEM", id: null },
            message: "Schema installation started.",
            occurredAt: "2026-08-11T19:33:49.000Z",
          },
        ],
        meta: META,
      }),
      updates: ready({ items: [], meta: META }),
      components: ready({
        items: [component],
        meta: META,
      }),
      seeds: ready({ items: [seed], meta: META }),
      prerequisites: ready([]),
      mutation: { name: null, intentKey: null, error: null },
      polling: true,
      pollPaused: false,
      pollIntervalMs: 3_000,
      selectOperation: noop,
      refreshAll: asyncNoop,
      retryOperation: asyncNoop,
      cancelOperation: vi.fn().mockResolvedValue(undefined),
      applyUpdates: asyncNoop,
      requestPrerequisites: asyncNoop,
      addApplication: asyncNoop,
      repair: asyncNoop,
      decommission: asyncNoop,
      resolveSeedConflict: asyncNoop,
      clearMutationError: noop,
    },
  } as unknown as TenantProvisioningWorkspaceModel;
}
