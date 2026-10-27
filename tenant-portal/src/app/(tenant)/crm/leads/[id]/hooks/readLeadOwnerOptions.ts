import { readCorePage } from "@/lib/api/envelope";
import { axiosClient } from "@/lib/api/axiosClient";
import { isUUIDv7 } from "@/lib/uuid";
import { parseLeadDetailsUser, type LeadDetailsUser } from "../lead-details-edit-contract";
const USERS_PATH = "/api/tenant/core/v1/users";

/** Core's branch-visible ACTIVE users are candidates, not assignment authority. */
export async function readOwnerOptions(branchId: string, signal: AbortSignal): Promise<LeadDetailsUser[]> {
  const users: LeadDetailsUser[] = [];
  for (let page = 1; ; page += 1) {
    // PaginationQueryDto permits at most 100; no silent first-page-only picker.
    const query = new URLSearchParams({ branchId, status: "ACTIVE", page: String(page), limit: "100", sortBy: "firstName", sortDir: "ASC" });
    const result = await readCorePage(USERS_PATH, query.toString(), { signal, cache: "no-store", maxResponseBytes: 512 * 1024 });
    if (!Array.isArray(result.data) || !result.meta || typeof result.meta !== "object") throw new Error("Invalid user list response.");
    const meta = result.meta as Record<string, unknown>;
    if (typeof meta.hasNext !== "boolean" || meta.page !== page) throw new Error("Invalid user list response.");
    const next = result.data.map(parseLeadDetailsUser);
    if (new Set(next.map(({ id }) => id)).size !== next.length) throw new Error("Invalid user list response.");
    if (next.some((user) => users.some(({ id }) => id === user.id)) || (meta.hasNext && next.length === 0)) throw new Error("Invalid user list response.");
    users.push(...next);
    if (!meta.hasNext) return users;
  }
}

/** CRM resolves assignment scope without granting access to the Core directory. */
export async function readAssignableLeadOwners(branchId: string, action: "create" | "update", signal: AbortSignal, headers: Record<string, string>): Promise<LeadDetailsUser[]> {
  const users: LeadDetailsUser[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  for (;;) {
    // AssignableOwnersQueryDto permits 1-200; the service orders by user ID.
    const query = new URLSearchParams({ branchId, resource: "leads", action, limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const response = await axiosClient.get<unknown>(`/api/tenant/crm/v1/assignable-owners?${query}`, { signal, headers, cache: "no-store", maxResponseBytes: 512 * 1024 });
    if (signal.aborted) throw new Error("Owner options request aborted.");
    const payload = response.data;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid assignable owners response.");
    const page = payload as Record<string, unknown>;
    if (!Array.isArray(page.items) || (page.nextCursor !== null && !isUUIDv7(page.nextCursor))) throw new Error("Invalid assignable owners response.");
    let previousId = cursor;
    for (const item of page.items as unknown[]) {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Invalid assignable owner.");
      const owner = item as Record<string, unknown>;
      if (!isUUIDv7(owner.id) || typeof owner.displayName !== "string" || (owner.avatarUrl !== null && typeof owner.avatarUrl !== "string") || seen.has(owner.id) || (previousId !== null && owner.id <= previousId)) throw new Error("Invalid assignable owner.");
      seen.add(owner.id);
      previousId = owner.id;
      // Keep CRM's display name intact in the existing name-only view model.
      users.push({ id: owner.id, firstName: owner.displayName, lastName: "" });
    }
    if (page.nextCursor === null) return users;
    if (page.items.length === 0 || page.nextCursor !== previousId) throw new Error("Invalid assignable owners cursor.");
    cursor = page.nextCursor as string;
  }
}
