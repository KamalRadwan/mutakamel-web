// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TenantProvisioningWorkspaceView } from "./TenantProvisioningWorkspaceView";
import type { TenantProvisioningWorkspaceModel } from "../hooks/useTenantProvisioningWorkspace";
import {
  readTenantComponentInstallation,
  readTenantOperationDetail,
  readTenantOperationSummary,
  readTenantSeedState,
} from "../model/readers";
import {
  META,
  OPERATION_ID,
  componentInstallation,
  operationDetail,
  operationSummary,
  seedState,
} from "../test/fixtures";

describe("TenantProvisioningWorkspaceView", () => {
  it("renders real operation progress and dispatches operation-specific cancel", () => {
    const model = makeModel();
    render(<TenantProvisioningWorkspaceView model={model} />);

    expect(screen.getByText("Tenant provisioning")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("Schema installation started.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Request cancel" }));
    expect(model.provisioning.cancelOperation).toHaveBeenCalledWith(OPERATION_ID);
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
});

function makeModel(
  options: {
    lang?: "ar" | "en";
    section?: "operations" | "updates" | "state" | "prerequisites" | "managed";
    seedRevision?: number | null;
  } = {},
): TenantProvisioningWorkspaceModel {
  const summary = readTenantOperationSummary(operationSummary());
  const detail = readTenantOperationDetail(operationDetail());
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
  return {
    lang: options.lang ?? "en",
    dir: options.lang === "ar" ? "rtl" : "ltr",
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
    localError: null,
    clearLocalError: noop,
    applySelectedUpdates: asyncNoop,
    requestSelectedPrerequisites: asyncNoop,
    submitRepair: asyncNoop,
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
      operations: ready({ items: [summary], meta: META }),
      selectedOperationId: OPERATION_ID,
      selectedOperation: ready(detail),
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
        items: [readTenantComponentInstallation(componentInstallation())],
        meta: META,
      }),
      seeds: ready({ items: [seed], meta: META }),
      prerequisites: ready([]),
      mutation: { name: null, intentKey: null, error: null },
      polling: true,
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
