"use client";

import { useEffect, useMemo, useState } from "react";
import { useCan } from "@/design-system";
import { readCoreData } from "@/lib/api/envelope";
import { normalizeApiError } from "@/lib/api/errors";
import {
  parseUserContactProfile,
  USER_PROFILE_READ_PERMISSION,
  type UserContactProfile,
} from "@/lib/people/user-profile";
import { isUUIDv7 } from "@/lib/uuid";
import { CORE_MAX_PAGE_LIMIT } from "../../contracts/core-page";
import {
  fetchOrgNode,
  fetchOrgNodes,
  type Branch,
  type Company,
  type OrgNodeOf,
} from "../../contracts/organization-contract";

type DepartmentRecord = OrgNodeOf<"departments">;

export type ResolvedLookup<T> =
  | { status: "ready"; value: T }
  | { status: "loading" | "forbidden" | "unavailable"; value: null };

type StoredEntry<T> =
  | { status: "ready"; value: T }
  | { status: "forbidden" | "unavailable"; value: null };

interface OrgLookupTargets {
  companyIds?: readonly (string | null | undefined)[];
  branchIds?: readonly (string | null | undefined)[];
  departmentIds?: readonly (string | null | undefined)[];
  userIds?: readonly (string | null | undefined)[];
}

export interface OrgLookupResolver {
  canReadCompanies: boolean;
  canReadBranches: boolean;
  canReadDepartments: boolean;
  canReadUsers: boolean;
  company: (id: string | null | undefined) => ResolvedLookup<Company>;
  branch: (id: string | null | undefined) => ResolvedLookup<Branch>;
  department: (id: string | null | undefined) => ResolvedLookup<DepartmentRecord>;
  user: (id: string | null | undefined) => ResolvedLookup<UserContactProfile>;
}

function uniqueValidIds(values: readonly (string | null | undefined)[] | undefined): string[] {
  if (!values || values.length === 0) return [];
  const seen = new Set<string>();
  for (const candidate of values) {
    if (typeof candidate === "string" && isUUIDv7(candidate)) {
      seen.add(candidate);
    }
  }
  return Array.from(seen).sort();
}

function readLookup<T>(
  id: string | null | undefined,
  canRead: boolean,
  store: Record<string, StoredEntry<T>>,
): ResolvedLookup<T> {
  if (!id || !isUUIDv7(id)) return { status: "unavailable", value: null };
  if (!canRead) return { status: "forbidden", value: null };
  const entry = store[id];
  if (!entry) return { status: "loading", value: null };
  return entry;
}

/**
 * Resolves organization parent foreign keys and team-lead user IDs only when
 * the signed-in user holds the owning read permission.
 *
 * Organization list and detail endpoints return foreign keys (`companyId`,
 * `branchId`, `departmentId`, `leadUserId`). Rather than leaking raw UUIDs as
 * names or guessing labels, this hook loads accessible records and exposes an
 * explicit `"forbidden"` / `"unavailable"` state whenever access is absent.
 */
export function useOrgLookupResolver(targets: OrgLookupTargets): OrgLookupResolver {
  const canReadCompanies = useCan("org.company.read");
  const canReadBranches = useCan("org.branch.read");
  const canReadDepartments = useCan("org.department.read");
  const canReadUsers = useCan(USER_PROFILE_READ_PERMISSION);

  const [companies, setCompanies] = useState<Record<string, StoredEntry<Company>>>({});
  const [branches, setBranches] = useState<Record<string, StoredEntry<Branch>>>({});
  const [departments, setDepartments] = useState<Record<string, StoredEntry<DepartmentRecord>>>({});
  const [users, setUsers] = useState<Record<string, StoredEntry<UserContactProfile>>>({});

  const departmentIds = useMemo(
    () => uniqueValidIds(targets.departmentIds),
    [targets.departmentIds],
  );
  const departmentKey = departmentIds.join(",");

  const derivedBranchIds = useMemo(() => {
    const extra = departmentIds
      .map((id) => departments[id])
      .filter((entry): entry is { status: "ready"; value: DepartmentRecord } => entry?.status === "ready")
      .map((entry) => entry.value.branchId);
    return uniqueValidIds([...(targets.branchIds ?? []), ...extra]);
  }, [departmentIds, departments, targets.branchIds]);
  const branchKey = derivedBranchIds.join(",");

  const derivedCompanyIds = useMemo(() => {
    const extra = derivedBranchIds
      .map((id) => branches[id])
      .filter((entry): entry is { status: "ready"; value: Branch } => entry?.status === "ready")
      .map((entry) => entry.value.companyId);
    return uniqueValidIds([...(targets.companyIds ?? []), ...extra]);
  }, [branches, derivedBranchIds, targets.companyIds]);
  const companyKey = derivedCompanyIds.join(",");

  const userIds = useMemo(() => uniqueValidIds(targets.userIds), [targets.userIds]);
  const userKey = userIds.join(",");

  useEffect(() => {
    if (!canReadDepartments || departmentIds.length === 0) return;
    const missing = departmentIds.filter((id) => !departments[id]);
    if (missing.length === 0) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void resolveOrgLevel("departments", missing, controller.signal).then((resolved) => {
        if (!controller.signal.aborted) {
          setDepartments((current) => ({ ...current, ...resolved }));
        }
      });
    });
    return () => controller.abort();
  }, [canReadDepartments, departmentIds, departmentKey, departments]);

  useEffect(() => {
    if (!canReadBranches || derivedBranchIds.length === 0) return;
    const missing = derivedBranchIds.filter((id) => !branches[id]);
    if (missing.length === 0) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void resolveOrgLevel("branches", missing, controller.signal).then((resolved) => {
        if (!controller.signal.aborted) {
          setBranches((current) => ({ ...current, ...resolved }));
        }
      });
    });
    return () => controller.abort();
  }, [branches, branchKey, canReadBranches, derivedBranchIds]);

  useEffect(() => {
    if (!canReadCompanies || derivedCompanyIds.length === 0) return;
    const missing = derivedCompanyIds.filter((id) => !companies[id]);
    if (missing.length === 0) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void resolveOrgLevel("companies", missing, controller.signal).then((resolved) => {
        if (!controller.signal.aborted) {
          setCompanies((current) => ({ ...current, ...resolved }));
        }
      });
    });
    return () => controller.abort();
  }, [canReadCompanies, companies, companyKey, derivedCompanyIds]);

  useEffect(() => {
    if (!canReadUsers || userIds.length === 0) return;
    const missing = userIds.filter((id) => !users[id]);
    if (missing.length === 0) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void Promise.all(
        missing.map(async (id): Promise<[string, StoredEntry<UserContactProfile>]> => {
          try {
            const raw = await readCoreData(`/api/tenant/core/v1/users/${encodeURIComponent(id)}`, {
              signal: controller.signal,
              cache: "no-store",
              maxResponseBytes: 64 * 1024,
              suppressForbiddenToast: true,
            });
            return [id, { status: "ready", value: parseUserContactProfile(raw, id) }];
          } catch (error) {
            const normalized = normalizeApiError(error);
            return [
              id,
              { status: normalized.status === 403 ? "forbidden" : "unavailable", value: null },
            ];
          }
        }),
      ).then((entries) => {
        if (!controller.signal.aborted) {
          setUsers((current) => ({ ...current, ...Object.fromEntries(entries) }));
        }
      });
    });
    return () => controller.abort();
  }, [canReadUsers, userIds, userKey, users]);

  return useMemo(
    () => ({
      canReadCompanies,
      canReadBranches,
      canReadDepartments,
      canReadUsers,
      company: (id) => readLookup(id, canReadCompanies, companies),
      branch: (id) => readLookup(id, canReadBranches, branches),
      department: (id) => readLookup(id, canReadDepartments, departments),
      user: (id) => readLookup(id, canReadUsers, users),
    }),
    [
      branches,
      canReadBranches,
      canReadCompanies,
      canReadDepartments,
      canReadUsers,
      companies,
      departments,
      users,
    ],
  );
}

async function resolveOrgLevel<L extends "companies" | "branches" | "departments">(
  level: L,
  ids: readonly string[],
  signal: AbortSignal,
): Promise<Record<string, StoredEntry<OrgNodeOf<L>>>> {
  const result: Record<string, StoredEntry<OrgNodeOf<L>>> = {};
  try {
    const firstPage = await fetchOrgNodes(level, {
      page: 1,
      search: "",
      limit: CORE_MAX_PAGE_LIMIT,
      signal,
      suppressForbiddenToast: true,
    });
    for (const item of firstPage.items) {
      result[item.id] = { status: "ready", value: item };
    }
  } catch (error) {
    const normalized = normalizeApiError(error);
    if (normalized.status === 403) {
      for (const id of ids) {
        result[id] = { status: "forbidden", value: null };
      }
      return result;
    }
  }

  const remaining = ids.filter((id) => !result[id]);
  await Promise.all(
    remaining.map(async (id) => {
      try {
        const item = await fetchOrgNode(level, id, signal);
        result[id] = { status: "ready", value: item };
      } catch (error) {
        const normalized = normalizeApiError(error);
        result[id] = {
          status: normalized.status === 403 ? "forbidden" : "unavailable",
          value: null,
        };
      }
    }),
  );
  return result;
}
