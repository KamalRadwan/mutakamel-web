import { readCorePage } from "@/lib/api/envelope";
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
