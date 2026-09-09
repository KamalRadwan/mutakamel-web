import { z } from "zod";
import { axiosClient } from "@/lib/api/axiosClient";
import { applicationAccessSchemas } from "./application-access-contract";
import { parseApplicationAddonAssignmentReceipt } from "./application-addon-assignment-receipt";

// Core application-access-command.contract.ts and the ASSIGN/REMOVE controllers.
// The mounted owner validates current authority before replaying its original receipt.
const { uuid, revision } = applicationAccessSchemas;
const uuid7 = uuid.refine((value) => value[14] === "7");
const identity = { userId: uuid, idempotencyKey: uuid7 };
export const addonAssignmentCommandSchema = z.discriminatedUnion("operationKind", [
  z.object({ operationKind: z.literal("ASSIGN_ADDON"), ...identity,
    body: z.object({ addonSelectionId: uuid,
      expectedAllowanceRevision: revision, expectedParentAssignmentRevision: revision }).strict(),
  }).strict(),
  z.object({ operationKind: z.literal("UNASSIGN_ADDON"), ...identity, assignmentId: uuid7,
    query: z.object({ expectedAssignmentRevision: revision, expectedAllowanceRevision: revision }).strict(),
  }).strict(),
]);
export type AddonAssignmentCommand = z.infer<typeof addonAssignmentCommandSchema>;
export type AddonAssignmentReceipt = ReturnType<typeof parseApplicationAddonAssignmentReceipt>;

export async function sendAddonAssignmentCommand(command: AddonAssignmentCommand, signal?: AbortSignal): Promise<AddonAssignmentReceipt> {
  const input = addonAssignmentCommandSchema.parse(command);
  const config = { signal, cache: "no-store" as const,
    headers: { "x-idempotency-key": input.idempotencyKey } };
  // Existing transport owns cookies, CSRF and same-key replay after session refresh.
  const response = input.operationKind === "ASSIGN_ADDON"
    ? await axiosClient.post<unknown>(`/api/tenant/core/v1/users/${input.userId}/addon-assignments`, input.body, config)
    : await axiosClient.delete<unknown>(`/api/tenant/core/v1/users/${input.userId}/addon-assignments/${input.assignmentId}?${new URLSearchParams(input.query)}`, config);
  const expected = input.operationKind === "ASSIGN_ADDON" ? { operationKind: input.operationKind }
    : { operationKind: input.operationKind, assignmentId: input.assignmentId };
  return parseApplicationAddonAssignmentReceipt(response.data, response.status, expected);
}
