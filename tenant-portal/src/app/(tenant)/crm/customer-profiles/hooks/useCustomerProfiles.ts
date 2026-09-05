"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useRealtimeResync } from "@/design-system";
import {
  resolveDefaultTenantBranchId,
  useTenantBranchSelection,
  type TenantBranchSource,
} from "@/hooks/useTenantBranchSelection";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  EMPTY_CUSTOMER_PROFILE_SEARCH,
  buildCustomerProfilesListQuery,
  type CustomerProfileSearchState,
  type CustomerProfileSortBy,
} from "../customer-profile-search-contract";

export const CUSTOMER_PROFILES_PATH = "/api/tenant/crm/v1/customer-profiles";
export const CUSTOMER_PROFILES_PAGE_SIZE = 25;

export const CUSTOMER_PROFILE_TYPES = ["INDIVIDUAL", "CORPORATE"] as const;
const CUSTOMER_PROFILE_STATUSES = [
  "PROSPECT",
  "ACTIVE_CUSTOMER",
  "INACTIVE",
  "BLACKLISTED",
] as const;

export type CustomerProfileType = (typeof CUSTOMER_PROFILE_TYPES)[number];
export type CustomerProfileStatus =
  (typeof CUSTOMER_PROFILE_STATUSES)[number];

export interface CustomerProfileItem {
  id: string;
  branchId: string;
  displayName: string;
  profileType: CustomerProfileType;
  status: CustomerProfileStatus;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  // Additive for the phase-4 card/board views (docs/design/views.md's
  // per-screen card-fields table) — ownerUserId and the joined
  // acquisitionSource are both genuinely on the response
  // (CustomerProfileEntity / party-read-model.ts), verified against
  // backend source since neither has a docs/api/*.md example. No
  // owner-name enrichment exists server-side, so this is the raw id.
  ownerUserId: string | null;
  acquisitionSourceNameAr: string | null;
  acquisitionSourceNameEn: string | null;
}

export interface CustomerProfilesPage {
  items: CustomerProfileItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const LIST_RESPONSE_LIMIT_BYTES = 1_000_000;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function invalidResponse(): never {
  throw new Error("Invalid CRM customer-profiles response.");
}

function isMember<const T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function requiredUuidV7(
  source: Record<string, unknown>,
  key: string,
): string {
  const value = source[key];
  if (!isUUIDv7(value)) {
    invalidResponse();
  }
  return value;
}

function requiredText(
  source: Record<string, unknown>,
  key: string,
  maxLength: number,
): string {
  const value = source[key];
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maxLength
  ) {
    invalidResponse();
  }
  return value;
}

function nullableText(
  source: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | null {
  const value = source[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > maxLength) {
    invalidResponse();
  }
  return value;
}

function safeInteger(
  source: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const value = source[key];
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < minimum ||
    (value as number) > maximum
  ) {
    invalidResponse();
  }
  return value as number;
}

export function parseCustomerProfileResponse(
  payload: unknown,
  expectedBranchId?: string,
): CustomerProfileItem {
  const source = record(payload);
  if (!source) invalidResponse();

  const branchId = requiredUuidV7(source, "branchId");
  if (expectedBranchId && branchId !== expectedBranchId) invalidResponse();

  if (
    !isMember(CUSTOMER_PROFILE_TYPES, source.profileType) ||
    !isMember(CUSTOMER_PROFILE_STATUSES, source.status)
  ) {
    invalidResponse();
  }

  const primaryMobile = nullableText(source, "primaryMobile", 32);
  const companyPhone = nullableText(source, "companyPhone", 32);
  const primaryEmail = nullableText(source, "email", 180);
  const companyEmail = nullableText(source, "companyEmail", 180);
  const ownerUserId = typeof source.ownerUserId === "string" && isUUIDv7(source.ownerUserId) ? source.ownerUserId : null;
  const acquisitionSource = record(source.acquisitionSource);

  return {
    id: requiredUuidV7(source, "id"),
    branchId,
    displayName: requiredText(source, "displayName", 180),
    profileType: source.profileType,
    status: source.status,
    companyName: nullableText(source, "companyName", 180),
    phone: primaryMobile ?? companyPhone,
    email: primaryEmail ?? companyEmail,
    ownerUserId,
    acquisitionSourceNameAr: acquisitionSource ? nullableText(acquisitionSource, "nameAr", 120) : null,
    acquisitionSourceNameEn: acquisitionSource ? nullableText(acquisitionSource, "nameEn", 120) : null,
  };
}

export function parseCustomerProfilesPageResponse(
  payload: unknown,
  expectedBranchId?: string,
): CustomerProfilesPage {
  const source = record(payload);
  if (!source || !Array.isArray(source.items)) invalidResponse();

  const total = safeInteger(source, "total", 0);
  const page = safeInteger(source, "page", 1);
  const limit = safeInteger(source, "limit", 1, 100);
  const totalPages = safeInteger(source, "totalPages", 0);
  if (
    typeof source.hasNext !== "boolean" ||
    typeof source.hasPrev !== "boolean" ||
    source.items.length > limit ||
    source.items.length > total ||
    totalPages !== (total === 0 ? 0 : Math.ceil(total / limit)) ||
    source.hasNext !== (page < totalPages) ||
    source.hasPrev !== (page > 1 && totalPages > 0)
  ) {
    invalidResponse();
  }

  const items = source.items.map((item) =>
    parseCustomerProfileResponse(item, expectedBranchId),
  );
  if (new Set(items.map(({ id }) => id)).size !== items.length) {
    invalidResponse();
  }

  return {
    items,
    total,
    page,
    limit,
    totalPages,
    hasNext: source.hasNext,
    hasPrev: source.hasPrev,
  };
}

export function resolveCustomerProfilesBranchId(
  source: TenantBranchSource | null | undefined,
): string | null {
  return resolveDefaultTenantBranchId(source);
}

/**
 * GET /crm/customer-profiles accepts these two fields only; else a 400.
 *
 * Not exported: the allowlist is consumed by `setSort` below and nothing else.
 * `knip` flags the unused export, and it is right to — an export is a claim
 * that something else needs the value. The TYPE lives in
 * `customer-profile-search-contract`, with the rest of the wire vocabulary.
 */
const CUSTOMER_PROFILE_SORT_FIELDS: readonly CustomerProfileSortBy[] = [
  "displayName",
  "createdAt",
];

/**
 * The list request's address: this module's path, and the search contract's
 * query string.
 *
 * The preconditions stay here because they are about the CALLER, not the wire
 * — a bad branch or page is a bug in this portal, worth a thrown Error rather
 * than a request the server answers 400 to. Everything downstream of `?` is
 * `customer-profile-search-contract`'s, which is the only module allowed to
 * name a query key.
 */
export function buildCustomerProfilesListPath({
  branchId,
  page,
  search,
  sortBy = "createdAt",
  sortDir = "DESC",
}: {
  branchId: string;
  page: number;
  search: CustomerProfileSearchState;
  sortBy?: CustomerProfileSortBy;
  sortDir?: "ASC" | "DESC";
}): string {
  if (!isUUIDv7(branchId)) {
    throw new Error("A valid branch is required to load customer profiles.");
  }
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error("Customer profile page must be a positive integer.");
  }

  const query = buildCustomerProfilesListQuery({
    branchId,
    page,
    limit: CUSTOMER_PROFILES_PAGE_SIZE,
    sortBy,
    sortDir,
    search,
  });
  return CUSTOMER_PROFILES_PATH + "?" + query.toString();
}

export function customerProfilePath(id: string): string {
  return CUSTOMER_PROFILES_PATH + "/" + encodeURIComponent(id);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

// Module-level so the ref and the state can start from the same value without
// one reading the other. `useState(sortRef.current)` is a ref read during
// render, which React flags: a ref is not render input, and a component that
// derives rendered state from one can miss an update. Both now initialise from
// this constant instead. The ref itself stays — it is what gives the async
// fetch below a non-stale sort.
//
// Never mutated in place: `setSort` assigns a fresh object to `sortRef.current`
// rather than writing through it, so sharing this one object at init is safe.
const DEFAULT_CUSTOMER_PROFILES_SORT: {
  id: CustomerProfileSortBy;
  direction: "asc" | "desc";
} = { id: "createdAt", direction: "desc" };

export function useCustomerProfiles() {
  const { lang, t } = useI18n();
  const { user, isLoading: isAuthLoading } = useTenantAuth();
  const [result, setResult] = useState<CustomerProfilesPage | null>(null);
  // Conditions of `[field] [value]`, AND-ed — the whole of what this screen
  // may ask the list endpoint, one of them in basic mode and up to one per
  // field in advanced. `customer-profile-search-contract` owns which wire key
  // each field becomes, and refuses to name two rows the same one.
  const [search, setSearch] = useState<CustomerProfileSearchState>(
    EMPTY_CUSTOMER_PROFILE_SEARCH,
  );
  const [serverSearch, setServerSearch] = useState<CustomerProfileSearchState>(
    EMPTY_CUSTOMER_PROFILE_SEARCH,
  );
  const [page, setPage] = useState(1);
  const sortRef = useRef(DEFAULT_CUSTOMER_PROFILES_SORT);
  const [sort, setSortState] = useState(DEFAULT_CUSTOMER_PROFILES_SORT);
  const [reloadToken, setReloadToken] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  // A precondition that stops the request being made at all — no session, or
  // no single trusted branch. It is not a failure, so it renders as an empty
  // state rather than a red banner over one.
  const [precondition, setPrecondition] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);

  const { branchIds, branchId, selectBranch } =
    useTenantBranchSelection(user);
  const userId = user?.id ?? null;

  // The screen's ONE debounce, and it now stands alone: the `FilterBar` this
  // bar replaced carried a 300ms debounce of its own, so a keystroke waited
  // 600ms and two timers had to be reasoned about to explain one request.
  //
  // Any change to the filter — a field, a value, a condition added or removed,
  // a mode switch, or a reset — also starts the result set over: page 4 of a
  // name search is not page 4 of a status filter.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPage(1);
      setServerSearch(search);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setIsLoading(true);
      setPrecondition(null);
      setLoadError(null);
      setResult(null);

      if (!userId) {
        setPrecondition(t.crmCustomerProfiles.sessionRequired);
        setIsLoading(false);
        return;
      }
      if (!branchId) {
        setPrecondition(t.crmCustomerProfiles.singleBranchRequired);
        setIsLoading(false);
        return;
      }

      try {
        const response = await axiosClient.get<unknown>(
          buildCustomerProfilesListPath({
            branchId,
            page,
            search: serverSearch,
            sortBy: sortRef.current.id,
            sortDir: sortRef.current.direction === "asc" ? "ASC" : "DESC",
          }),
          {
            signal,
            cache: "no-store",
            maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
          },
        );
        const parsed = parseCustomerProfilesPageResponse(
          response.data,
          branchId,
        );
        if (parsed.page !== page || parsed.limit !== CUSTOMER_PROFILES_PAGE_SIZE) {
          invalidResponse();
        }
        setResult(parsed);
      } catch (caught) {
        if (isAbortError(caught)) return;
        setResult(null);
        setLoadError(normalizeApiError(caught));
      } finally {
        if (!signal.aborted) setIsLoading(false);
      }
    },
    [branchId, page, serverSearch, sort, t, userId],
  );

  useEffect(() => {
    if (isAuthLoading) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [isAuthLoading, load, reloadToken]);

  const previousPage = useCallback(() => {
    if (result?.hasPrev) setPage((current) => Math.max(1, current - 1));
  }, [result?.hasPrev]);

  const nextPage = useCallback(() => {
    if (result?.hasNext) setPage((current) => current + 1);
  }, [result?.hasNext]);

  // MASTER-PLAN 13.6: one line, and this list reconciles with the server on
  // an ALL-scoped resync, a realtime reconnect, and a return from offline.
  const reload = useCallback(() => setReloadToken((current) => current + 1), []);
  useRealtimeResync(reload);

  const setSort = useCallback((next: { id: string; direction: "asc" | "desc" }) => {
    const field = CUSTOMER_PROFILE_SORT_FIELDS.find((allowed) => allowed === next.id);
    if (!field) return;
    sortRef.current = { id: field, direction: next.direction };
    setSortState(sortRef.current);
    setPage(1);
  }, []);

  return {
    t,
    lang,
    sort,
    setSort,
    items: result?.items ?? [],
    branchIds,
    branchId,
    selectBranch: (nextBranchId: string) => {
      selectBranch(nextBranchId);
      setResult(null);
      setSearch(EMPTY_CUSTOMER_PROFILE_SEARCH);
      setServerSearch(EMPTY_CUSTOMER_PROFILE_SEARCH);
      setPage(1);
      setPrecondition(null);
      setLoadError(null);
    },
    pagination: result,
    search,
    setSearch,
    isLoading: isAuthLoading || isLoading,
    precondition,
    loadError,
    previousPage,
    nextPage,
    reload,
  };
}
