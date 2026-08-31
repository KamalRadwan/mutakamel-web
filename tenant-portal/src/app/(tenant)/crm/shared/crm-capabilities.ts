// The action-admission contract shared by every CRM screen — MASTER-PLAN S6,
// defect D11.
//
// Route admission comes from `/auth/me` permission strings. **Action**
// admission does not: `crm.leads.update.own` says the actor may update leads
// they own, and nothing in that string says which records those are. The
// capabilities endpoints answer the whole question in one call, per branch,
// with the owner boundary attached.
//
// Shape verified against crm-app source, not a docs example:
//   leads.service.ts             getCapabilities()  -> leads / activities /
//                                                      notes / attachments /
//                                                      opportunities
//   opportunities.service.ts     getCapabilities()  -> opportunities only
//   customer-profiles.service.ts getCapabilities()  -> customerProfiles only
//
// Each action is `{ scope, ownerUserIds }` or `null`. `null` means the action
// is unavailable in this branch. `ownerUserIds: null` pairs with
// `scope: "all"` and means no owner boundary; a non-null array is the explicit
// boundary for `own`/`team`.

import { isUUIDv7 } from "@/lib/uuid";

type CrmCapabilityScope = "own" | "team" | "all";

export interface CrmActionCapability {
  scope: CrmCapabilityScope;
  ownerUserIds: string[] | null;
}

const SCOPES: readonly CrmCapabilityScope[] = ["own", "team", "all"];

export function crmRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseCrmActionCapability(
  value: unknown,
  contract: string,
): CrmActionCapability | null {
  if (value === null || value === undefined) return null;
  const capability = crmRecord(value);
  const scope = capability?.scope;
  const ownerUserIds = capability?.ownerUserIds;
  const boundaryValid =
    ownerUserIds === null ||
    (Array.isArray(ownerUserIds) &&
      ownerUserIds.length > 0 &&
      ownerUserIds.every((ownerId) => isUUIDv7(ownerId)) &&
      new Set(ownerUserIds).size === ownerUserIds.length);
  if (
    !capability ||
    !SCOPES.includes(scope as CrmCapabilityScope) ||
    !boundaryValid ||
    // The two halves are not independent: the server returns a null boundary
    // exactly when the scope is "all". A response that pairs them any other
    // way is not a capability this client knows how to honour.
    (scope === "all") !== (ownerUserIds === null)
  ) {
    throw new Error(`Invalid ${contract} capabilities response.`);
  }
  return {
    scope: scope as CrmCapabilityScope,
    ownerUserIds: ownerUserIds as string[] | null,
  };
}

/**
 * Whether a capability reaches one specific record.
 *
 * A capability with an owner boundary and a record with **no owner** is not a
 * match: an unowned record is outside an `own`/`team` boundary, and guessing
 * otherwise would show a control the backend then refuses.
 */
export function crmCapabilityAllowsOwner(
  capability: CrmActionCapability | null | undefined,
  ownerUserId: string | null | undefined,
): boolean {
  if (!capability) return false;
  if (capability.ownerUserIds === null) return true;
  return (
    typeof ownerUserId === "string" &&
    capability.ownerUserIds.includes(ownerUserId)
  );
}

/** Notes and attachments capabilities, as `/leads/capabilities` reports them. */
export interface CrmAttachedRecordCapabilities {
  notesCreate: CrmActionCapability | null;
  notesDelete: CrmActionCapability | null;
  attachmentsCreate: CrmActionCapability | null;
  attachmentsDelete: CrmActionCapability | null;
}

export const NO_ATTACHED_RECORD_CAPABILITIES: CrmAttachedRecordCapabilities = {
  notesCreate: null,
  notesDelete: null,
  attachmentsCreate: null,
  attachmentsDelete: null,
};

/**
 * Reads the `notes` and `attachments` halves of the leads capabilities payload.
 *
 * `/leads/capabilities` is the **only** endpoint that reports them, and it
 * resolves them per resource and branch — `resolveCapability(actor, 'notes',
 * 'create', branchId)` in `leads.service.ts` never looks at a lead. The
 * opportunity and customer-profile capabilities endpoints report only their own
 * resource, so an opportunity screen that needs to know whether the actor may
 * attach a file asks this one. It requires no leads permission — branch
 * membership is enough (`LeadsController.capabilities` carries no
 * `@RequirePermissions`) — so calling it from a non-lead screen grants nothing
 * and leaks nothing.
 */
export function parseAttachedRecordCapabilities(
  payload: unknown,
  expectedBranchId: string,
): CrmAttachedRecordCapabilities {
  const response = crmRecord(payload);
  if (!response || response.branchId !== expectedBranchId) {
    throw new Error("Invalid leads capabilities response.");
  }
  const notes = crmRecord(response.notes);
  const attachments = crmRecord(response.attachments);
  if (!notes || !attachments) {
    throw new Error("Invalid leads capabilities response.");
  }
  return {
    notesCreate: parseCrmActionCapability(notes.create, "leads"),
    notesDelete: parseCrmActionCapability(notes.delete, "leads"),
    attachmentsCreate: parseCrmActionCapability(attachments.create, "leads"),
    attachmentsDelete: parseCrmActionCapability(attachments.delete, "leads"),
  };
}
