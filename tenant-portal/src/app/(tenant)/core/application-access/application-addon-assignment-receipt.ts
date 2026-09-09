import { z } from "zod";
import { applicationAccessSchemas } from "./application-access-contract";

// Core application-access-command.{contract,receipts,swagger}.ts / LLD43 §8.0.3.
// A receipt confirms the original command; it is never current-state authority.
const uuid7 = applicationAccessSchemas.uuid.refine((value) => value[14] === "7");
const revision = applicationAccessSchemas.revision;
const receipt = z.object({
  operationId: uuid7, operationRevision: revision,
  state: z.literal("COMMITTED"), operationKind: z.enum(["ASSIGN_ADDON", "UNASSIGN_ADDON"]),
  changed: z.boolean(), resourceId: uuid7, resourceRevision: revision,
  completedAt: z.string().max(30).refine((value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value),
}).strict();
const envelope = z.object({
  success: z.literal(true), data: receipt, correlationId: z.string().max(36),
  timestamp: z.iso.datetime({ offset: true }).max(30),
}).strict();
const expectation = z.discriminatedUnion("operationKind", [
  z.object({ operationKind: z.literal("ASSIGN_ADDON") }).strict(),
  z.object({ operationKind: z.literal("UNASSIGN_ADDON"), assignmentId: uuid7 }).strict(),
]);

export function parseApplicationAddonAssignmentReceipt(
  body: unknown, status: number, expected: z.infer<typeof expectation>,
) {
  // The owner rejects accessors/prototypes too; inspect descriptors before reading data.
  if (!closedDataObject(body, Object.keys(envelope.shape)) || !closedDataObject(body.data, Object.keys(receipt.shape))) invalid();
  const context = expectation.safeParse(expected), result = envelope.safeParse(body);
  if (!context.success || !result.success) invalid();
  const data = result.data.data;
  if (data.operationKind !== context.data.operationKind || status !== (context.data.operationKind === "ASSIGN_ADDON" ? 201 : 200)
    || (context.data.operationKind === "UNASSIGN_ADDON" && data.resourceId !== context.data.assignmentId)) invalid();
  // A replay keeps its original outcome and revisions, not the latest resource state.
  return Object.freeze(data);
}

function closedDataObject(value: unknown, keys: string[]): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Object.getPrototypeOf(value) !== Object.prototype
    || Reflect.ownKeys(value).length !== keys.length) return false;
  return keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && descriptor.enumerable === true && "value" in descriptor;
  });
}

function invalid(): never { throw new Error("The Addon assignment result could not be verified."); }
