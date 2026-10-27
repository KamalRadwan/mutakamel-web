import { useCallback, useEffect, useMemo, useState } from "react";
import { isForbiddenError, listRoles, listAssignableRoles, type AssignableRolePurpose } from "../api/adminUsersApi";
import type { AdminRole } from "../types";

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export type RoleCatalogueStatus = "unavailable" | "loading" | "success" | "forbidden" | "error";
type RoleCataloguePurpose = AssignableRolePurpose | "management";

/** Publish only a complete catalogue, bounded to 50 requests / 5,000 roles. */
export async function loadAdminRoleCatalogue(purpose: RoleCataloguePurpose = "management", isCurrent = () => true): Promise<AdminRole[]> {
  const roles = new Map<string, AdminRole>();
  let expectedTotal: number | undefined;
  for (let page = 1; page <= MAX_PAGES; page++) {
    if (!isCurrent()) throw new Error("Role catalogue read cancelled");
    const params = { page, limit: PAGE_SIZE, sortBy: "name", sortDir: "ASC" };
    const { data, meta } = purpose === "management"
      ? await listRoles(params) : await listAssignableRoles(purpose, params);
    if (
      !Array.isArray(data) || !meta || meta.page !== page || meta.limit !== PAGE_SIZE ||
      !Number.isSafeInteger(meta.total) || meta.total < 0 ||
      !Number.isSafeInteger(meta.totalPages) || meta.totalPages < 0 ||
      Math.max(1, meta.totalPages) !== Math.max(1, Math.ceil(meta.total / PAGE_SIZE)) ||
      meta.totalPages > MAX_PAGES ||
      (expectedTotal !== undefined && meta.total !== expectedTotal) ||
      data.length !== Math.min(PAGE_SIZE, Math.max(0, meta.total - (page - 1) * PAGE_SIZE))
    ) {
      throw new Error("Incomplete role catalogue");
    }
    expectedTotal = meta.total;
    for (const role of data) {
      if (!role || typeof role.id !== "string" || !role.id || typeof role.name !== "string" || roles.has(role.id)) {
        throw new Error("Invalid role catalogue entry");
      }
      roles.set(role.id, role);
    }
    if (page >= meta.totalPages) return [...roles.values()];
  }
  throw new Error("Role catalogue exceeds safe bound");
}

export function useAdminRoleCatalogue(purpose: RoleCataloguePurpose = "management", enabled = true, authorityKey = "") {
  const [attempt, setAttempt] = useState(0);
  const request = useMemo(() => ({ purpose, enabled, authorityKey, attempt }), [purpose, enabled, authorityKey, attempt]);
  const [state, setState] = useState<{ roles: AdminRole[]; status: RoleCatalogueStatus; request: object | null }>({
    roles: [], status: "loading", request: null,
  });
  const reloadRoles = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!request.enabled) return;
    let active = true;
    void loadAdminRoleCatalogue(request.purpose, () => active).then(
      (roles) => { if (active) setState({ roles, status: "success", request }); },
      (error: unknown) => {
        if (active) setState({ roles: [], status: isForbiddenError(error) ? "forbidden" : "error", request });
      },
    );
    return () => { active = false; };
  }, [request]);

  const current = enabled && state.request === request;
  return {
    roles: current ? state.roles : [],
    rolesStatus: !enabled ? "unavailable" as const : current ? state.status : "loading" as const,
    reloadRoles,
  };
}
