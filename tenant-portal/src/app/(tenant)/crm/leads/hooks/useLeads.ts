"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import type { CardColor } from "@/design-system";
import {
  SCOPE_UNRESOLVED_ERROR,
  useOrganizationScopeHeaders,
} from "@/hooks/useOrganizationScope";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { useI18n } from "@/i18n/I18nContext";
import {
  TenantApiClientError,
  axiosClient,
  type AxiosResponse,
} from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  parseLeadStageCatalogueResponse,
  type LeadStageFlag,
} from "../../lead-stages/lead-stage-contract";
import {
  createCrmWriteAttempt,
  isAmbiguousWriteFailure,
  runCrmWrite,
} from "../../shared/crm-write";
import {
  buildLeadCardPatchBody,
  parseLeadCardColor,
  parseLeadNextActivity,
  parseLeadOwner,
  parseLeadRating,
  type LeadCardPatch,
  type LeadNextActivity,
  type LeadOwner,
} from "../lead-card-contract";
import { parseCrmTags, type CrmTag } from "../../shared/tag-contract";
import {
  buildCreateLeadRequest,
  type CreateLeadForm,
} from "../lead-create-contract";
import {
  DEFAULT_LEAD_SEARCH,
  buildLeadSearchRequest,
  type LeadSearchState,
} from "../lead-search-contract";
import { buildLeadsListQuery, buildLeadBasicSearchRequest, leadBasicSearchNeedsPost } from "../lead-basic-search-contract";

const DEFAULT_ADVANCED_LEAD_SEARCH: LeadSearchState = {
  ...DEFAULT_LEAD_SEARCH,
  mode: "advanced",
};

export type LeadsView = "board" | "card" | "list";

export interface LeadStage {
  id: string;
  nameAr: string;
  nameEn: string;
  flag: LeadStageFlag;
}

export interface LeadItem {
  id: string;
  partyId: string;
  leadProfileType: "INDIVIDUAL" | "CORPORATE";
  leadName: string;
  company: string;
  email: string;
  phone: string;
  /** Distinct contact and company numbers returned with the list row. */
  phones: string[];
  country: string;
  primaryContact: {
    partyId: string;
    displayName: string;
    jobTitle: string;
    email: string;
    phones: string[];
    isPrimary: boolean;
  } | null;
  sourceNameAr: string;
  sourceNameEn: string;
  sourceIconUrl: string | null;
  stageId: string;
  ownerUserId: string | null;
  // The board card's four fields. `ownerUserId` stays the capability key it
  // has always been — it is present on every lead — while `owner` carries the
  // NAMES the card draws initials from and is null whenever they are unknown.
  rating: number;
  cardColor: CardColor | null;
  owner: LeadOwner | null;
  nextActivity: LeadNextActivity | null;
  /**
   * The primary contact behind a CORPORATE lead — the card's second line.
   *
   * Empty on an individual lead. `leadProfileType` is the authoritative type;
   * names are not compared because a corporate display name commonly equals
   * its company name.
   */
  primaryContactName: string;
  /** The card's tag chips. Empty for an untagged lead and for a row that omits the field. */
  tags: CrmTag[];
}

export interface LeadActionCapability {
  scope: "own" | "team" | "all";
  ownerUserIds: string[] | null;
}

export interface LeadCapabilities {
  create: LeadActionCapability | null;
  update: LeadActionCapability | null;
  delete: LeadActionCapability | null;
}

export interface LeadsPage {
  items: LeadItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export type LeadsPageInfo = Omit<LeadsPage, "items">;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function optionalString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function sourceIconUrl(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== "string" ||
    !/^\/api\/tenant\/crm\/v1\/acquisition-sources\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/icon\?v=\d+$/iu.test(value)
  ) {
    throw new Error("Invalid leads response.");
  }
  return value;
}

function leadPhoneNumbers(
  lead: Record<string, unknown>,
  profileType: LeadItem["leadProfileType"],
): string[] {
  const candidates = profileType === "CORPORATE"
    ? [optionalString(lead.companyPhone), ...(Array.isArray(lead.phones) ? lead.phones : [])]
    : [optionalString(lead.primaryMobile), ...(Array.isArray(lead.phones) ? lead.phones : [])];
  const phones = new Set<string>();
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) continue;
    phones.add(candidate.trim());
    if (phones.size === 10) break;
  }
  return [...phones];
}

function parsePrimaryContact(value: unknown): LeadItem["primaryContact"] {
  if (value === null || value === undefined) return null;
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
    throw new Error("Invalid leads response.");
  }
  return {
    partyId: contact.partyId,
    displayName: contact.displayName,
    jobTitle: optionalString(contact.jobTitle),
    email: optionalString(contact.email),
    phones: contact.phones,
    isPrimary: contact.isPrimary,
  };
}

function requiredString(
  value: Record<string, unknown>,
  key: string,
  contract: string,
): string {
  const candidate = value[key];
  if (typeof candidate !== "string" || candidate.length === 0) {
    throw new Error(`Invalid ${contract} response.`);
  }
  return candidate;
}

function requiredUuidV7(
  value: Record<string, unknown>,
  key: string,
  contract: string,
): string {
  const candidate = value[key];
  if (!isUUIDv7(candidate)) {
    throw new Error(`Invalid ${contract} response.`);
  }
  return candidate;
}

function parseLead(value: unknown, expectedBranchId: string): LeadItem {
  const lead = record(value);
  if (!lead) throw new Error("Invalid leads response.");

  const displayName = requiredString(lead, "displayName", "leads");
  const branchId = requiredUuidV7(lead, "branchId", "leads");
  if (branchId !== expectedBranchId) {
    throw new Error("Invalid leads response.");
  }
  const acquisitionSource = record(lead.acquisitionSource);
  const address = record(lead.address);
  if (lead.leadProfileType !== "INDIVIDUAL" && lead.leadProfileType !== "CORPORATE") {
    throw new Error("Invalid leads response.");
  }
  const profileType = lead.leadProfileType;
  const phones = leadPhoneNumbers(lead, profileType);

  return {
    id: requiredUuidV7(lead, "id", "leads"),
    partyId: requiredUuidV7(lead, "partyId", "leads"),
    leadProfileType: profileType,
    leadName: displayName,
    company: optionalString(lead.companyName) || displayName,
    email: optionalString(profileType === "CORPORATE" ? lead.companyEmail : lead.email),
    phone: phones[0] ?? "",
    phones,
    country: address ? optionalString(address.country) : "",
    primaryContact: parsePrimaryContact(lead.primaryContact),
    sourceNameAr: acquisitionSource
      ? optionalString(acquisitionSource.nameAr) ||
        optionalString(acquisitionSource.nameEn) ||
        optionalString(acquisitionSource.code)
      : "",
    sourceNameEn: acquisitionSource
      ? optionalString(acquisitionSource.nameEn) ||
        optionalString(acquisitionSource.nameAr) ||
        optionalString(acquisitionSource.code)
      : "",
    sourceIconUrl: sourceIconUrl(lead.acquisitionSourceIconUrl),
    stageId: requiredUuidV7(lead, "stageId", "leads"),
    ownerUserId:
      lead.ownerUserId === null || lead.ownerUserId === undefined
        ? null
        : requiredUuidV7(lead, "ownerUserId", "leads"),
    rating: parseLeadRating(lead.rating),
    cardColor: parseLeadCardColor(lead.cardColor),
    owner: parseLeadOwner(lead.owner),
    nextActivity: parseLeadNextActivity(lead.nextActivity),
    primaryContactName: optionalString(lead.primaryContactName),
    tags: parseCrmTags(lead.tags, "Invalid leads response."),
  };
}

function parseActionCapability(value: unknown): LeadActionCapability | null {
  if (value === null) return null;
  const capability = record(value);
  if (
    !capability ||
    !["own", "team", "all"].includes(String(capability.scope)) ||
    !(
      capability.ownerUserIds === null ||
      (Array.isArray(capability.ownerUserIds) &&
        capability.ownerUserIds.length > 0 &&
        capability.ownerUserIds.every(
          (ownerId) => isUUIDv7(ownerId),
        ) &&
        new Set(capability.ownerUserIds).size ===
          capability.ownerUserIds.length)
    ) ||
    (capability.scope === "all") !== (capability.ownerUserIds === null)
  ) {
    throw new Error("Invalid lead capabilities response.");
  }
  return {
    scope: capability.scope as LeadActionCapability["scope"],
    ownerUserIds: capability.ownerUserIds as string[] | null,
  };
}

export function parseLeadCapabilitiesResponse(
  payload: unknown,
  expectedBranchId: string,
): LeadCapabilities {
  const response = record(payload);
  const leads = response && record(response.leads);
  if (!response || response.branchId !== expectedBranchId || !leads) {
    throw new Error("Invalid lead capabilities response.");
  }
  return {
    create: parseActionCapability(leads.create),
    update: parseActionCapability(leads.update),
    delete: parseActionCapability(leads.delete),
  };
}

export function capabilityAllowsOwner(
  capability: LeadActionCapability | null,
  ownerUserId: string | null,
): boolean {
  return (
    capability !== null &&
    (capability.ownerUserIds === null ||
      (ownerUserId !== null && capability.ownerUserIds.includes(ownerUserId)))
  );
}

export function parseLeadsResponse(
  payload: unknown,
  expectedBranchId: string,
): LeadsPage {
  const page = record(payload);
  if (
    !page ||
    !Array.isArray(page.items) ||
    !Number.isSafeInteger(page.total) ||
    !Number.isSafeInteger(page.page) ||
    !Number.isSafeInteger(page.limit) ||
    !Number.isSafeInteger(page.totalPages) ||
    typeof page.hasNext !== "boolean" ||
    typeof page.hasPrev !== "boolean"
  ) {
    throw new Error("Invalid leads response.");
  }
  const items = page.items.map((item) => parseLead(item, expectedBranchId));
  const total = page.total as number;
  const pageNumber = page.page as number;
  const limit = page.limit as number;
  const totalPages = page.totalPages as number;
  const hasNext = page.hasNext as boolean;
  const hasPrev = page.hasPrev as boolean;
  const expectedTotalPages = total === 0 ? 0 : Math.ceil(total / limit);
  if (
    total < 0 ||
    pageNumber < 1 ||
    limit < 1 ||
    limit > 100 ||
    totalPages < 0 ||
    totalPages !== expectedTotalPages ||
    items.length > limit ||
    hasPrev !== (pageNumber > 1 && totalPages > 0) ||
    hasNext !== (pageNumber < totalPages)
  ) {
    throw new Error("Invalid leads response.");
  }
  return {
    items,
    total,
    page: pageNumber,
    limit,
    totalPages,
    hasNext,
    hasPrev,
  };
}

export function parseLeadResponse(
  payload: unknown,
  expectedBranchId: string,
): LeadItem {
  return parseLead(payload, expectedBranchId);
}

/**
 * Applies the server-confirmed fields from the card PATCH without replacing
 * list-only enrichments such as a corporate lead's primary contact. The write
 * endpoint may return a valid lead row that omits those list/search fields.
 */
export function mergeLeadCardResponse(
  previous: LeadItem,
  patch: LeadCardPatch,
  payload: unknown,
  expectedBranchId: string,
): LeadItem {
  const confirmed = parseLeadResponse(payload, expectedBranchId);
  return {
    ...previous,
    ...(patch.rating !== undefined ? { rating: confirmed.rating } : {}),
    ...(patch.cardColor !== undefined ? { cardColor: confirmed.cardColor } : {}),
  };
}

export function parseLeadStagesResponse(payload: unknown): LeadStage[] {
  return parseLeadStageCatalogueResponse(payload)
    .filter(({ isActive }) => isActive)
    .map((stage) => ({
      id: stage.id,
      nameAr: stage.nameAr,
      nameEn: stage.nameEn,
      flag: stage.flag,
    }));
}

export interface LeadsDegradation {
  stages: boolean;
  capabilities: boolean;
}

const NO_DEGRADATION: LeadsDegradation = { stages: false, capabilities: false };

// A supporting source that rejected, or whose payload failed validation,
// degrades to null so the list it decorates still renders. Only the list
// itself is allowed to fail the screen.
function degradableSource<T>(
  settled: PromiseSettledResult<AxiosResponse<unknown>>,
  parse: (payload: unknown) => T,
): T | null {
  if (settled.status === "rejected") return null;
  try {
    return parse(settled.value.data);
  } catch {
    return null;
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isAmbiguousMutationError(error: unknown): boolean {
  return (
    !(error instanceof TenantApiClientError) || error.response.status >= 500
  );
}

// GET /crm/leads accepts displayName and createdAt only; else a 400.
//
// Module-level so the ref and the state can start from the same value without
// one reading the other. `useState(sortRef.current)` is a ref read during
// render, which React flags: a ref is not render input, and a component that
// derives rendered state from one can miss an update. Both now initialise from
// this constant instead. Nothing else changes — the ref still exists to give
// the async fetch below a non-stale sort, which is what it was always for.
//
// Never mutated in place: `setSort` assigns a fresh object to `sortRef.current`
// rather than writing through it, so sharing this one object at init is safe.
const DEFAULT_LEADS_SORT: { id: "displayName" | "createdAt"; direction: "asc" | "desc" } = {
  id: "createdAt",
  direction: "desc",
};

export function useLeads() {
  const { t } = useI18n();
  const { user } = useTenantAuth();
  // The page synchronizes this before the debounced read fires. Starting on a
  // list view preserves the hook's standalone contract in tests and callers
  // that do not render the workspace switcher.
  const [activeView, setActiveView] = useState<LeadsView>("card");
  const [items, setItems] = useState<LeadItem[]>([]);
  const [stages, setStages] = useState<LeadStage[]>([]);
  const [capabilities, setCapabilities] = useState<LeadCapabilities | null>(
    null,
  );
  // The question ON SCREEN. In basic mode it is also the question on the wire;
  // in advanced mode it is a draft the user is still building, and only the
  // card's Search button promotes it. The search contracts own the wire keys.
  const [search, setSearch] = useState<LeadSearchState>(DEFAULT_LEAD_SEARCH);
  // The question ON THE WIRE. Split from the draft because a filter tree is
  // built one control at a time and every intermediate state is a different
  // query — usually an expensive one nobody asked for.
  const [appliedSearch, setAppliedSearch] = useState<LeadSearchState>(DEFAULT_LEAD_SEARCH);
  const [page, setPage] = useState(1);
  const sortRef = useRef(DEFAULT_LEADS_SORT);
  const [sort, setSortState] = useState(DEFAULT_LEADS_SORT);
  // Mirrors `appliedSearch` for the async mutation handlers, which reload the
  // list long after the render that changed it.
  const searchRef = useRef<LeadSearchState>(DEFAULT_LEAD_SEARCH);
  // Advanced keeps an editable draft on screen. This ref records only the
  // last draft explicitly submitted, so leaving and re-entering the mode can
  // restore its results without accidentally applying later edits.
  const appliedAdvancedSearchRef = useRef<LeadSearchState>(DEFAULT_ADVANCED_LEAD_SEARCH);
  const pageRef = useRef(1);
  const requestEpochRef = useRef(0);
  const [pageInfo, setPageInfo] = useState<LeadsPageInfo>({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);
  const movingLeadRef = useRef<string | null>(null);
  // Leads with a card write in flight. A ref and not state: it gates the next
  // click, and re-rendering every card because one of them is saving a star is
  // exactly the jitter the optimistic update exists to avoid.
  const cardWritesRef = useRef<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  // The list fetch's own failure, kept apart from `error` (which carries
  // write feedback). The views take this one, so a load failure REPLACES the
  // empty state instead of stacking a banner on top of "No matching leads".
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [degraded, setDegraded] = useState<LeadsDegradation>(NO_DEGRADATION);
  const [dataRevision, setDataRevision] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<LeadItem | null>(
    null,
  );

  const { branchIds, branchId, selectBranch } =
    useTenantBranchSelection(user);
  // `crm.leads.capabilities.get` is BRANCH_REQUIRED in the Gateway route
  // contract, so it needs the two scope headers as well as the branchId query
  // parameter. Without them the Gateway answers 400 GW.REQUEST.INVALID before
  // crm-app sees the request — `validateOrganizationScope` in
  // api-gateway-app/src/common/middleware/route-context.middleware.ts — and
  // every action control on this screen silently degraded to "unavailable"
  // for a reason that had nothing to do with permissions (D11 / 8.5).
  const capabilityScope = useOrganizationScopeHeaders(
    "BRANCH_REQUIRED",
    branchId,
  );

  const changePage = useCallback((nextPage: number) => {
    pageRef.current = nextPage;
    setPage(nextPage);
  }, []);

  const changeSort = useCallback((next: { id: string; direction: "asc" | "desc" }) => {
    if (next.id !== "displayName" && next.id !== "createdAt") return;
    sortRef.current = { id: next.id, direction: next.direction };
    setSortState(sortRef.current);
    pageRef.current = 1;
    setPage(1);
  }, []);

  /**
   * A change to the question on screen, and — for basic mode only — to the
   * question on the wire.
   *
   * Basic answers as you type; the 250 ms debounce on the fetch effect below
   * is what coalesces the keystrokes. Advanced does NOT: editing a condition
   * must not fire a request, so the draft moves and the wire does not until
   * `submitSearch` runs.
   *
   * The one exception is the mode switch itself. Arriving in Advanced applies
   * its last explicitly submitted query (blank until the first submit), so a
   * Basic filter stops answering when its controls leave the screen without
   * promoting the still-editable Advanced draft.
   *
   * Applying also starts the result set over: page 4 of a name search is not
   * page 4 of a status filter.
   */
  const changeSearch = useCallback(
    (next: LeadSearchState) => {
      setSearch(next);
      if (next.mode === "advanced") {
        if (searchRef.current.mode === "advanced") return;
        const submittedAdvanced = appliedAdvancedSearchRef.current;
        searchRef.current = submittedAdvanced;
        setAppliedSearch(submittedAdvanced);
        changePage(1);
        return;
      }
      searchRef.current = next;
      setAppliedSearch(next);
      changePage(1);
    },
    [changePage],
  );

  /** Advanced mode's Search button: promote the draft, and run it. */
  const submitSearch = useCallback(() => {
    if (search.mode !== "advanced") return;
    appliedAdvancedSearchRef.current = search;
    searchRef.current = search;
    setAppliedSearch(search);
    changePage(1);
  }, [changePage, search]);

  const fetchLeads = useCallback(
    async (
      signal?: AbortSignal,
      requestedPage = page,
      requestedSearch: LeadSearchState = appliedSearch,
    ): Promise<boolean> => {
      const requestEpoch = requestEpochRef.current + 1;
      requestEpochRef.current = requestEpoch;
      if (!branchId || (requestedSearch.mode === "basic" && requestedSearch.basic.myLeads && !isUUIDv7(user?.id))) {
        setItems([]);
        setStages([]);
        setCapabilities(null);
        setPageInfo((current) => ({
          ...current,
          total: 0,
          page: 1,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        }));
        setIsLoading(false);
        // Not a failure — nothing was asked yet. The screen renders the
        // "pick a branch" empty state next to the selector that fixes it.
        setLoadError(null);
        setDegraded(NO_DEGRADATION);
        return false;
      }

      setIsLoading(true);
      setError(null);
      setLoadError(null);
      setDegraded(NO_DEGRADATION);
      try {
        const readPage = (requestedPageNumber: number) => {
          const window = {
            branchId,
            page: requestedPageNumber,
            limit: 50,
            sortBy: sortRef.current.id,
            sortDir:
              sortRef.current.direction === "asc" ? ("ASC" as const) : ("DESC" as const),
          };
          // Two endpoints, ONE parser: `POST /leads/search` answers with the
          // same `{ items, total, page, limit, totalPages, hasNext, hasPrev }`
          // envelope the list route does, so nothing below this line branches.
          if (requestedSearch.mode === "advanced" || leadBasicSearchNeedsPost(requestedSearch.basic)) {
            return axiosClient.post<unknown>(
              "/api/tenant/crm/v1/leads/search",
              requestedSearch.mode === "advanced"
                ? buildLeadSearchRequest(requestedSearch, window)
                : buildLeadBasicSearchRequest(requestedSearch.basic, window, user?.id),
              {
                signal,
                cache: "no-store",
                maxResponseBytes: 1024 * 1024,
                // A POST that READS. It has no idempotency key because there
                // is nothing to make idempotent, and it may be replayed after
                // a token refresh for the same reason a GET may — re-running
                // it changes nothing.
                skipAutoIdempotency: true,
                replayAfterRefresh: true,
              },
            );
          }
          const query = buildLeadsListQuery({ ...window, basic: requestedSearch.basic, actorId: user?.id });
          return axiosClient.get<unknown>(
            `/api/tenant/crm/v1/leads?${query.toString()}`,
            {
              signal,
              cache: "no-store",
              maxResponseBytes: 1024 * 1024,
            },
          );
        };
        // Three independent sources. Under Promise.all a capabilities 403
        // rejected the whole batch and blanked a list that had loaded
        // perfectly well; each source now settles on its own and only the
        // list can fail the screen.
        const [leadsSettled, stagesSettled, capabilitiesSettled] =
          await Promise.allSettled([
            activeView === "board" ? Promise.resolve(null) : readPage(requestedPage),
            axiosClient.get<unknown>("/api/tenant/crm/v1/lead-stages", {
              signal,
              cache: "no-store",
              maxResponseBytes: 256 * 1024,
            }),
            // D4: with no resolved scope the request is not sent at all. A
            // rejected source is already how this batch says "capabilities
            // unknown", and it degrades the action controls honestly instead
            // of firing an unscoped request the Gateway answers 400 to.
            capabilityScope.ready
              ? axiosClient.get<unknown>(
                  `/api/tenant/crm/v1/leads/capabilities?branchId=${encodeURIComponent(branchId)}`,
                  {
                    signal,
                    cache: "no-store",
                    maxResponseBytes: 256 * 1024,
                    headers: capabilityScope.headers,
                  },
                )
              : Promise.reject(new Error(SCOPE_UNRESOLVED_ERROR.code)),
          ]);

        // One aborted source means the whole request was cancelled — a newer
        // one is already in flight, so nothing here may touch state.
        if (
          [leadsSettled, stagesSettled, capabilitiesSettled].some(
            (settled) =>
              settled.status === "rejected" && isAbortError(settled.reason),
          )
        ) {
          return false;
        }

        const nextStages = degradableSource(stagesSettled, parseLeadStagesResponse);
        const nextCapabilities = degradableSource(capabilitiesSettled, (payload) =>
          parseLeadCapabilitiesResponse(payload, branchId),
        );

        if (leadsSettled.status === "rejected") throw leadsSettled.reason;

        if (activeView === "board") {
          if (requestEpoch !== requestEpochRef.current) return false;
          setItems([]);
          setStages(nextStages ?? []);
          setCapabilities(nextCapabilities);
          setDegraded({
            stages: nextStages === null,
            capabilities: nextCapabilities === null,
          });
          return true;
        }

        if (!leadsSettled.value) throw new Error("Invalid leads response.");

        let nextPage = parseLeadsResponse(leadsSettled.value.data, branchId);
        if (nextPage.page !== requestedPage) {
          throw new Error("Invalid leads response.");
        }
        const lastAvailablePage = Math.max(nextPage.totalPages, 1);
        if (nextPage.page > lastAvailablePage) {
          const fallbackResponse = await readPage(lastAvailablePage);
          nextPage = parseLeadsResponse(fallbackResponse.data, branchId);
          if (
            nextPage.page !== lastAvailablePage ||
            nextPage.page > Math.max(nextPage.totalPages, 1)
          ) {
            throw new Error("Invalid leads response.");
          }
        }
        if (requestEpoch !== requestEpochRef.current) return false;
        const { items: nextItems, ...nextPageInfo } = nextPage;
        setItems(nextItems);
        changePage(nextPageInfo.page);
        setPageInfo(nextPageInfo);
        setStages(nextStages ?? []);
        setCapabilities(nextCapabilities);
        setDegraded({
          stages: nextStages === null,
          capabilities: nextCapabilities === null,
        });
        return true;
      } catch (caught) {
        if (
          isAbortError(caught) ||
          requestEpoch !== requestEpochRef.current
        ) {
          return false;
        }
        setItems([]);
        setStages([]);
        setCapabilities(null);
        setPageInfo((current) => ({
          ...current,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        }));
        setDegraded(NO_DEGRADATION);
        setLoadError(normalizeApiError(caught));
        return false;
      } finally {
        if (
          !signal?.aborted &&
          requestEpoch === requestEpochRef.current
        ) {
          setIsLoading(false);
        }
      }
    },
    [activeView, appliedSearch, branchId, capabilityScope, changePage, page, user?.id],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (!controller.signal.aborted) void fetchLeads(controller.signal);
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [fetchLeads]);

  const handleCreate = async (form: CreateLeadForm): Promise<boolean> => {
    if (!branchId) {
      setError(t.crmLeads.messages.selectBranchToCreate);
      return false;
    }
    if (!capabilities?.create) {
      setError(t.crmLeads.messages.createNotPermitted);
      return false;
    }

    setError(null);
    // `POST /crm/leads` is `idempotencyMode: WRITE_SENSITIVE` with
    // `idempotent: true` in the Gateway contract, so it answers 400
    // GW.IDEM.MISSING without an `x-idempotency-key`. The key is minted per
    // SAVE PRESS rather than left to the transport: `runCrmWrite` reuses one
    // key across every retry of the same attempt, which is what stops a retry
    // from filing a second lead — and it reads `Idempotency-Replayed` as the
    // success it is rather than as a conflict. crm-write.ts, rules 1 and 2.
    const attempt = createCrmWriteAttempt();
    const outcome = await runCrmWrite({
      attempt,
      method: "post",
      path: "/api/tenant/crm/v1/leads",
      body: buildCreateLeadRequest(form, branchId),
      // Validated against the branch the lead was FILED INTO, not the one the
      // list happens to be showing. `parseLead` throws on a branch mismatch,
      // so passing the page's branch reported a lead that was created — and
      // is sitting in the other branch — as a failure, which invites the user
      // to create it a second time. D25.
      parse: (payload) => parseLeadResponse(payload, form.branchId || branchId),
      config: { maxResponseBytes: 256 * 1024 },
    });

    if (outcome.kind === "success") {
      setIsCreateOpen(false);
      changePage(1);
      await fetchLeads(undefined, 1, searchRef.current);
      setDataRevision((current) => current + 1);
      return true;
    }

    if (outcome.kind === "failed") {
      setError(
        outcome.error.code === "CRM_TAG_UNKNOWN"
          ? t.crmLeads.messages.tagUnknown
          : outcome.error.message || t.crmLeads.messages.createFailed,
      );
      return false;
    }

    // `ambiguous` and `applied_unreadable` share this exit on purpose. Under
    // one the lead may exist and under the other it does exist; in both the
    // only wrong move is to leave the filled form open, because the next Save
    // is a fresh attempt with a fresh key and therefore a second lead. The
    // modal closes and the default My Leads first page is reloaded so the user
    // can see an assigned record without silently widening the list.
    appliedAdvancedSearchRef.current = DEFAULT_ADVANCED_LEAD_SEARCH;
    changeSearch(DEFAULT_LEAD_SEARCH);
    const reloaded = await fetchLeads(undefined, 1, DEFAULT_LEAD_SEARCH);
    setDataRevision((current) => current + 1);
    setIsCreateOpen(false);
    setError(
      reloaded
        ? t.crmLeads.messages.createAmbiguousRefreshed
        : t.crmLeads.messages.createAmbiguousStale,
    );
    return false;
  };

  const handleDelete = async () => {
    if (!selectedForDelete || isDeleting) return;
    if (!capabilityAllowsOwner(capabilities?.delete ?? null, selectedForDelete.ownerUserId)) {
      setError(t.crmLeads.messages.deleteNotPermitted);
      setSelectedForDelete(null);
      return;
    }

    const targetId = selectedForDelete.id;
    setIsDeleting(true);
    setError(null);
    try {
      await axiosClient.delete(
        `/api/tenant/crm/v1/leads/${encodeURIComponent(targetId)}`,
        {
          nonReplayable: true,
          skipAutoIdempotency: true,
          cache: "no-store",
          maxResponseBytes: 64 * 1024,
        },
      );
      setSelectedForDelete(null);
      const requestedPage =
        items.length === 1 && pageRef.current > 1
          ? pageRef.current - 1
          : pageRef.current;
      changePage(requestedPage);
      await fetchLeads(undefined, requestedPage);
      setDataRevision((current) => current + 1);
    } catch (caught) {
      const message = errorMessage(caught, t.crmLeads.messages.deleteFailed);
      if (isAmbiguousMutationError(caught)) {
        await fetchLeads(
          undefined,
          pageRef.current,
          searchRef.current,
        );
        setDataRevision((current) => current + 1);
        setSelectedForDelete(null);
      }
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * The card's rating and colour, applied on screen first.
   *
   * Optimistic because the alternative is a star that does nothing for a round
   * trip, which reads as a broken control and gets clicked again. The price is
   * that a failure has to be VISIBLE: every exit below either adopts the
   * server-confirmed card fields or puts the old row back, and none of them
   * leaves the new value sitting on a card the server never accepted.
   *
   * Three outcomes, the same three crm-write.ts names:
   *   - a definite answer, parsed  -> adopt the confirmed card fields
   *   - a definite rejection (<500) -> revert, and say why
   *   - anything else               -> the write MAY have applied, so revert
   *     the guess and reload rather than assert either state
   *
   * One write per lead at a time. A second click during the round trip would
   * capture `previous` from an already-optimistic list, so a later failure
   * would "revert" to the value being written rather than the stored one.
   */
  const updateLeadCard = async (
    leadId: string,
    patch: LeadCardPatch,
    target?: LeadItem,
  ) => {
    if (!branchId || cardWritesRef.current.has(leadId)) return;
    const previous = target ?? items.find(({ id }) => id === leadId);
    if (
      !previous ||
      !capabilityAllowsOwner(capabilities?.update ?? null, previous.ownerUserId)
    ) {
      setError(t.crmLeads.messages.cardNotPermitted);
      return;
    }

    // A card write owns only the card fields in `patch`. It must never replace
    // the whole row: while the request is in flight a list refresh can deliver
    // richer company data (primary contact, phones, address, owner). Replacing
    // that fresh row with the snapshot captured before the request is exactly
    // how changing a rating made a corporate contact disappear from Table.
    const applyCardFields = (fields: LeadCardPatch) =>
      setItems((current) =>
        current.map((item) =>
          item.id === leadId ? { ...item, ...fields } : item,
        ),
      );

    cardWritesRef.current.add(leadId);
    setError(null);
    applyCardFields(patch);
    try {
      let response: AxiosResponse<unknown>;
      try {
        response = await axiosClient.patch<unknown>(
          `/api/tenant/crm/v1/leads/${encodeURIComponent(leadId)}`,
          buildLeadCardPatchBody(patch),
          {
            // `idempotent: false` in the Gateway route contract: no key to
            // mint, and nothing to replay after a token refresh — a repeat of
            // this PATCH is a second write of the same value, never a
            // duplicate record.
            nonReplayable: true,
            skipAutoIdempotency: true,
            cache: "no-store",
            maxResponseBytes: 256 * 1024,
          },
        );
      } catch (caught) {
        // The guess comes off the card either way: a definite rejection means
        // the write did not happen, and an unknown outcome means the card must
        // not keep asserting a value nobody confirmed.
        applyCardFields({
          ...(patch.rating !== undefined ? { rating: previous.rating } : {}),
          ...(patch.cardColor !== undefined ? { cardColor: previous.cardColor } : {}),
        });
        if (isAmbiguousWriteFailure(caught)) {
          await fetchLeads(undefined, pageRef.current, searchRef.current);
          setDataRevision((current) => current + 1);
          setError(t.crmLeads.messages.cardUpdateAmbiguous);
          return;
        }
        setError(errorMessage(caught, t.crmLeads.messages.cardUpdateFailed));
        return;
      }

      // Past this line the write APPLIED, so parsing is outside the block
      // above on purpose — crm-write.ts's `applied_unreadable`. A body this
      // client cannot read is a contract failure of a write that already
      // happened, and reverting would put a stale value back onto a card the
      // server has already changed. Reload instead, and say the result is
      // unverified.
      try {
        const confirmed = mergeLeadCardResponse(previous, patch, response.data, branchId);
        applyCardFields({
          ...(patch.rating !== undefined ? { rating: confirmed.rating } : {}),
          ...(patch.cardColor !== undefined ? { cardColor: confirmed.cardColor } : {}),
        });
        setDataRevision((current) => current + 1);
      } catch {
        await fetchLeads(undefined, pageRef.current, searchRef.current);
        setDataRevision((current) => current + 1);
        setError(t.crmLeads.messages.cardUpdateAmbiguous);
      }
    } finally {
      cardWritesRef.current.delete(leadId);
    }
  };

  const moveLead = async (
    leadId: string,
    destinationStageId: string,
    target?: LeadItem,
  ) => {
    if (movingLeadRef.current !== null) return;
    if (!branchId) {
      setError(t.crmLeads.messages.selectBranchToMove);
      return;
    }
    const lead = target ?? items.find(({ id }) => id === leadId);
    if (
      !lead ||
      !capabilityAllowsOwner(capabilities?.update ?? null, lead.ownerUserId)
    ) {
      setError(t.crmLeads.messages.moveNotPermitted);
      return;
    }
    if (stages.find(({ id }) => id === lead.stageId)?.flag === "CONVERTED") {
      setError(t.crmLeads.messages.convertedCannotMove);
      return;
    }
    const destinationStage = stages.find(({ id }) => id === destinationStageId);
    if (!destinationStage || destinationStage.flag === "CONVERTED") {
      setError(t.crmLeads.messages.stageUnavailable);
      return;
    }

    movingLeadRef.current = leadId;
    setMovingLeadId(leadId);
    setError(null);
    try {
      const response = await axiosClient.post<unknown>(
        `/api/tenant/crm/v1/leads/${encodeURIComponent(leadId)}/stage`,
        { stageId: destinationStageId },
        {
          nonReplayable: true,
          skipAutoIdempotency: true,
          cache: "no-store",
          maxResponseBytes: 256 * 1024,
        },
      );
      parseLeadResponse(response.data, branchId);
      await fetchLeads(
        undefined,
        pageRef.current,
        searchRef.current,
      );
      setDataRevision((current) => current + 1);
    } catch (caught) {
      const message = errorMessage(caught, t.crmLeads.messages.moveFailed);
      if (isAmbiguousMutationError(caught)) {
        await fetchLeads(
          undefined,
          pageRef.current,
          searchRef.current,
        );
        setDataRevision((current) => current + 1);
      }
      setError(message);
    } finally {
      movingLeadRef.current = null;
      setMovingLeadId(null);
    }
  };

  return {
    t,
    activeView,
    setActiveView,
    items,
    stages,
    branchIds,
    branchId,
    selectBranch: (nextBranchId: string) => {
      requestEpochRef.current += 1;
      selectBranch(nextBranchId);
      setItems([]);
      setStages([]);
      setCapabilities(null);
      appliedAdvancedSearchRef.current = DEFAULT_ADVANCED_LEAD_SEARCH;
      changeSearch(DEFAULT_LEAD_SEARCH);
      setSelectedForDelete(null);
      setIsCreateOpen(false);
      setError(null);
      setLoadError(null);
      setDegraded(NO_DEGRADATION);
    },
    canCreate: capabilities?.create !== null && capabilities?.create !== undefined,
    canUpdateLead: (lead: LeadItem) =>
      capabilityAllowsOwner(capabilities?.update ?? null, lead.ownerUserId),
    canDeleteLead: (lead: LeadItem) =>
      capabilityAllowsOwner(capabilities?.delete ?? null, lead.ownerUserId),
    isLoading,
    isDeleting,
    isMovePending: movingLeadId !== null,
    error,
    loadError,
    degraded,
    search,
    appliedSearch,
    setSearch: changeSearch,
    submitSearch,
    pageInfo,
    setPage: changePage,
    sort,
    setSort: changeSort,
    isCreateOpen,
    setIsCreateOpen,
    openCreate: () => {
      setError(null);
      setIsCreateOpen(true);
    },
    selectedForDelete,
    setSelectedForDelete,
    handleCreate,
    handleDelete,
    moveLead,
    updateLeadCard,
    fetchLeads,
    dataRevision,
    refreshData: () => {
      setDataRevision((current) => current + 1);
      return fetchLeads(undefined, pageRef.current, searchRef.current);
    },
  };
}
