"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useOrganizationScopeHeaders } from "@/hooks/useOrganizationScope";
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

export interface CreateLeadFormData {
  contactName: string;
  companyName: string;
  email: string;
  phone: string;
  stageId?: string;
  /**
   * An organization Party already in the tenant Directory — MASTER-PLAN 8.4.
   *
   * `CreateLeadDto.existingCompanyPartyId` is deliberately narrower than a
   * generic `partyId`: the service revalidates that the party is an ACTIVE
   * ORGANIZATION inside the lead's branch, and rejects anything else with
   * `LEAD_EXISTING_COMPANY_INVALID` / `LEAD_EXISTING_COMPANY_OUTSIDE_BRANCH`.
   */
  existingCompanyPartyId?: string;
  /** An existing contact person on that party — `contacts[].contactPartyId`. */
  contactPartyId?: string;
}

export function buildCreateLeadRequest(
  form: CreateLeadFormData,
  branchId: string,
) {
  const contact = {
    fullName: form.contactName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    isPrimary: true,
    ...(form.contactPartyId ? { contactPartyId: form.contactPartyId } : {}),
  };
  return {
    branchId,
    leadProfileType: "CORPORATE" as const,
    displayName: form.companyName.trim(),
    companyName: form.companyName.trim(),
    companyPhone: form.phone.trim(),
    contacts: [contact],
    ...(form.stageId ? { stageId: form.stageId } : {}),
    ...(form.existingCompanyPartyId
      ? { existingCompanyPartyId: form.existingCompanyPartyId }
      : {}),
  };
}

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

export function useLeads() {
  const { t } = useI18n();
  const { user } = useTenantAuth();
  const [activeView, setActiveView] = useState<LeadsView>("board");
  const [items, setItems] = useState<LeadItem[]>([]);
  const [stages, setStages] = useState<LeadStage[]>([]);
  const [capabilities, setCapabilities] = useState<LeadCapabilities | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const searchQueryRef = useRef("");
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
  const capabilityScopeHeaders = useOrganizationScopeHeaders(
    "BRANCH_REQUIRED",
    branchId,
  );

  const changePage = useCallback((nextPage: number) => {
    pageRef.current = nextPage;
    setPage(nextPage);
  }, []);

  const changeSearchQuery = useCallback(
    (value: string) => {
      searchQueryRef.current = value;
      setSearchQuery(value);
      changePage(1);
    },
    [changePage],
  );

  const fetchLeads = useCallback(
    async (
      signal?: AbortSignal,
      requestedPage = page,
      requestedSearch = searchQuery,
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
          const query = new URLSearchParams({
            branchId,
            page: String(requestedPageNumber),
            limit: "50",
          });
          const search = requestedSearch.trim();
          if (search) query.set("search", search);
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
            axiosClient.get<unknown>(
              `/api/tenant/crm/v1/leads/capabilities?branchId=${encodeURIComponent(branchId)}`,
              {
                signal,
                cache: "no-store",
                maxResponseBytes: 256 * 1024,
                headers: capabilityScopeHeaders,
              },
            ),
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
    [branchId, capabilityScopeHeaders, changePage, page, searchQuery],
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

  const handleCreate = async (form: CreateLeadFormData): Promise<boolean> => {
    if (!branchId) {
      setError(t.crmLeads.messages.selectBranchToCreate);
      return false;
    }
    if (!capabilities?.create) {
      setError(t.crmLeads.messages.createNotPermitted);
      return false;
    }

    setError(null);
    try {
      const response = await axiosClient.post<unknown>(
        "/api/tenant/crm/v1/leads",
        buildCreateLeadRequest(form, branchId),
        {
          nonReplayable: true,
          skipAutoIdempotency: true,
          cache: "no-store",
          maxResponseBytes: 256 * 1024,
        },
      );
      parseLeadResponse(response.data, branchId);
      setIsCreateOpen(false);
      changePage(1);
      await fetchLeads(undefined, 1, searchQueryRef.current);
      return true;
    } catch (caught) {
      const message = errorMessage(caught, t.crmLeads.messages.createFailed);
      if (isAmbiguousMutationError(caught)) {
        changeSearchQuery("");
        const reloaded = await fetchLeads(undefined, 1, "");
        setIsCreateOpen(false);
        setError(
          reloaded
            ? t.crmLeads.messages.createAmbiguousRefreshed
            : t.crmLeads.messages.createAmbiguousStale,
        );
      } else {
        setError(message);
      }
      return false;
    }
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
          searchQueryRef.current,
        );
        setSelectedForDelete(null);
      }
      setError(message);
    } finally {
      setIsDeleting(false);
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
        searchQueryRef.current,
      );
    } catch (caught) {
      const message = errorMessage(caught, t.crmLeads.messages.moveFailed);
      if (isAmbiguousMutationError(caught)) {
        await fetchLeads(
          undefined,
          pageRef.current,
          searchQueryRef.current,
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
      changeSearchQuery("");
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
    searchQuery,
    setSearchQuery: changeSearchQuery,
    pageInfo,
    setPage: changePage,
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
    fetchLeads,
  };
}
