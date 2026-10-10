import type { TenantOperationDetail } from "../types";

/**
 * What an UPDATE operation moves, and which of it the operator did not ask for.
 *
 * Core grows an update to a fixed point: every component on an earlier release
 * that a requested target depends on, or that the resulting release set would
 * break, moves with it (core-app `tenant-provisioning-plan.service.ts`,
 * `createUpdateOperation`). A component that moves is planned with a `SCHEMA`
 * step at its current release; one the update only checks gets a single
 * `VERIFICATION` step (`buildComponentInstallationSteps`).
 *
 * Core also records both lists on the planned event (`componentKeys`,
 * `requestedComponentKeys` in its `safeMetadata`), but the timeline projection
 * does not return event metadata. So the moved set is read from the plan's
 * steps, and the requested set is known only for an update this page sent.
 */
export interface ProvisioningUpdateScope {
  /** Every component the update moves, in plan order. */
  moved: string[];
  /** What the operator selected, or `null` when this page did not send it. */
  requested: readonly string[] | null;
  /** Moved without being selected: lagging components Core pulled in. */
  autoAdded: string[];
}

export function provisioningUpdateScope(
  operation: Pick<TenantOperationDetail, "type" | "steps">,
  requested: readonly string[] | null,
): ProvisioningUpdateScope | null {
  if (operation.type !== "UPDATE") return null;
  const moved: string[] = [];
  for (const step of operation.steps) {
    if (
      step.kind === "SCHEMA" &&
      step.componentKey &&
      !moved.includes(step.componentKey)
    ) {
      moved.push(step.componentKey);
    }
  }
  if (moved.length === 0) return null;
  return {
    moved,
    requested,
    autoAdded: requested
      ? moved.filter((componentKey) => !requested.includes(componentKey))
      : [],
  };
}
