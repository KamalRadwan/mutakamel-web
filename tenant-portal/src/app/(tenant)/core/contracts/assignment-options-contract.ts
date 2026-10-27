import { readCoreData } from "@/lib/api/envelope";
import {
  CORE_LIST_RESPONSE_LIMIT_BYTES, CORE_MAX_PAGE_LIMIT, invalidCoreResponse,
  isMember, record, requiredBoolean, requiredText, requiredUuidV7,
} from "./core-page";
import { userPath } from "./user-contract";

export interface AssignmentChoice {
  branchId: string;
  branchName: string;
  roleId: string;
  roleNameAr: string;
  roleNameEn: string;
}

interface GrantLabel {
  kind: "role" | "branch" | "company";
  id: string;
  nameAr: string;
  nameEn: string;
}

export interface AssignmentOptions {
  choices: AssignmentChoice[];
  labels: GrantLabel[];
  hasMore: boolean;
}

export function parseAssignmentOptions(payload: unknown): AssignmentOptions {
  const source = record(payload);
  if (!source || !Array.isArray(source.choices) || source.choices.length > CORE_MAX_PAGE_LIMIT ||
      !Array.isArray(source.labels) || source.labels.length > 2500) invalidCoreResponse();
  const choices = source.choices.map((value): AssignmentChoice => {
    const row = record(value);
    const name = record(row?.roleNameI18n);
    if (!row || !name) invalidCoreResponse();
    return {
      branchId: requiredUuidV7(row, "branchId"),
      branchName: requiredText(row, "branchName", 200),
      roleId: requiredUuidV7(row, "roleId"),
      roleNameAr: requiredText(name, "ar", 200),
      roleNameEn: requiredText(name, "en", 200),
    };
  });
  const labels = source.labels.map((value): GrantLabel => {
    const row = record(value);
    const name = record(row?.nameI18n);
    if (!row || !name || !isMember(["role", "branch", "company"] as const, row.kind)) {
      invalidCoreResponse();
    }
    return {
      kind: row.kind,
      id: requiredUuidV7(row, "id"),
      nameAr: requiredText(name, "ar", 200),
      nameEn: requiredText(name, "en", 200),
    };
  });
  if (new Set(choices.map((row) => `${row.branchId}:${row.roleId}`)).size !== choices.length ||
      new Set(labels.map((row) => `${row.kind}:${row.id}`)).size !== labels.length) invalidCoreResponse();
  return { choices, labels, hasMore: requiredBoolean(source, "hasMore") };
}

export async function fetchAssignmentOptions(
  userId: string, search: string, page: number, signal: AbortSignal,
): Promise<AssignmentOptions> {
  const query = new URLSearchParams({ search: search.slice(0, 200), page: String(page), limit: String(CORE_MAX_PAGE_LIMIT) });
  return parseAssignmentOptions(await readCoreData(`${userPath(userId, "/assignment-options")}?${query}`, {
    signal, cache: "no-store", suppressForbiddenToast: true,
    maxResponseBytes: CORE_LIST_RESPONSE_LIMIT_BYTES,
  }));
}
