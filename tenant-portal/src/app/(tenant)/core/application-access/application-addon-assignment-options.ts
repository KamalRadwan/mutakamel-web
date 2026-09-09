import { z } from "zod";
import { readCoreResponse } from "@/lib/api/envelope";
import { applicationAccessSchemas } from "./application-access-contract";
import { accessPageEnvelope, accessPagination, matchesAccessPagination } from "./application-access-pagination";

// Core tenant/application-access/application-addon-assignment-options.service.ts.
// Accepted read only. A diagnostic row is never an assignment or operational grant.
const { uuid, revision } = applicationAccessSchemas;
const uuid7 = uuid.refine((value) => value[14] === "7");
const requestSchema = z.object({ userId: uuid, ...accessPagination }).strict();
const readiness = z.enum(["READY", "NOT_READY", "BLOCKED"]);
const option = z.object({ userId: uuid, targetActive: z.boolean(),
  applicationId: uuid, applicationKey: z.string().regex(/^[a-z][a-z0-9_]{0,31}$/u),
  addonId: uuid, addonKey: z.string().regex(/^[a-z][a-z0-9_]{0,31}\.[a-z][a-z0-9_]{0,31}$/u),
  addonSelectionId: uuid, allowanceId: uuid7, allowanceRevision: revision, selectedDefinitionVersionId: uuid,
  parentAssignment: z.object({ id: uuid, revision }).strict().nullable(),
  assignment: z.object({ id: uuid7, revision }).strict().nullable(),
  localState: z.object({ parentReadiness: readiness, addonReadiness: readiness, parentDenied: z.boolean(), addonDenied: z.boolean(),
    adoptionPending: z.boolean(), capacityChangePending: z.boolean() }).strict(),
  observation: z.literal("LOCAL_PROJECTION"), operationalUse: z.literal("NOT_EVALUATED"),
}).strict().refine((value) => value.addonKey.split(".")[0] === value.applicationKey && (value.assignment === null || value.parentAssignment !== null));
const envelope = accessPageEnvelope(option);
export type ApplicationAddonAssignmentOption = z.infer<typeof option>;
export type ApplicationAddonAssignmentOptionsRequest = z.infer<typeof requestSchema>;
export type ApplicationAddonAssignmentOptionsPage = { items: ApplicationAddonAssignmentOption[]; meta: z.infer<typeof envelope>["meta"] };

export function parseApplicationAddonAssignmentOptions(body: unknown, request: ApplicationAddonAssignmentOptionsRequest): ApplicationAddonAssignmentOptionsPage {
  const input = requestSchema.safeParse(request), result = envelope.safeParse(body);
  if (!input.success || !result.success) invalid();
  const { data, meta } = result.data;
  if (!matchesAccessPagination(meta, data.length, input.data) || data.some((item) => item.userId !== input.data.userId)
    || data.some((item) => item.targetActive !== data[0].targetActive)
    || new Set(data.map((item) => item.allowanceId)).size !== data.length) invalid();
  return { items: data, meta };
}
function invalid(): never { throw new Error("The user's Addon assignment preconditions could not be verified."); }

export async function readApplicationAddonAssignmentOptions(request: ApplicationAddonAssignmentOptionsRequest, signal?: AbortSignal) {
  const input = requestSchema.parse(request);
  const query = new URLSearchParams({ page: String(input.page), limit: String(input.limit) });
  const response = await readCoreResponse(`/api/tenant/core/v1/users/${input.userId}/addon-assignment-options?${query}`, {
    signal, cache: "no-store", maxResponseBytes: 1_048_576,
  });
  return parseApplicationAddonAssignmentOptions(response.data, input);
}
