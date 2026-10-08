import type {
  TenantOperationExit,
  TenantOperationExitReasonCode,
  TenantOperationSummary,
} from "../types";

export type ProvisioningOperatorAction = "cancel" | "retry" | "repair";

export interface ProvisioningActionState {
  /** Whether the control is rendered at all. */
  visible: boolean;
  /** Core leaves the exit open and no other command is in flight. */
  enabled: boolean;
  /** Why Core holds the exit closed; shown beside the disabled control. */
  reasonCode: TenantOperationExitReasonCode | null;
}

/**
 * Reasons that make a control meaningless rather than temporarily blocked.
 * Cancelling a finished, superseded or already-cancelling operation, or
 * re-provisioning a superseded or successful one, is not an exit the operator
 * is waiting for; the status, historical note and cancellation note already
 * say why. Every other closed exit stays visible with its reason.
 */
const HIDDEN_WHEN: Record<
  ProvisioningOperatorAction,
  ReadonlySet<TenantOperationExitReasonCode>
> = {
  cancel: new Set([
    "OPERATION_SUPERSEDED",
    "OPERATION_TERMINAL",
    "CANCELLATION_PENDING",
  ]),
  retry: new Set(["OPERATION_SUPERSEDED", "OPERATION_SUCCEEDED"]),
  repair: new Set(),
};

/**
 * How one operator control renders from Core's stated exit. Permissions still
 * hide a control outright: a disabled control is for a capability the
 * operator has but the operation's state does not allow yet.
 */
export function provisioningActionState(
  action: ProvisioningOperatorAction,
  exit: TenantOperationExit,
  permitted: boolean,
  busy: boolean,
): ProvisioningActionState {
  if (!permitted) return { visible: false, enabled: false, reasonCode: null };
  if (exit.allowed) return { visible: true, enabled: !busy, reasonCode: null };
  return {
    visible: !HIDDEN_WHEN[action].has(exit.reasonCode),
    enabled: false,
    reasonCode: exit.reasonCode,
  };
}

/**
 * The repair exit the history alone implies, for when no operation detail has
 * been read yet or the history has moved past it. Core's detail is preferred
 * whenever it holds the exit closed; this only ever closes it further.
 */
export function repairExitFromHistory(
  latest: Pick<TenantOperationSummary, "status"> | null,
): TenantOperationExit {
  if (latest?.status === "CANCEL_REQUESTED") {
    return { allowed: false, reasonCode: "CANCELLATION_PENDING" };
  }
  if (
    latest &&
    ["REQUESTED", "PLANNING", "QUEUED", "RUNNING", "WAITING_RETRY"].includes(
      latest.status,
    )
  ) {
    return { allowed: false, reasonCode: "OPERATION_OPEN" };
  }
  return { allowed: true, reasonCode: null };
}
