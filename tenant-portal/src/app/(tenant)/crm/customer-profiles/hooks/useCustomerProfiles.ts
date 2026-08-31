"use client";

import { useCallback, useEffect, useState } from "react";
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

export function buildCustomerProfilesListPath({
  branchId,
  page,
  search,
}: {
  branchId: string;
  page: number;
  search: string;
}): string {
  if (!isUUIDv7(branchId)) {
    throw new Error("A valid branch is required to load customer profiles.");
  }
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error("Customer profile page must be a positive integer.");
  }
  const normalizedSearch = search.trim();
  if (normalizedSearch.length > 200) {
    throw new Error("Customer profile search must be 200 characters or fewer.");
  }

  const query = new URLSearchParams({
    branchId,
    page: String(page),
    limit: String(CUSTOMER_PROFILES_PAGE_SIZE),
    sortBy: "createdAt",
    sortDir: "DESC",
  });
  if (normalizedSearch) query.set("search", normalizedSearch);
  return CUSTOMER_PROFILES_PATH + "?" + query.toString();
}

export function customerProfilePath(id: string): string {
  return CUSTOMER_PROFILES_PATH + "/" + encodeURIComponent(id);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function useCustomerProfiles() {
  const { lang, t } = useI18n();
  const { user, isLoading: isAuthLoading } = useTenantAuth();
  const [result, setResult] = useState<CustomerProfilesPage | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [serverSearch, setServerSearch] = useState("");
  const [page, setPage] = useState(1);
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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPage(1);
      setServerSearch(searchQuery.trim());
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

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
          buildCustomerProfilesListPath({ branchId, page, search: serverSearch }),
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
    [branchId, page, serverSearch, t, userId],
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

  return {
    t,
    lang,
    items: result?.items ?? [],
    branchIds,
    branchId,
    selectBranch: (nextBranchId: string) => {
      selectBranch(nextBranchId);
      setResult(null);
      setSearchQuery("");
      setServerSearch("");
      setPage(1);
      setPrecondition(null);
      setLoadError(null);
    },
    pagination: result,
    searchQuery,
    setSearchQuery,
    isLoading: isAuthLoading || isLoading,
    precondition,
    loadError,
    previousPage,
    nextPage,
    reload,
  };
}
