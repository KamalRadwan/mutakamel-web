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
  readTenantAvailableUpdate,
  readTenantPrerequisiteEvidenceRecord,
  readTenantOperationDetail,
  readTenantOperationSummary,
  readTenantSeedState,
} from "../model/readers";
import {
  META,
  availableUpdate,
  prerequisiteEvidenceRecord,
  OPERATION_ID,
  RETRY_OPERATION_ID,
  componentInstallation,
  operationDetail,
  operationExits,
  operationStep,
  operationSummary,
  seedState,
} from "../test/fixtures";

const STEP_A = "019f0000-0000-7000-8000-000000000021";
const STEP_B = "019f0000-0000-7000-8000-000000000022";
const STEP_C = "019f0000-0000-7000-8000-000000000023";
const STEP_D = "019f0000-0000-7000-8000-000000000024";
const FINISHED_AT = "2026-08-11T19:40:00.000Z";

/**
 * A generation that failed on a CRM step held by an open maintenance fence,
 * with the CRM verification that depended on it skipped, a Trade schema step
 * failed by a database outage, and a Core step with a code this build does
 * not know; the operation itself stopped on an owner that never answered.
 */
function failedGenerationSteps(): Record<string, unknown>[] {
  return [
    operationStep({
      id: STEP_A,
      componentKey: "crm",
      stepKey: "crm.seed.crm.settings",
      kind: "CONFIG",
      status: "FAILED",
      required: false,
      producer: "crm-app",
      finishedAt: FINISHED_AT,
      safeError: { code: "CRM.PROVISIONING.MAINTENANCE_FENCE_OPEN", message: null },
    }),
    operationStep({
      id: STEP_B,
      componentKey: "crm",
      stepKey: "crm.verify",
      kind: "VERIFICATION",
      status: "SKIPPED",
      producer: "crm-app",
      attemptCount: 0,
      dependsOnStepKeys: ["crm.seed.crm.settings"],
      startedAt: null,
      heartbeatAt: FINISHED_AT,
      finishedAt: FINISHED_AT,
      safeError: {
        code: "WORKER.PROVISIONING.OPTIONAL_DEPENDENCY_FAILED",
        message: "Skipped because an optional step it depends on failed.",
      },
    }),
    operationStep({
      id: STEP_C,
      componentKey: "trade",
      stepKey: "trade.schema",
      status: "FAILED",
      producer: "trade-app",
      finishedAt: FINISHED_AT,
      safeError: { code: "TRADE.PROVISIONING.CONNECTION_REFUSED", message: null },
    }),
    operationStep({
      id: STEP_D,
      stepKey: "core.foundation.verify",
      kind: "VERIFICATION",
      status: "FAILED",
      finishedAt: FINISHED_AT,
      safeError: { code: "CORE_PROVISIONING_SOMETHING_NEW", message: null },
    }),
  ];
}

describe("TenantProvisioningWorkspaceView", () => {
  it.each(["en", "ar"] as const)("explains a planned update and release recovery in %s", (lang) => {
    const model = makeModel({ lang, section: "updates" });
    model.provisioning.updates.data.items = [readTenantAvailableUpdate(availableUpdate({ updateAlreadyPlanned: true }))];
    model.provisioning.prerequisites.data = [readTenantPrerequisiteEvidenceRecord(prerequisiteEvidenceRecord({
      status: "RELEASE_REQUESTED",
      recovery: { attempts: 5, alerted: true, stuck: true, nextRetryAt: null,
        releaseEvidenceExists: false, canResendRelease: true, canCloseFailed: false },
    }))];
    render(<TenantProvisioningWorkspaceView model={model} />);
    expect(screen.getByRole("alert")).toHaveTextContent(lang === "en" ? /dead-letter queue/u : /الرسائل المتعثرة/u);
    const link = screen.getByRole("link", { name: lang === "en" ? /View blocking operation/u : /عرض العملية المانعة/u });
    fireEvent.click(link);
    expect(model.provisioning.selectOperation).toHaveBeenCalledWith(OPERATION_ID);
    expect(model.setSection).toHaveBeenCalledWith("operations");
    const resend = screen.getByRole("button", { name: lang === "en" ? "Re-send prerequisite release" : "إعادة إرسال تحرير المتطلب المسبق" });
    fireEvent.click(resend);
    expect(model.requestRecovery).toHaveBeenCalledWith("resend-release", model.provisioning.prerequisites.data[0]);
  });

  it("offers close only with release evidence and the critical permission", () => {
    const model = makeModel({ operationStatus: "MANUAL_RECOVERY_REQUIRED" });
    model.provisioning.prerequisites.data = [readTenantPrerequisiteEvidenceRecord(prerequisiteEvidenceRecord({
      status: "RELEASED",
      recovery: { attempts: 1, alerted: false, stuck: false, nextRetryAt: null,
        releaseEvidenceExists: true, canResendRelease: false, canCloseFailed: true },
    }))];
    const { rerender } = render(<TenantProvisioningWorkspaceView model={model} />);
    fireEvent.click(screen.getByRole("button", { name: "Close failed operation" }));
    expect(model.requestRecovery).toHaveBeenCalledWith("close-failed", model.provisioning.prerequisites.data[0]);
    model.provisioning.permissions.canCloseFailed = false;
    rerender(<TenantProvisioningWorkspaceView model={model} />);
    expect(screen.queryByRole("button", { name: "Close failed operation" })).not.toBeInTheDocument();
  });
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

  // Resync changes nothing by itself, so it is sent from the button, with no
  // confirmation, and only while Core's `exits.resync` allows it.
  it("offers Resync for an open operation and sends it without a confirmation", () => {
    const model = makeModel();
    render(<TenantProvisioningWorkspaceView model={model} />);

    const resync = screen.getByRole("button", { name: "Resync" });
    expect(resync).toBeEnabled();
    fireEvent.click(resync);
    expect(model.requestResync).toHaveBeenCalledWith(
      expect.objectContaining({ id: OPERATION_ID }),
    );
    expect(model.requestCancel).not.toHaveBeenCalled();
  });

  it("keeps Resync visible but disabled until the Worker holds the plan", () => {
    render(
      <TenantProvisioningWorkspaceView
        model={makeModel({ operationStatus: "QUEUED", notDispatched: true })}
      />,
    );

    const resync = screen.getByRole("button", { name: "Resync" });
    expect(resync).toBeDisabled();
    expect(resync).toHaveAccessibleDescription(
      /Nothing has been handed to the Worker yet/u,
    );
  });

  it("points a failed generation at Re-provision instead of Resync", () => {
    render(
      <TenantProvisioningWorkspaceView
        model={makeModel({ operationStatus: "FAILED_RETRYABLE" })}
      />,
    );

    expect(screen.getByRole("button", { name: "Resync" })).toBeDisabled();
    expect(
      screen.getByText(
        "Resync: A failed or cancelled generation is settled; re-provision it instead.",
      ),
    ).toBeInTheDocument();
  });

  it("offers Resync for a success only while one of its steps is unsettled", () => {
    const { unmount } = render(
      <TenantProvisioningWorkspaceView model={makeModel({ operationStatus: "SUCCEEDED" })} />,
    );
    expect(screen.queryByRole("button", { name: "Resync" })).toBeNull();
    unmount();

    render(
      <TenantProvisioningWorkspaceView
        model={makeModel({ operationStatus: "SUCCEEDED", unsettledSteps: true })}
      />,
    );
    expect(screen.getByRole("button", { name: "Resync" })).toBeEnabled();
  });

  it("shows a resync in flight on its own button", () => {
    render(<TenantProvisioningWorkspaceView model={makeModel({ resyncing: true })} />);

    const resync = screen.getByRole("button", { name: "Resync" });
    expect(resync).toBeDisabled();
    expect(resync).toHaveAttribute("aria-busy", "true");
  });

  it("names the step a NO_PROGRESS stall is attributed to, and offers Resync first", () => {
    render(
      <TenantProvisioningWorkspaceView
        model={makeModel({
          stall: {
            stepKey: "core.foundation.schema",
            since: "2026-08-11T19:30:00.000Z",
            ageSeconds: 240,
            reason: "NO_PROGRESS",
          },
        })}
      />,
    );

    expect(
      screen.getByText("Stalled at Core foundation — schema · no progress for 4 min"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Core foundation — schema has reported neither a state change nor a Worker heartbeat for 4 min/u,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Resync asks the Worker now to re-deliver the progress it retained/u),
    ).toBeInTheDocument();
  });

  // Core holds a RUNNING operation in PREREQUISITE_FAILED/EXPIRED while the
  // Worker stops it, and counts that as a pending stop like a cancellation.
  it.each([
    ["PREREQUISITE_FAILED", "Its backup or maintenance prerequisite failed"],
    ["PREREQUISITE_EXPIRED", "Its backup or maintenance prerequisite expired"],
  ])("explains an unconfirmed stop of a %s prerequisite, not a cancellation", (currentPhase, cause) => {
    render(
      <TenantProvisioningWorkspaceView
        model={makeModel({
          currentPhase,
          stall: {
            stepKey: null,
            since: "2026-08-11T19:20:00.000Z",
            ageSeconds: 720,
            reason: "CANCEL_PENDING",
          },
        })}
      />,
    );

    expect(screen.getByText("Stalled · stop not confirmed for 12 min")).toBeInTheDocument();
    expect(
      screen.getByText(
        new RegExp(`${cause}, so Core asked the Worker to stop this operation\\. For 12 min the Worker has neither confirmed the stop`, "u"),
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Cancellation was requested/u)).not.toBeInTheDocument();
    expect(
      screen.getByText("No operator action can move it on until the Worker confirms the stop. Check that the Worker is running."),
    ).toBeInTheDocument();
  });

  // A held retry is heartbeated once a minute, so only one the Worker no
  // longer holds is reported as stalled.
  it("explains a WAITING_RETRY operation the Worker no longer heartbeats", () => {
    render(
      <TenantProvisioningWorkspaceView
        model={makeModel({
          operationStatus: "WAITING_RETRY",
          steps: [],
          stall: {
            stepKey: null,
            since: "2026-08-11T19:20:00.000Z",
            ageSeconds: 720,
            reason: "NO_PROGRESS",
          },
        })}
      />,
    );

    expect(screen.getByText("Stalled · no Worker heartbeat for 12 min")).toBeInTheDocument();
    expect(
      screen.getByText(/This operation is waiting to retry, and for 12 min the Worker has not reported that it still holds the retry/u),
    ).toBeInTheDocument();
  });

  // A dispatched owner step is not re-sent once its lease expired; the Worker
  // waits for its result and fails it retryably after 45 minutes.
  it("bounds a DISPATCH_LEASE_EXPIRED stall by the owner-result deadline", () => {
    render(
      <TenantProvisioningWorkspaceView
        model={makeModel({
          stall: {
            stepKey: "core.foundation.schema",
            since: "2026-08-11T19:20:00.000Z",
            ageSeconds: 720,
            reason: "DISPATCH_LEASE_EXPIRED",
          },
        })}
      />,
    );

    expect(
      screen.getByText(
        /Core foundation — schema was handed to its owning application 12 min ago.*fails the step as retryable \(WORKER\.PROVISIONING\.OWNER_RESULT_TIMEOUT\) if none arrives within 45 minutes/u,
      ),
    ).toBeInTheDocument();
  });

  // Core, CRM and Trade answer one failure with one suffix behind their own
  // prefix, so one hint per suffix names whichever owner answered.
  it("explains owner codes by the owner that answered, Worker codes, and a skipped step", () => {
    render(
      <TenantProvisioningWorkspaceView
        model={makeModel({
          operationStatus: "FAILED_RETRYABLE",
          safeError: { code: "WORKER.PROVISIONING.OWNER_RESULT_TIMEOUT", message: null },
          steps: failedGenerationSteps(),
        })}
      />,
    );

    expect(
      screen.getByText(/^The owning application never answered this step: no result arrived within 45 minutes/u),
    ).toBeInTheDocument();
    // A passing condition waits 60 s in the owner, then answers retryable.
    expect(
      screen.getByText(/^A provisioning or relocation maintenance fence of this tenant was still open\. CRM waited 60 seconds for it to close, then failed the step as retryable/u),
    ).toBeInTheDocument();
    // An outage waits up to 25 minutes, whatever its database code.
    expect(
      screen.getByText(/Trade waited up to 25 minutes for it to recover, then failed the step as retryable/u),
    ).toBeInTheDocument();
    // A skipped step is neutral, never a success, and says why it never ran.
    const skipped = screen.getByText("Skipped");
    expect(skipped).toHaveClass("bg-muted");
    expect(skipped).not.toHaveClass("bg-success-subtle");
    expect(
      screen.getByText(/^This step never ran: an optional step it depends on failed/u),
    ).toBeInTheDocument();
    // A code this build does not know is shown on its own.
    expect(
      screen.getByText("CORE_PROVISIONING_SOMETHING_NEW").nextElementSibling,
    ).toBeNull();
  });

  it("explains owner codes in Arabic with the owner's Arabic name", () => {
    render(
      <TenantProvisioningWorkspaceView
        model={makeModel({
          lang: "ar",
          operationStatus: "FAILED_RETRYABLE",
          steps: failedGenerationSteps(),
        })}
      />,
    );

    expect(
      screen.getByText(/انتظرت إدارة العملاء إغلاقه 60 ثانية، ثم أفشلت الخطوة فشلًا قابلًا لإعادة المحاولة/u),
    ).toBeInTheDocument();
    expect(screen.getByText(/انتظرت التجارة حتى 25 دقيقة تعافيها/u)).toBeInTheDocument();
    expect(screen.getByText("تم تخطيها")).toBeInTheDocument();
    expect(screen.getByText(/^لم تُنفَّذ هذه الخطوة: فشلت خطوة اختيارية تعتمد عليها/u)).toBeInTheDocument();
  });

  it.each([
    ["en", /wait for the Worker to confirm release/u],
    ["ar", /انتظر تأكيد العامل للتحرير/u],
  ] as const)("localizes an open maintenance fence refusal in %s", (lang, message) => {
    render(
      <TenantProvisioningWorkspaceView
        model={makeModel({ lang, localError: "PROVISIONING_MAINTENANCE_FENCE_OPEN" })}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText("PROVISIONING_MAINTENANCE_FENCE_OPEN")).toBeNull();
  });

  it("tells the operator to re-bind or remove an Add-on that pins a component the update would move", () => {
    render(
      <TenantProvisioningWorkspaceView
        model={makeModel({ localError: "TENANT_PROVISIONING_ADDON_REBIND_REQUIRED" })}
      />,
    );

    expect(
      screen.getByText(/An Add-on binding of this tenant pins a component this update would move.*Re-bind the Add-on to the new release or remove it first/u),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open updates" })).toBeNull();
  });

  it.each([
    ["en", "WebPhone decommission is not supported yet."],
    ["ar", "إيقاف مكوّن الهاتف عبر الويب غير مدعوم حاليًا."],
  ] as const)("localizes unsupported WebPhone decommission in %s", (lang, message) => {
    render(
      <TenantProvisioningWorkspaceView
        model={makeModel({ lang, localError: "PROVISIONING_DECOMMISSION_UNSUPPORTED_COMPONENT" })}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText("PROVISIONING_DECOMMISSION_UNSUPPORTED_COMPONENT")).toBeNull();
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

  it.each([
    ["en", "Add-on", "Source (loaded components)", "ltr"],
    ["ar", "إضافة", "المصدر (المكونات المحمّلة)", "rtl"],
  ] as const)("renders parsed ADDON component evidence in %s", (lang, label, filterLabel, dir) => {
    const model = makeModel({ section: "state", lang });
    model.provisioning.components.data.items = [readTenantComponentInstallation(
      componentInstallation({ componentKey: "crm.addon", selectionSource: "ADDON" }),
    )];

    const { container } = render(<TenantProvisioningWorkspaceView model={model} />);

    expect(screen.getByRole("cell", { name: label })).toBeInTheDocument();
    expect(screen.getByText("crm.addon")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: filterLabel })).toBeInTheDocument();
    expect(container.querySelector("section")).toHaveAttribute("dir", dir);
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
    operationStatus?:
      | "QUEUED"
      | "RUNNING"
      | "WAITING_RETRY"
      | "SUCCEEDED"
      | "FAILED_RETRYABLE"
      | "MANUAL_RECOVERY_REQUIRED"
      | "CANCEL_REQUESTED"
      | "CANCELLED";
    /** The operation's current phase; the fixture's own by default. */
    currentPhase?: string;
    selectedGeneration?: number;
    latestGeneration?: number;
    localError?: string;
    confirming?: ProvisioningConfirmation["kind"];
    /** A QUEUED plan still awaiting its prerequisites. */
    notDispatched?: boolean;
    /** A success whose step projection was left RUNNING. */
    unsettledSteps?: boolean;
    stall?: Record<string, unknown> | null;
    resyncing?: boolean;
    /** The detail's steps, as Core projects them; one running Core schema step by default. */
    steps?: Record<string, unknown>[];
    /** The operation's own safe error. */
    safeError?: Record<string, unknown> | null;
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
      stall: options.stall ?? null,
      ...(options.currentPhase ? { currentPhase: options.currentPhase } : {}),
      ...(options.steps ? { steps: options.steps } : {}),
      ...(options.safeError !== undefined ? { safeError: options.safeError } : {}),
      // A newer generation in these fixtures has always succeeded.
      exits: operationExits(operationStatus, {
        superseded,
        latestStatus: superseded ? "SUCCEEDED" : operationStatus,
        notDispatched: options.notDispatched,
        unsettledSteps: options.unsettledSteps,
      }),
    }),
  );
  const component = readTenantComponentInstallation(componentInstallation());
  const confirmation: ProvisioningConfirmation | null =
    options.confirming === "resend-release" || options.confirming === "close-failed"
      ? { kind: options.confirming, request: readTenantPrerequisiteEvidenceRecord(prerequisiteEvidenceRecord()) }
      : options.confirming === "repair"
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
      resync: provisioningActionState(
        "resync",
        detail.exits.resync,
        true,
        options.resyncing === true,
      ),
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
    requestRecovery: vi.fn(),
    requestResync: asyncNoop,
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
        canResendRelease: true,
        canCloseFailed: true,
        canReadOperations: true,
        canRetryOrCancel: true,
        canResync: true,
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
      mutation: {
        name: options.resyncing ? "resync" : null,
        intentKey: null,
        error: null,
      },
      polling: true,
      pollPaused: false,
      pollIntervalMs: 3_000,
      selectOperation: noop,
      refreshAll: asyncNoop,
      retryOperation: asyncNoop,
      cancelOperation: vi.fn().mockResolvedValue(undefined),
      resyncOperation: asyncNoop,
      applyUpdates: asyncNoop,
      requestPrerequisites: asyncNoop,
      recoverPrerequisite: asyncNoop,
      addApplication: asyncNoop,
      repair: asyncNoop,
      decommission: asyncNoop,
      resolveSeedConflict: asyncNoop,
      clearMutationError: noop,
    },
  } as unknown as TenantProvisioningWorkspaceModel;
}
