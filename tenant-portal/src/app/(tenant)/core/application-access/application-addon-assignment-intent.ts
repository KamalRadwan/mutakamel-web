import { z } from "zod";
import { safeSessionStorage } from "@/lib/safeStorage";
import { applicationAccessSchemas } from "./application-access-contract";
import { addonAssignmentCommandSchema, type AddonAssignmentCommand } from "./application-addon-assignment-command";
import type { ApplicationAddonAssignmentOption } from "./application-addon-assignment-options";
import type { ApplicationAddonAssignment } from "./application-addon-assignments";

export type AddonAssignmentSource = { kind: "OPTION"; row: ApplicationAddonAssignmentOption }
  | { kind: "ASSIGNMENT"; row: ApplicationAddonAssignment }
  | { kind: "RECOVERY"; row: { userId: string; addonSelectionId: string } };
export type AddonAssignmentDraft = Omit<Extract<AddonAssignmentCommand, { operationKind: "ASSIGN_ADDON" }>, "idempotencyKey">
  | Omit<Extract<AddonAssignmentCommand, { operationKind: "UNASSIGN_ADDON" }>, "idempotencyKey">;
const uuid = applicationAccessSchemas.uuid;
const contextSchema = z.object({ actorId: uuid, userId: uuid, addonSelectionId: uuid }).strict();
export type AddonIntentContext = z.infer<typeof contextSchema>;
const retained = contextSchema.extend({ command: addonAssignmentCommandSchema }).strict();

export function captureAddonAssignmentDraft(userId: string, source: AddonAssignmentSource): AddonAssignmentDraft | null {
  // A retained local intent is not a current options/assignment observation.
  if (source.kind === "RECOVERY") return null;
  const row = source.row;
  if (row.userId !== userId) return null;
  if (source.kind === "ASSIGNMENT") return { operationKind: "UNASSIGN_ADDON", userId, assignmentId: source.row.assignmentId,
    query: { expectedAssignmentRevision: source.row.assignmentRevision, expectedAllowanceRevision: row.allowanceRevision } };
  if (source.row.assignment !== null) return { operationKind: "UNASSIGN_ADDON", userId, assignmentId: source.row.assignment.id,
    query: { expectedAssignmentRevision: source.row.assignment.revision, expectedAllowanceRevision: row.allowanceRevision } };
  if (!source.row.targetActive || source.row.parentAssignment === null) return null;
  // These are observed inputs, not an eligibility decision; the owner rechecks all diagnostics.
  return { operationKind: "ASSIGN_ADDON", userId, body: { addonSelectionId: row.addonSelectionId,
    expectedAllowanceRevision: row.allowanceRevision, expectedParentAssignmentRevision: source.row.parentAssignment.revision } };
}

function storageKey(context: AddonIntentContext): string {
  const input = contextSchema.parse(context);
  return `tenant-addon-intent:${input.actorId}:${input.userId}:${input.addonSelectionId}`;
}

export function listAddonAssignmentIntents(actorId: string, userId: string): Array<Extract<AddonAssignmentSource, { kind: "RECOVERY" }>> {
  if (!uuid.safeParse(actorId).success || !uuid.safeParse(userId).success) invalidStorage();
  if (typeof window === "undefined") return [];
  const prefix = `tenant-addon-intent:${actorId}:${userId}:`;
  try {
    const items: Array<Extract<AddonAssignmentSource, { kind: "RECOVERY" }>> = [];
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const addonSelectionId = key.slice(prefix.length);
      if (readAddonAssignmentIntent({ actorId, userId, addonSelectionId }) !== null) items.push({ kind: "RECOVERY", row: { userId, addonSelectionId } });
    }
    return items;
  } catch { return invalidStorage(); }
}

export function readAddonAssignmentIntent(context: AddonIntentContext): AddonAssignmentCommand | null {
  const raw = storedValue(storageKey(context));
  if (raw === null) return null;
  // Local recovery-record bound only, not a new HTTP/wire contract limit.
  if (raw.length > 4096) invalidStorage();
  let value: unknown; try { value = JSON.parse(raw); } catch { return invalidStorage(); }
  const result = retained.safeParse(value);
  if (!result.success || result.data.actorId !== context.actorId || result.data.userId !== context.userId
    || result.data.addonSelectionId !== context.addonSelectionId || result.data.command.userId !== context.userId
    || (result.data.command.operationKind === "ASSIGN_ADDON" && result.data.command.body.addonSelectionId !== context.addonSelectionId)) invalidStorage();
  return result.data.command;
}

export function retainAddonAssignmentIntent(context: AddonIntentContext, command: AddonAssignmentCommand): void {
  const checked = addonAssignmentCommandSchema.parse(command), existing = readAddonAssignmentIntent(context);
  if (checked.userId !== context.userId || (checked.operationKind === "ASSIGN_ADDON" && checked.body.addonSelectionId !== context.addonSelectionId)
    || (existing !== null && JSON.stringify(existing) !== JSON.stringify(checked))) invalidStorage();
  const value = JSON.stringify({ ...contextSchema.parse(context), command: checked });
  safeSessionStorage.setItem(storageKey(context), value);
  if (storedValue(storageKey(context)) !== value) invalidStorage();
}

export function clearAddonAssignmentIntent(context: AddonIntentContext, command: AddonAssignmentCommand): void {
  const existing = readAddonAssignmentIntent(context);
  if (existing !== null && JSON.stringify(existing) !== JSON.stringify(command)) invalidStorage();
  safeSessionStorage.removeItem(storageKey(context));
  if (storedValue(storageKey(context)) !== null) invalidStorage();
}

function storedValue(key: string): string | null {
  // Failed reads are not absence: treating them as null could overwrite an unknown original intent.
  if (typeof window === "undefined") return null;
  try { return window.sessionStorage.getItem(key); } catch { return invalidStorage(); }
}

function invalidStorage(): never { throw new Error("The original Addon assignment request could not be retained safely."); }
