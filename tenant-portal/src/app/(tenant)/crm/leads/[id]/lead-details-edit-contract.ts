import { isUUIDv7 } from "@/lib/uuid";
import type { LeadDetail } from "../lead-contract";
import type { UpdateLeadRequest } from "../lead-write-contract";

export interface LeadDetailsForm {
  acquisitionSourceId: string;
  ownerUserId: string;
  interestSummary: string;
  expectedNeed: string;
  description: string;
}

export function toLeadDetailsForm(lead: LeadDetail): LeadDetailsForm {
  return {
    acquisitionSourceId: lead.acquisitionSourceId ?? "",
    ownerUserId: lead.ownerUserId ?? "",
    interestSummary: lead.interestSummary ?? "",
    expectedNeed: lead.expectedNeed ?? "",
    description: lead.description ?? "",
  };
}

/** UpdateLeadDto accepts ownerUserId; creator and timestamps are never writable. */
export function buildLeadDetailsRequest(form: LeadDetailsForm, baseline: LeadDetailsForm): UpdateLeadRequest & { ownerUserId?: string } {
  const request: UpdateLeadRequest & { ownerUserId?: string } = {};
  if (form.acquisitionSourceId !== baseline.acquisitionSourceId) {
    request.acquisitionSourceId = form.acquisitionSourceId || null;
  }
  if (form.ownerUserId !== baseline.ownerUserId && isUUIDv7(form.ownerUserId)) {
    request.ownerUserId = form.ownerUserId;
  }
  for (const field of ["interestSummary", "expectedNeed", "description"] as const) {
    if (form[field].trim() !== baseline[field].trim()) request[field] = form[field].trim();
  }
  return request;
}

export interface LeadDetailsUser {
  id: string;
  firstName: string;
  lastName: string;
}

/** TenantUsersService.toUserView does not expose an avatar URL. */
export function parseLeadDetailsUser(payload: unknown): LeadDetailsUser {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid user response.");
  const user = payload as Record<string, unknown>;
  if (!isUUIDv7(user.id) || typeof user.firstName !== "string" || typeof user.lastName !== "string") throw new Error("Invalid user response.");
  return { id: user.id, firstName: user.firstName, lastName: user.lastName };
}

export function leadDetailsUserName(user: LeadDetailsUser | null | undefined): string {
  return user ? `${user.firstName} ${user.lastName}`.trim() : "";
}

export function leadDetailsInitials(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  return [words[0], words.length > 1 ? words.at(-1) : undefined]
    .filter((word): word is string => Boolean(word))
    .map((word) => Array.from(word)[0]).join("").toLocaleUpperCase("en");
}
