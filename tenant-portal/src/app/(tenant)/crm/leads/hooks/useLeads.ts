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
  parseLeadTags,
  type LeadCardPatch,
  type LeadNextActivity,
  type LeadOwner,
  type LeadTag,
} from "../lead-card-contract";
import {
  buildCreateLeadRequest,
  type CreateLeadForm,
} from "../lead-create-contract";
import {
  EMPTY_LEAD_SEARCH,
  buildLeadSearchRequest,
  buildLeadsListQuery,
  type LeadSearchState,
} from "../lead-search-contract";

export type LeadsView = "board" | "card" | "list";

export interface LeadStage {
  id: string;
  nameAr: string;
  nameEn: string;
  flag: LeadStageFlag;
}

export interface LeadItem {
  id: string;
  leadName: string;
  company: string;
  email: string;
  phone: string;
  sourceNameAr: string;
  sourceNameEn: string;
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
   * Null on an individual lead, and that is how the card tells the two apart:
   * the list projects no `leadProfileType`, and comparing `company` with
   * `leadName` cannot do it, because CRM composes a corporate lead's display
   * name FROM its company name, so the two are equal on exactly the leads that
   * do have a contact to show.
   */
  primaryContactName: string;
  /** The card's tag chips. Empty for an untagged lead and for a row that omits the field. */
  tags: LeadTag[];
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

  return {
    id: requiredUuidV7(lead, "id", "leads"),
    leadName: displayName,
    company: optionalString(lead.companyName) || displayName,
    email: optionalString(lead.email),
    phone:
      optionalString(lead.primaryMobile) || optionalString(lead.companyPhone),
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
    tags: parseLeadTags(lead.tags),
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
  const [activeView, setActiveView] = useState<LeadsView>("board");
  const [items, setItems] = useState<LeadItem[]>([]);
  const [stages, setStages] = useState<LeadStage[]>([]);
  const [capabilities, setCapabilities] = useState<LeadCapabilities | null>(
    null,
  );
  // The question ON SCREEN. In basic mode it is also the question on the wire;
  // in advanced mode it is a draft the user is still building, and only the
  // card's Search button promotes it. `lead-search-contract` owns every wire
  // name either mode may produce.
  const [search, setSearch] = useState<LeadSearchState>(EMPTY_LEAD_SEARCH);
  // The question ON THE WIRE. Split from the draft because a filter tree is
  // built one control at a time and every intermediate state is a different
  // query — usually an expensive one nobody asked for.
  const [appliedSearch, setAppliedSearch] = useState<LeadSearchState>(EMPTY_LEAD_SEARCH);
  const [page, setPage] = useState(1);
  const sortRef = useRef(DEFAULT_LEADS_SORT);
  const [sort, setSortState] = useState(DEFAULT_LEADS_SORT);
  // Mirrors `appliedSearch` for the async mutation handlers, which reload the
  // list long after the render that changed it.
  const searchRef = useRef<LeadSearchState>(EMPTY_LEAD_SEARCH);
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
   * The one exception is the mode switch itself. Arriving in advanced applies
   * once, so basic's filter stops answering the moment its controls leave the
   * screen — a list still narrowed by a filter nobody can see is worse than an
   * unfiltered one.
   *
   * Applying also starts the result set over: page 4 of a name search is not
   * page 4 of a status filter.
   */
  const changeSearch = useCallback(
    (next: LeadSearchState) => {
      setSearch(next);
      if (next.mode === "advanced" && searchRef.current.mode === "advanced") return;
      searchRef.current = next;
      setAppliedSearch(next);
      changePage(1);
    },
    [changePage],
  );

  /** Advanced mode's Search button: promote the draft, and run it. */
  const submitSearch = useCallback(() => {
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
      if (!branchId) {
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
          if (requestedSearch.mode === "advanced") {
            return axiosClient.post<unknown>(
              "/api/tenant/crm/v1/leads/search",
              buildLeadSearchRequest(requestedSearch, window),
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
          const query = buildLeadsListQuery({ ...window, search: requestedSearch });
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
            readPage(requestedPage),
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
    [appliedSearch, branchId, capabilityScope, changePage, page],
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
      return true;
    }

    if (outcome.kind === "failed") {
      setError(outcome.error.message || t.crmLeads.messages.createFailed);
      return false;
    }

    // `ambiguous` and `applied_unreadable` share this exit on purpose. Under
    // one the lead may exist and under the other it does exist; in both the
    // only wrong move is to leave the filled form open, because the next Save
    // is a fresh attempt with a fresh key and therefore a second lead. The
    // modal closes and the unfiltered first page is reloaded so the user can
    // see what landed.
    changeSearch(EMPTY_LEAD_SEARCH);
    const reloaded = await fetchLeads(undefined, 1, EMPTY_LEAD_SEARCH);
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
    } catch (caught) {
      const message = errorMessage(caught, t.crmLeads.messages.deleteFailed);
      if (isAmbiguousMutationError(caught)) {
        await fetchLeads(
          undefined,
          pageRef.current,
          searchRef.current,
        );
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
   * server's row or puts the old one back, and none of them leaves the new
   * value sitting on a card the server never accepted.
   *
   * Three outcomes, the same three crm-write.ts names:
   *   - a definite answer, parsed  -> adopt the server's row
   *   - a definite rejection (<500) -> revert, and say why
   *   - anything else               -> the write MAY have applied, so revert
   *     the guess and reload rather than assert either state
   *
   * One write per lead at a time. A second click during the round trip would
   * capture `previous` from an already-optimistic list, so a later failure
   * would "revert" to the value being written rather than the stored one.
   */
  const updateLeadCard = async (leadId: string, patch: LeadCardPatch) => {
    if (!branchId || cardWritesRef.current.has(leadId)) return;
    const previous = items.find(({ id }) => id === leadId);
    if (
      !previous ||
      !capabilityAllowsOwner(capabilities?.update ?? null, previous.ownerUserId)
    ) {
      setError(t.crmLeads.messages.cardNotPermitted);
      return;
    }

    const restore = (replacement: LeadItem) =>
      setItems((current) =>
        current.map((item) => (item.id === leadId ? replacement : item)),
      );

    cardWritesRef.current.add(leadId);
    setError(null);
    restore({ ...previous, ...patch });
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
        restore(previous);
        if (isAmbiguousWriteFailure(caught)) {
          await fetchLeads(undefined, pageRef.current, searchRef.current);
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
        restore(parseLeadResponse(response.data, branchId));
      } catch {
        await fetchLeads(undefined, pageRef.current, searchRef.current);
        setError(t.crmLeads.messages.cardUpdateAmbiguous);
      }
    } finally {
      cardWritesRef.current.delete(leadId);
    }
  };

  const moveLead = async (
    leadId: string,
    destinationStageId: string,
  ) => {
    if (movingLeadRef.current !== null) return;
    if (!branchId) {
      setError(t.crmLeads.messages.selectBranchToMove);
      return;
    }
    const lead = items.find(({ id }) => id === leadId);
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
    } catch (caught) {
      const message = errorMessage(caught, t.crmLeads.messages.moveFailed);
      if (isAmbiguousMutationError(caught)) {
        await fetchLeads(
          undefined,
          pageRef.current,
          searchRef.current,
        );
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
      changeSearch(EMPTY_LEAD_SEARCH);
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
  };
}
