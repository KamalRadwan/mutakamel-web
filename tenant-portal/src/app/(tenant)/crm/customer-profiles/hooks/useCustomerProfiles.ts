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
  DEFAULT_CUSTOMER_PROFILE_SEARCH,
  buildCustomerProfileSearchRequest,
  buildCustomerProfilesListQuery,
  type CustomerProfileSearchState,
  type CustomerProfileSortBy,
} from "../customer-profile-search-contract";
import {
  buildCustomerProfileBasicSearchRequest,
  customerProfileBasicSearchNeedsPost,
} from "../customer-profile-basic-search-contract";

export const CUSTOMER_PROFILES_PATH = "/api/tenant/crm/v1/customer-profiles";
/**
 * Advanced mode's address. A POST that READS: the filter tree does not fit in
 * a query string, and the route answers the same envelope the list route does.
 *
 * Not exported — nothing outside this module addresses it, and `knip` is right
 * that an export is a claim something else needs the value.
 */
const CUSTOMER_PROFILES_SEARCH_PATH = CUSTOMER_PROFILES_PATH + "/search";
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

export type CustomerProfilesView = "board" | "card" | "list";

export interface CustomerProfileOwner {
  userId: string;
  firstName: string;
  lastName: string;
}

export interface CustomerProfileNextActivity {
  activityAt: string;
  bucket: "OVERDUE" | "TODAY" | "FUTURE";
}

export interface CustomerProfilePrimaryContact {
  partyId: string;
  displayName: string;
  jobTitle: string;
  email: string;
  phones: string[];
  isPrimary: boolean;
}

export interface CustomerProfileItem {
  id: string;
  branchId: string;
  partyId: string;
  displayName: string;
  profileType: CustomerProfileType;
  status: CustomerProfileStatus;
  companyName: string | null;
  phone: string | null;
  phones: string[];
  email: string | null;
  country: string;
  primaryContact: CustomerProfilePrimaryContact | null;
  ownerUserId: string | null;
  owner: CustomerProfileOwner | null;
  nextActivity: CustomerProfileNextActivity | null;
  acquisitionSourceNameAr: string | null;
  acquisitionSourceNameEn: string | null;
  sourceIconUrl: string | null;
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

function optionalText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseOwner(value: unknown): CustomerProfileOwner | null {
  if (value === undefined || value === null) return null;
  const owner = record(value);
  if (!owner || !isUUIDv7(owner.userId)) invalidResponse();
  if (
    (owner.firstName !== undefined &&
      owner.firstName !== null &&
      typeof owner.firstName !== "string") ||
    (owner.lastName !== undefined &&
      owner.lastName !== null &&
      typeof owner.lastName !== "string")
  ) {
    invalidResponse();
  }
  return {
    userId: owner.userId,
    firstName: optionalText(owner.firstName),
    lastName: optionalText(owner.lastName),
  };
}

function parseNextActivity(value: unknown): CustomerProfileNextActivity | null {
  if (value === undefined || value === null) return null;
  const activity = record(value);
  if (
    !activity ||
    typeof activity.activityAt !== "string" ||
    Number.isNaN(new Date(activity.activityAt).getTime()) ||
    !["OVERDUE", "TODAY", "FUTURE"].includes(String(activity.bucket))
  ) {
    invalidResponse();
  }
  return {
    activityAt: activity.activityAt,
    bucket: activity.bucket as CustomerProfileNextActivity["bucket"],
  };
}

function parsePrimaryContact(value: unknown): CustomerProfilePrimaryContact | null {
  if (value === undefined || value === null) return null;
  const contact = record(value);
  if (
    !contact ||
    !isUUIDv7(contact.partyId) ||
    typeof contact.displayName !== "string" ||
    !contact.displayName ||
    typeof contact.isPrimary !== "boolean" ||
    !Array.isArray(contact.phones) ||
    !contact.phones.every((phone) => typeof phone === "string")
  ) {
    invalidResponse();
  }
  return {
    partyId: contact.partyId,
    displayName: contact.displayName,
    jobTitle: optionalText(contact.jobTitle),
    email: optionalText(contact.email),
    phones: contact.phones,
    isPrimary: contact.isPrimary,
  };
}

function phoneNumbers(
  source: Record<string, unknown>,
  profileType: CustomerProfileType,
): string[] {
  const candidates = [
    optionalText(
      profileType === "CORPORATE"
        ? source.companyPhone
        : source.primaryMobile,
    ),
    ...(Array.isArray(source.phones) ? source.phones : []),
  ];
  const phones = new Set<string>();
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) continue;
    phones.add(candidate.trim());
    if (phones.size === 10) break;
  }
  return [...phones];
}

function sourceIconUrl(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (
    typeof value !== "string" ||
    !/^\/api\/tenant\/crm\/v1\/acquisition-sources\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/icon\?v=\d+$/iu.test(
      value,
    )
  ) {
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
  const address = record(source.address);
  const phones = phoneNumbers(source, source.profileType);

  return {
    id: requiredUuidV7(source, "id"),
    branchId,
    partyId: requiredUuidV7(source, "partyId"),
    displayName: requiredText(source, "displayName", 180),
    profileType: source.profileType,
    status: source.status,
    companyName: nullableText(source, "companyName", 180),
    phone: phones[0] ?? primaryMobile ?? companyPhone,
    phones,
    email:
      source.profileType === "CORPORATE"
        ? companyEmail ?? primaryEmail
        : primaryEmail ?? companyEmail,
    country: address ? optionalText(address.country) : "",
    primaryContact: parsePrimaryContact(source.primaryContact),
    ownerUserId,
    owner: parseOwner(source.owner),
    nextActivity: parseNextActivity(source.nextActivity),
    acquisitionSourceNameAr: acquisitionSource ? nullableText(acquisitionSource, "nameAr", 120) : null,
    acquisitionSourceNameEn: acquisitionSource ? nullableText(acquisitionSource, "nameEn", 120) : null,
    sourceIconUrl: sourceIconUrl(source.acquisitionSourceIconUrl),
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
  actorId,
  sortBy = "createdAt",
  sortDir = "DESC",
}: {
  branchId: string;
  page: number;
  search: CustomerProfileSearchState;
  actorId?: string;
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
    actorId,
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
  // The DRAFT question, as the bar and the card hold it: basic's one condition,
  // or advanced's filter tree. `customer-profile-search-contract` owns which
  // wire key or column each field becomes.
  const [search, setSearch] = useState<CustomerProfileSearchState>(
    DEFAULT_CUSTOMER_PROFILE_SEARCH,
  );
  // The APPLIED question — the one the list on screen answers. Basic keeps the
  // two in step through the debounce below; advanced only ever copies across on
  // an explicit submit, so a half-built tree never reaches the wire.
  const [serverSearch, setServerSearch] = useState<CustomerProfileSearchState>(
    DEFAULT_CUSTOMER_PROFILE_SEARCH,
  );
  const [activeView, setActiveView] = useState<CustomerProfilesView>("board");
  const [page, setPage] = useState(1);
  const sortRef = useRef(DEFAULT_CUSTOMER_PROFILES_SORT);
  const [sort, setSortState] = useState(DEFAULT_CUSTOMER_PROFILES_SORT);
  const [reloadToken, setReloadToken] = useState(0);
  const [dataRevision, setDataRevision] = useState(0);
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
  // It applies BASIC mode only. A filter tree is built one control at a time
  // and every intermediate state is a different question — a debounce would
  // fire a request for each of them, and the half-built ones are usually the
  // expensive ones. The one advanced state it does apply is the mode SWITCH
  // itself: until the applied question is advanced too, the list on screen is
  // still answering a basic filter the user can no longer see, so the switch
  // has to take effect once on its own.
  //
  // Applying also starts the result set over: page 4 of a name search is not
  // page 4 of a status filter.
  useEffect(() => {
    if (search.mode === "advanced" && serverSearch.mode === "advanced") return;
    const timeoutId = window.setTimeout(() => {
      setPage(1);
      setServerSearch(search);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [search, serverSearch.mode]);

  /** Advanced mode's only route to the wire: the card's Search button. */
  const submitSearch = useCallback(() => {
    setPage(1);
    setServerSearch(search);
    // Bumped as well, so pressing Search on a question that has not changed
    // still re-reads. A button that promises a search and does nothing reads
    // as a broken control, not as an already-answered one.
    setReloadToken((current) => current + 1);
    setDataRevision((current) => current + 1);
  }, [search]);

  const load = useCallback(
    async (signal: AbortSignal) => {
      if (activeView === "board") {
        setIsLoading(false);
        return;
      }
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
        const sortBy = sortRef.current.id;
        const sortDir = sortRef.current.direction === "asc" ? "ASC" : "DESC";
        // Two endpoints, ONE parser: the search route answers the list route's
        // envelope byte for byte, so nothing downstream of here knows which of
        // them replied.
        const useSearchEndpoint =
          serverSearch.mode === "advanced" ||
          customerProfileBasicSearchNeedsPost(serverSearch.basic);
        const response =
          useSearchEndpoint
            ? await axiosClient.post<unknown>(
                CUSTOMER_PROFILES_SEARCH_PATH,
                serverSearch.mode === "advanced"
                  ? buildCustomerProfileSearchRequest(serverSearch, {
                      branchId,
                      page,
                      limit: CUSTOMER_PROFILES_PAGE_SIZE,
                      sortBy,
                      sortDir,
                    })
                  : buildCustomerProfileBasicSearchRequest(
                      serverSearch.basic,
                      {
                        branchId,
                        page,
                        limit: CUSTOMER_PROFILES_PAGE_SIZE,
                        sortBy,
                        sortDir,
                      },
                      userId,
                    ),
                {
                  signal,
                  cache: "no-store",
                  maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
                  // A POST that reads. An idempotency key would file a replay
                  // record for a query, and the client would then refuse to
                  // repeat a search the user is entitled to repeat.
                  skipAutoIdempotency: true,
                  replayAfterRefresh: true,
                },
              )
            : await axiosClient.get<unknown>(
                buildCustomerProfilesListPath({
                  branchId,
                  page,
                  search: serverSearch,
                  actorId: userId,
                  sortBy,
                  sortDir,
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
    // `sort` is deliberately absent: the fetch reads `sortRef.current`, never
    // the state, so listing it here declared a read that does not happen. It
    // moves to the effect below, where it is what it actually is -- a re-run
    // trigger.
    [activeView, branchId, page, serverSearch, t, userId],
  );

  useEffect(() => {
    if (isAuthLoading) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [isAuthLoading, load, reloadToken, sort]);

  const previousPage = useCallback(() => {
    if (result?.hasPrev) setPage((current) => Math.max(1, current - 1));
  }, [result?.hasPrev]);

  const nextPage = useCallback(() => {
    if (result?.hasNext) setPage((current) => current + 1);
  }, [result?.hasNext]);

  // MASTER-PLAN 13.6: one line, and this list reconciles with the server on
  // an ALL-scoped resync, a realtime reconnect, and a return from offline.
  const reload = useCallback(() => {
    setReloadToken((current) => current + 1);
    setDataRevision((current) => current + 1);
  }, []);
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
      setSearch(DEFAULT_CUSTOMER_PROFILE_SEARCH);
      setServerSearch(DEFAULT_CUSTOMER_PROFILE_SEARCH);
      setPage(1);
      setPrecondition(null);
      setLoadError(null);
    },
    pagination: result,
    search,
    appliedSearch: serverSearch,
    setSearch,
    submitSearch,
    isLoading: isAuthLoading || isLoading,
    precondition,
    loadError,
    previousPage,
    nextPage,
    reload,
    activeView,
    setActiveView,
    dataRevision,
  };
}
