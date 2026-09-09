import { z } from "zod";
import { readCoreResponse } from "@/lib/api/envelope";
import { applicationAccessSchemas } from "./application-access-contract";
import { accessPageEnvelope, accessPagination, matchesAccessPagination } from "./application-access-pagination";

// Core tenant/application-access/application-addon-assignment-read.service.ts: exact local projection.
const uuid = applicationAccessSchemas.uuid;
const uuid7 = uuid.refine((value) => value[14] === "7");
const revision = applicationAccessSchemas.revision;
const requestSchema = z.object({ userId: uuid, ...accessPagination }).strict();
const assignment = z.object({ userId: uuid, assignmentId: uuid7, assignmentRevision: revision,
  applicationId: uuid, applicationKey: z.string().regex(/^[a-z][a-z0-9_]{0,31}$/u), addonId: uuid,
  addonKey: z.string().regex(/^[a-z][a-z0-9_]{0,31}\.[a-z][a-z0-9_]{0,31}$/u), addonSelectionId: uuid, allowanceRevision: revision,
  parentAssignmentId: uuid, parentAssignmentRevision: revision, selectedDefinitionVersionId: uuid,
  assignedAt: z.iso.datetime().max(30), observation: z.literal("LOCAL_PROJECTION"), operationalUse: z.literal("NOT_EVALUATED"),
}).strict().refine((value) => value.addonKey.split(".")[0] === value.applicationKey);
const envelope = accessPageEnvelope(assignment);
export type ApplicationAddonAssignment = z.infer<typeof assignment>;
export type ApplicationAddonAssignmentRequest = z.infer<typeof requestSchema>;
export type ApplicationAddonAssignmentPage = { items: ApplicationAddonAssignment[]; meta: z.infer<typeof envelope>["meta"] };

export function parseApplicationAddonAssignments(body: unknown, request: ApplicationAddonAssignmentRequest): ApplicationAddonAssignmentPage {
  const input = requestSchema.parse(request), result = envelope.safeParse(body);
  if (!result.success) invalidAssignments();
  const { data, meta } = result.data;
  if (!matchesAccessPagination(meta, data.length, input) || data.some((item) => item.userId !== input.userId)
    || new Set(data.map((item) => item.assignmentId)).size !== data.length
    || new Set(data.map((item) => item.addonId)).size !== data.length
    || new Set(data.map((item) => item.addonKey)).size !== data.length) invalidAssignments();
  return { items: data, meta };
}

export async function readApplicationAddonAssignments(request: ApplicationAddonAssignmentRequest, signal?: AbortSignal) {
  const input = requestSchema.parse(request);
  const query = new URLSearchParams({ page: String(input.page), limit: String(input.limit) });
  const response = await readCoreResponse(`/api/tenant/core/v1/users/${input.userId}/addon-assignments?${query}`, {
    signal, cache: "no-store", maxResponseBytes: 1_048_576,
  });
  return parseApplicationAddonAssignments(response.data, input);
}

function invalidAssignments(): never { throw new Error("The user's Addon assignments could not be verified."); }
