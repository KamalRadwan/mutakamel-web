"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useTenantAuth } from "@/context/AuthContext";
import {
  SCOPE_UNRESOLVED_ERROR,
  useOrganizationScopeHeaders,
} from "@/hooks/useOrganizationScope";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { useI18n } from "@/i18n/I18nContext";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";
import {
  TenantApiClientError,
  axiosClient,
  type AxiosResponse,
} from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  appendOpportunityBasicQuery,
  DEFAULT_OPPORTUNITY_BASIC_SEARCH,
  EMPTY_OPPORTUNITY_BASIC_SEARCH,
  opportunityBasicSearchForCustomerParty,
  type OpportunityBasicSearch,
} from "../opportunity-basic-search-contract";
import {
  buildOpportunityCardPatchBody,
  parseOpportunityCardPatchResponse,
  type OpportunityCardPatch,
  type OpportunityCardState,
} from "../opportunity-card-contract";
import { parseOpportunityReadFields } from "../opportunity-read-model";
import type {
  OpportunityActionCapability,
  OpportunityActivityState,
  OpportunityBoard,
  OpportunityBoardLane,
  OpportunityCapabilities,
  OpportunityCardRecord,
  OpportunityImportance,
  OpportunityPipeline,
  OpportunityStage,
  OpportunityStatus,
  StageFlag,
} from "./pipeline-types";

const STAGE_FLAGS: StageFlag[] = [
  "NEW",
  "DISCOVERY",
  "QUALIFICATION",
  "PROPOSAL",
  "NEGOTIATION",
  "CONTRACTING",
  "ON_HOLD",
  "WON",
  "LOST",
];
const OPPORTUNITY_STATUSES: OpportunityStatus[] = [
  "IN_PROGRESS",
  "ON_HOLD",
  "WON",
  "LOST",
];
const ACTIVITY_STATES: OpportunityActivityState[] = [
  "NO_OPEN",
  "OVERDUE",
  "TODAY",
  "FUTURE",
];

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined
    ? null
    : typeof value === "string"
      ? value
      : null;
}

function nullableUuidV7(value: unknown, contract: string): string | null {
  if (value === null || value === undefined) return null;
  if (!isUUIDv7(value)) throw new Error(`Invalid ${contract} response.`);
  return value;
}

function requiredBoolean(
  value: Record<string, unknown>,
  key: string,
  contract: string,
): boolean {
  if (typeof value[key] !== "boolean") {
    throw new Error(`Invalid ${contract} response.`);
  }
  return value[key];
}

function requiredInteger(
  value: Record<string, unknown>,
  key: string,
  contract: string,
  minimum = 0,
): number {
  const candidate = value[key];
  if (!Number.isInteger(candidate) || (candidate as number) < minimum) {
    throw new Error(`Invalid ${contract} response.`);
  }
  return candidate as number;
}

function optionalInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : null;
}

function money(value: unknown, contract: string): string | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== "string" ||
    !/^-?\d{1,17}(?:\.\d{1,3})?$/.test(value)
  ) {
    throw new Error(`Invalid ${contract} response.`);
  }
  return value;
}

function aggregateMoney(value: unknown, contract: string): string {
  if (
    typeof value !== "string" ||
    !/^-?\d{1,32}(?:\.\d{1,3})?$/.test(value)
  ) {
    throw new Error(`Invalid ${contract} response.`);
  }
  return value;
}

function enumValue<T extends string>(
  value: unknown,
  options: readonly T[],
  contract: string,
): T {
  if (typeof value !== "string" || !options.includes(value as T)) {
    throw new Error(`Invalid ${contract} response.`);
  }
  return value as T;
}

function parseStage(value: unknown): OpportunityStage {
  const stage = record(value);
  if (!stage) throw new Error("Invalid pipelines response.");
  const flag = enumValue(stage.flag, STAGE_FLAGS, "pipelines");
  return {
    id: requiredUuidV7(stage, "id", "pipelines"),
    pipelineId: requiredUuidV7(stage, "pipelineId", "pipelines"),
    opportunityStageId: requiredUuidV7(
      stage,
      "opportunityStageId",
      "pipelines",
    ),
    nameAr: requiredString(stage, "nameAr", "pipelines"),
    nameEn: requiredString(stage, "nameEn", "pipelines"),
    flag,
    category: requiredString(stage, "category", "pipelines"),
    rank: requiredInteger(stage, "rank", "pipelines", 1),
    isActive: requiredBoolean(stage, "isActive", "pipelines"),
    isSystem: requiredBoolean(stage, "isSystem", "pipelines"),
  };
}

function parsePipeline(value: unknown): OpportunityPipeline {
  const pipeline = record(value);
  if (!pipeline || !Array.isArray(pipeline.stages)) {
    throw new Error("Invalid pipelines response.");
  }
  const stages = pipeline.stages
    .map(parseStage)
    .filter(({ isActive }) => isActive)
    .sort((left, right) => left.rank - right.rank);
  const id = requiredUuidV7(pipeline, "id", "pipelines");
  if (stages.some((stage) => stage.pipelineId !== id)) {
    throw new Error("Invalid pipelines response.");
  }
  return {
    id,
    code: requiredString(pipeline, "code", "pipelines"),
    nameAr: requiredString(pipeline, "nameAr", "pipelines"),
    nameEn: requiredString(pipeline, "nameEn", "pipelines"),
    isDefault: requiredBoolean(pipeline, "isDefault", "pipelines"),
    isActive: requiredBoolean(pipeline, "isActive", "pipelines"),
    stages,
  };
}

export function parsePipelinesResponse(payload: unknown): OpportunityPipeline[] {
  if (!Array.isArray(payload)) throw new Error("Invalid pipelines response.");
  const pipelines = payload
    .map(parsePipeline)
    .filter(({ isActive }) => isActive);
  if (new Set(pipelines.map(({ id }) => id)).size !== pipelines.length) {
    throw new Error("Invalid pipelines response.");
  }
  return pipelines;
}

function parseOpportunity(
  value: unknown,
  stage: OpportunityStage,
): OpportunityCardRecord {
  const item = record(value);
  if (!item) throw new Error("Invalid opportunity board response.");
  const stageFlag =
    item.stageFlag === null || item.stageFlag === undefined
      ? stage.flag
      : STAGE_FLAGS.includes(item.stageFlag as StageFlag) ? (item.stageFlag as StageFlag) : stage.flag;
  const importance = requiredInteger(
    item,
    "importance",
    "opportunity board",
  );
  if (importance > 3) throw new Error("Invalid opportunity board response.");
  const activityState = enumValue(
    item.activityState,
    ACTIVITY_STATES,
    "opportunity board",
  );
  let readFields;
  try {
    readFields = parseOpportunityReadFields(item);
  } catch {
    throw new Error("Invalid opportunity board response.");
  }
  return {
    ...readFields,
    id: requiredUuidV7(item, "id", "opportunity board"),
    branchId: requiredUuidV7(item, "branchId", "opportunity board"),
    customerProfileId: requiredUuidV7(
      item,
      "customerProfileId",
      "opportunity board",
    ),
    pipelineId: requiredUuidV7(item, "pipelineId", "opportunity board"),
    stageId: requiredUuidV7(item, "stageId", "opportunity board"),
    stageFlag,
    status: enumValue(
      item.status,
      OPPORTUNITY_STATUSES,
      "opportunity board",
    ),
    title: requiredString(item, "title", "opportunity board"),
    importance: importance as OpportunityImportance,
    amount: money(item.amount, "opportunity board"),
    currencyCode: nullableString(item.currencyCode),
    description: nullableString(item.description),
    probabilityPercent: optionalInteger(item.probabilityPercent, 0, 100),
    expectedCloseDate: nullableString(item.expectedCloseDate),
    ownerUserId: nullableUuidV7(item.ownerUserId, "opportunity board"),
    createdAt: requiredString(item, "createdAt", "opportunity board"),
    updatedAt: requiredString(item, "updatedAt", "opportunity board"),
    wonAt: nullableString(item.wonAt),
    lostAt: nullableString(item.lostAt),
    lostReason: nullableString(item.lostReason),
    activityState,
    contactDisplayName: optionalString(item.contactDisplayName),
  };
}

function parseAmounts(value: unknown): Record<string, string> {
  if (!Array.isArray(value)) {
    throw new Error("Invalid opportunity board response.");
  }
  const amounts: Record<string, string> = {};
  for (const raw of value) {
    const row = record(raw);
    if (!row) throw new Error("Invalid opportunity board response.");
    const currency = requiredString(
      row,
      "currencyCode",
      "opportunity board",
    );
    const amount = aggregateMoney(row.amount, "opportunity board");
    if (!/^[A-Z]{3}$/.test(currency) || currency in amounts) {
      throw new Error("Invalid opportunity board response.");
    }
    amounts[currency] = amount;
  }
  return amounts;
}

function parseLane(value: unknown): OpportunityBoardLane {
  const lane = record(value);
  const summary = lane && record(lane.summary);
  const activity = lane && record(lane.activitySummary);
  const pageInfo = lane && record(lane.pageInfo);
  if (
    !lane ||
    !summary ||
    !activity ||
    !pageInfo ||
    !Array.isArray(lane.items)
  ) {
    throw new Error("Invalid opportunity board response.");
  }
  const stage = parseStage(lane.stage);
  const items = lane.items.map((item) => parseOpportunity(item, stage));
  if (
    items.some(
      (item) =>
        item.stageId !== stage.id || item.pipelineId !== stage.pipelineId,
    )
  ) {
    throw new Error("Invalid opportunity board response.");
  }
  const nextCursor = nullableString(pageInfo.nextCursor);
  const limit = requiredInteger(pageInfo, "limit", "opportunity board", 1);
  const hasMore = requiredBoolean(pageInfo, "hasMore", "opportunity board");
  if (
    ![25, 50, 100].includes(limit) ||
    (pageInfo.nextCursor !== null &&
      (typeof pageInfo.nextCursor !== "string" ||
        pageInfo.nextCursor.length === 0 ||
        pageInfo.nextCursor.length > 1024 ||
        !/^[A-Za-z0-9_-]+$/.test(pageInfo.nextCursor))) ||
    hasMore !== (nextCursor !== null) ||
    new Set(items.map(({ id }) => id)).size !== items.length
  ) {
    throw new Error("Invalid opportunity board response.");
  }
  return {
    stage,
    items,
    summary: {
      totalCount: requiredInteger(
        summary,
        "totalCount",
        "opportunity board",
      ),
      amountsByCurrency: parseAmounts(summary.amountsByCurrency),
    },
    activitySummary: {
      totalCount: requiredInteger(
        activity,
        "totalCount",
        "opportunity board",
      ),
      noOpenCount: requiredInteger(
        activity,
        "noOpenCount",
        "opportunity board",
      ),
      overdueCount: requiredInteger(
        activity,
        "overdueCount",
        "opportunity board",
      ),
      todayCount: requiredInteger(
        activity,
        "todayCount",
        "opportunity board",
      ),
      futureCount: requiredInteger(
        activity,
        "futureCount",
        "opportunity board",
      ),
    },
    pageInfo: {
      limit,
      hasMore,
      nextCursor,
    },
  };
}

export function parseOpportunityStagePageResponse(
  payload: unknown,
  stage: OpportunityStage,
): OpportunityBoardLane {
  const page = record(payload);
  if (!page || page.stageId !== stage.id) {
    throw new Error("Invalid opportunity board response.");
  }
  return parseLane({ ...page, stage });
}

export function parseOpportunityBoardResponse(payload: unknown): OpportunityBoard {
  const data = record(payload);
  if (!data || !Array.isArray(data.stages)) {
    throw new Error("Invalid opportunity board response.");
  }
  const pipeline = parsePipeline(data.pipeline);
  const stages = data.stages.map(parseLane);
  const expectedIds = pipeline.stages.map(({ id }) => id);
  if (
    stages.length !== expectedIds.length ||
    stages.some(
      (lane, index) =>
        lane.stage.id !== expectedIds[index] ||
        lane.stage.pipelineId !== pipeline.id,
    )
  ) {
    throw new Error("Invalid opportunity board response.");
  }
  return {
    pipeline,
    stages: stages.map((lane, index) => ({
      ...lane,
      stage: pipeline.stages[index],
    })),
  };
}

function parseActionCapability(
  value: unknown,
): OpportunityActionCapability | null {
  if (value === null) return null;
  const capability = record(value);
  if (
    !capability ||
    !["own", "team", "all"].includes(String(capability.scope)) ||
    !(
      capability.ownerUserIds === null ||
      (Array.isArray(capability.ownerUserIds) &&
        capability.ownerUserIds.length > 0 &&
        capability.ownerUserIds.every(isUUIDv7) &&
        new Set(capability.ownerUserIds).size ===
          capability.ownerUserIds.length)
    ) ||
    (capability.scope === "all") !== (capability.ownerUserIds === null)
  ) {
    throw new Error("Invalid opportunity capabilities response.");
  }
  return {
    scope: capability.scope as OpportunityActionCapability["scope"],
    ownerUserIds: capability.ownerUserIds as string[] | null,
  };
}

export function parseOpportunityCapabilitiesResponse(
  payload: unknown,
  expectedBranchId: string,
): OpportunityCapabilities {
  const response = record(payload);
  const opportunities = response && record(response.opportunities);
  if (
    !response ||
    response.branchId !== expectedBranchId ||
    !opportunities
  ) {
    throw new Error("Invalid opportunity capabilities response.");
  }
  return {
    create: parseActionCapability(opportunities.create),
    update: parseActionCapability(opportunities.update),
    delete: parseActionCapability(opportunities.delete),
  };
}

export function opportunityCapabilityAllowsOwner(
  capability: OpportunityActionCapability | null,
  ownerUserId: string | null | undefined,
): boolean {
  return (
    capability !== null &&
    (capability.ownerUserIds === null ||
      (ownerUserId !== null &&
        ownerUserId !== undefined &&
        capability.ownerUserIds.includes(ownerUserId)))
  );
}

export interface OpportunityCardCandidate extends OpportunityCardState {
  id: string;
  ownerUserId?: string | null;
}

/**
 * Board rows are ordered by importance before their cursor is cut. A confirmed
 * importance write therefore needs a fresh server page; colour-only writes do
 * not affect ordering and can stay as the local field merge.
 */
export async function reconcileOpportunityBoardAfterConfirmedCardPatch(
  patch: OpportunityCardPatch,
  boardEnabled: boolean,
  selectedPipelineId: string | null,
  reloadBoard: (pipelineId: string) => Promise<boolean>,
): Promise<void> {
  if (
    patch.importance === undefined ||
    !boardEnabled ||
    !selectedPipelineId
  ) {
    return;
  }
  await reloadBoard(selectedPipelineId);
}

/** Gateway crm.assignable.owners.get; CRM applies the update owner scope. */
export async function readAssignableOpportunityOwners(
  branchId: string,
  signal: AbortSignal,
  headers: Record<string, string>,
): Promise<{ id: string; firstName: string; lastName: string }[]> {
  const owners: { id: string; firstName: string; lastName: string }[] = [];
  let cursor: string | null = null;
  for (;;) {
    const query = new URLSearchParams({ branchId, resource: "opportunities", action: "update", limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const response = await axiosClient.get<unknown>(`/api/tenant/crm/v1/assignable-owners?${query}`, {
      signal, headers, cache: "no-store", maxResponseBytes: 512 * 1024,
    });
    if (signal.aborted) throw new DOMException("Request aborted", "AbortError");
    const page = record(response.data);
    if (!page || !Array.isArray(page.items) || (page.nextCursor !== null && !isUUIDv7(page.nextCursor))) {
      throw new Error("Invalid assignable owners response.");
    }
    let previousId = cursor;
    for (const raw of page.items) {
      const owner = record(raw);
      if (!owner || !isUUIDv7(owner.id) || typeof owner.displayName !== "string" ||
        (owner.avatarUrl !== null && typeof owner.avatarUrl !== "string") ||
        (previousId !== null && owner.id <= previousId)) {
        throw new Error("Invalid assignable owner.");
      }
      previousId = owner.id;
      owners.push({ id: owner.id, firstName: owner.displayName, lastName: "" });
    }
    if (page.nextCursor === null) return owners;
    if (!page.items.length || page.nextCursor !== previousId) throw new Error("Invalid assignable owners cursor.");
    cursor = page.nextCursor as string;
  }
}

export function buildStageMoveRequest(
  stageId: string,
  targetFlag: StageFlag,
  terminalReason?: string,
) {
  const reason = terminalReason?.trim();
  return {
    stageId,
    ...(reason
      ? targetFlag === "LOST"
        ? { lostReason: reason }
        : { reason }
      : {}),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

// Capabilities decorate the board; they do not constitute it. A rejection or
// a payload that fails validation degrades to null so the board still
// renders, read-only.
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

function isAmbiguousMutationError(error: unknown): boolean {
  return (
    !(error instanceof TenantApiClientError) || error.response.status >= 500
  );
}

async function opportunityReachedStage(
  opportunityId: string,
  expectedStageId: string,
): Promise<boolean | null> {
  try {
    const response = await axiosClient.get<unknown>(
      `/api/tenant/crm/v1/opportunities/${encodeURIComponent(opportunityId)}`,
      { cache: "no-store", maxResponseBytes: 512 * 1024 },
    );
    const opportunity = record(response.data);
    if (!opportunity || opportunity.id !== opportunityId) return null;
    return opportunity.stageId === expectedStageId;
  } catch {
    return null;
  }
}

type StageMoveOpportunity = Pick<
  OpportunityCardRecord,
  "id" | "title" | "stageId" | "ownerUserId"
>;

interface ListTerminalMoveContext {
  opportunity: StageMoveOpportunity;
  reload: () => Promise<void>;
}

// Owns branch/pipeline selection and the board (the purpose-built
// GET /pipelines/:id/board projection) — see
// docs/design/views.md#opportunities-pipeline. Card and table views fetch
// from their own purpose-built/generic endpoints in sibling hooks
// (useOpportunityCards, useOpportunitiesList) but read branchId/pipelineId
// from here, so the pipeline selector stays a single shared control.
export function usePipelineWorkspace(boardEnabled = true, summariesEnabled = false) {
  const { lang, t } = useI18n();
  const describeError = useCrmErrorText();
  const errorMessage = useCallback(
    (caught: unknown, fallback: string): string =>
      caught instanceof TenantApiClientError
        ? describeError(normalizeApiError(caught)) ?? fallback
        : fallback,
    [describeError],
  );
  const { user } = useTenantAuth();
  const { canMutate } = useAccessMode();
  const actorUserId = user?.id;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialPartyId =
    searchParams?.get("partyId")?.trim() ||
    searchParams?.get("search")?.trim() ||
    "";
  const [pipelines, setPipelines] = useState<OpportunityPipeline[]>([]);
  const [capabilities, setCapabilities] =
    useState<OpportunityCapabilities | null>(null);
  const [selectedPipelineId, setSelectedPipelineIdState] = useState<string | null>(
    () => {
      const fromUrl = searchParams.get("pipelineId");
      return isUUIDv7(fromUrl) ? fromUrl : null;
    },
  );
  const [board, setBoard] = useState<OpportunityBoard | null>(null);
  const [boardResponseKey, setBoardResponseKey] = useState<string | null>(null);
  const [basicSearch, setBasicSearch] = useState<OpportunityBasicSearch>(() =>
    initialPartyId
      ? opportunityBasicSearchForCustomerParty(initialPartyId)
      : isUUIDv7(actorUserId)
        ? DEFAULT_OPPORTUNITY_BASIC_SEARCH
        : EMPTY_OPPORTUNITY_BASIC_SEARCH,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [loadingStageId, setLoadingStageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The pipeline/board fetch's own failure, kept apart from `error` (write
  // feedback) so the board pane can render one state instead of a banner
  // stacked over an empty pane.
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [capabilitiesUnavailable, setCapabilitiesUnavailable] = useState(false);
  // Distinguishes "not asked yet" from "asked, and this tenant has none" —
  // without it the unconfigured-tenant empty state flashes on first paint.
  const [hasLoadedPipelines, setHasLoadedPipelines] = useState(false);
  const [pipelinesRevision, setPipelinesRevision] = useState(0);
  const mutationInFlightRef = useRef(false);
  const loadMoreInFlightRef = useRef(false);
  const boardRequestEpochRef = useRef(0);
  const [terminalMove, setTerminalMove] = useState<{
    cardId: string;
    destStageId: string;
    targetFlag: StageFlag;
    opportunity: StageMoveOpportunity | null;
    listMove?: ListTerminalMoveContext;
  } | null>(null);

  const [reopenMove, setReopenMove] = useState<{
    cardId: string;
    destStageId: string;
    targetFlag: StageFlag;
    opportunity: StageMoveOpportunity;
    listMove?: ListTerminalMoveContext;
  } | null>(null);
  const capabilitiesRequestEpoch = useRef(0);

  const { branchIds, branchId, selectBranch } =
    useTenantBranchSelection(user);
  // `crm.opportunities.capabilities.get` is BRANCH_REQUIRED in the Gateway
  // route contract, so it needs the two scope headers as well as the branchId
  // query parameter. Without them the Gateway answers 400 GW.REQUEST.INVALID
  // before crm-app sees the request — validateOrganizationScope() in
  // api-gateway-app/src/common/middleware/route-context.middleware.ts — and
  // every capability-gated control degraded for a reason unrelated to
  // permissions (D11 / MASTER-PLAN 8.5).
  const capabilityScope = useOrganizationScopeHeaders(
    "BRANCH_REQUIRED",
    branchId,
  );

  const refreshCapabilities = useCallback(async () => {
    const epoch = ++capabilitiesRequestEpoch.current;
    setCapabilities(null);
    if (!branchId || !capabilityScope.ready) return;
    try {
      const response = await axiosClient.get<unknown>(
        `/api/tenant/crm/v1/opportunities/capabilities?branchId=${encodeURIComponent(branchId)}`,
        { headers: capabilityScope.headers, cache: "no-store", maxResponseBytes: 128 * 1024 },
      );
      const next = parseOpportunityCapabilitiesResponse(response.data, branchId);
      if (epoch !== capabilitiesRequestEpoch.current) return;
      setCapabilities(next);
      setCapabilitiesUnavailable(false);
    } catch {
      if (epoch === capabilitiesRequestEpoch.current) setCapabilitiesUnavailable(true);
    }
  }, [branchId, capabilityScope]);

  useEffect(() => {
    const onFocus = () => { void refreshCapabilities(); };
    window.addEventListener("focus", onFocus);
    return () => {
      capabilitiesRequestEpoch.current += 1;
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshCapabilities]);

  // The funnel describes all stages under the current basic filters, regardless
  // of the selected stage or list page. Board summaries count beyond lane pages.
  const boardQuery = useMemo(() => {
    const query = new URLSearchParams({ branchId: branchId ?? "", limitPerStage: "50" });
    appendOpportunityBasicQuery(query, basicSearch, actorUserId, {
      includePipeline: false,
      includeStage: false,
    });
    return query.toString();
  }, [actorUserId, basicSearch, branchId]);

  const setSelectedPipelineId = useCallback(
    (nextPipelineId: string | null) => {
      setSelectedPipelineIdState(nextPipelineId);
      const params = new URLSearchParams(searchParams.toString());
      if (nextPipelineId) params.set("pipelineId", nextPipelineId);
      else params.delete("pipelineId");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const fetchPipelines = useCallback(
    async (signal?: AbortSignal) => {
      if (!branchId) {
        boardRequestEpochRef.current += 1;
        setPipelines([]);
        setCapabilities(null);
        setSelectedPipelineIdState(null);
        setBoard(null);
        setIsLoading(false);
        // Nothing was asked — the CRM board route is a 422 without a branch.
        // The screen renders the "pick a branch" empty state instead.
        setLoadError(null);
        setCapabilitiesUnavailable(false);
        setHasLoadedPipelines(false);
        return;
      }
      boardRequestEpochRef.current += 1;
      const capabilityEpoch = ++capabilitiesRequestEpoch.current;
      setCapabilities(null);
      setIsLoading(true);
      setError(null);
      setLoadError(null);
      setCapabilitiesUnavailable(false);
      try {
        // Two independent sources. Under Promise.all a capabilities 403 also
        // nulled the pipeline list, so a permission gap on ACTIONS looked
        // identical to having no pipelines at all.
        const [pipelinesSettled, capabilitiesSettled] = await Promise.allSettled([
          axiosClient.get<unknown>("/api/tenant/crm/v1/pipelines", {
            signal,
            cache: "no-store",
            maxResponseBytes: 512 * 1024,
          }),
          // D4: with no resolved scope the request is not sent at all. A
          // rejected source is already how this batch says "capabilities
          // unknown", and it degrades the action controls honestly instead of
          // firing an unscoped request the Gateway answers 400 to.
          capabilityScope.ready
            ? axiosClient.get<unknown>(
                `/api/tenant/crm/v1/opportunities/capabilities?branchId=${encodeURIComponent(branchId)}`,
                {
                  signal,
                  cache: "no-store",
                  maxResponseBytes: 128 * 1024,
                  headers: capabilityScope.headers,
                },
              )
            : Promise.reject(new Error(SCOPE_UNRESOLVED_ERROR.code)),
        ]);

        if (
          signal?.aborted ||
          [pipelinesSettled, capabilitiesSettled].some(
            (settled) =>
              settled.status === "rejected" && isAbortError(settled.reason),
          )
        ) {
          return;
        }

        const nextCapabilities = degradableSource(capabilitiesSettled, (payload) =>
          parseOpportunityCapabilitiesResponse(payload, branchId),
        );
        if (capabilityEpoch === capabilitiesRequestEpoch.current) {
          setCapabilities(nextCapabilities);
          setCapabilitiesUnavailable(nextCapabilities === null);
        }

        if (pipelinesSettled.status === "rejected") throw pipelinesSettled.reason;
        const available = parsePipelinesResponse(pipelinesSettled.value.data);
        setHasLoadedPipelines(true);
        if (available.length === 0) {
          // An empty accessible set does not prove the tenant has no pipelines.
          setPipelines([]);
          setSelectedPipelineIdState(null);
          setBoard(null);
          return;
        }
        setPipelines(available);
        setSelectedPipelineIdState((current) =>
          current && available.some(({ id }) => id === current)
            ? current
            : (available.find(({ isDefault }) => isDefault) ?? available[0]).id,
        );
        setPipelinesRevision((current) => current + 1);
      } catch (caught) {
        if (isAbortError(caught)) return;
        setPipelines([]);
        setCapabilities(null);
        setSelectedPipelineIdState(null);
        setBoard(null);
        setHasLoadedPipelines(false);
        if (normalizeApiError(caught).status === 403) void refreshCapabilities();
        setLoadError(normalizeApiError(caught));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [branchId, capabilityScope, refreshCapabilities],
  );

  const fetchBoardData = useCallback(
    async (pipelineId: string, signal?: AbortSignal): Promise<boolean> => {
      if (!branchId) return false;
      const requestEpoch = boardRequestEpochRef.current + 1;
      boardRequestEpochRef.current = requestEpoch;
      setIsLoading(true);
      setError(null);
      setLoadError(null);
      setBoard(null);
      try {
        const response = await axiosClient.get<unknown>(
          `/api/tenant/crm/v1/pipelines/${encodeURIComponent(pipelineId)}/board?${boardQuery}`,
          {
            signal,
            cache: "no-store",
            maxResponseBytes: 2 * 1024 * 1024,
          },
        );
        const nextBoard = parseOpportunityBoardResponse(response.data);
        if (
          nextBoard.pipeline.id !== pipelineId ||
          nextBoard.stages.some((lane) =>
            lane.items.some((item) => item.branchId !== branchId),
          )
        ) {
          throw new Error("Invalid opportunity board response.");
        }
        if (signal?.aborted || requestEpoch !== boardRequestEpochRef.current) return false;
        setBoard(nextBoard);
        setBoardResponseKey(`${pipelineId}?${boardQuery}`);
        return true;
      } catch (caught) {
        if (
          isAbortError(caught) ||
          requestEpoch !== boardRequestEpochRef.current
        ) {
          return false;
        }
        if (normalizeApiError(caught).status === 403) void refreshCapabilities();
        setLoadError(normalizeApiError(caught));
        return false;
      } finally {
        if (
          !signal?.aborted &&
          requestEpoch === boardRequestEpochRef.current
        ) {
          setIsLoading(false);
        }
      }
    },
    [boardQuery, branchId, refreshCapabilities],
  );

  const loadMoreStage = useCallback(
    async (stageId: string): Promise<void> => {
      if (
        !branchId ||
        !selectedPipelineId ||
        loadingStageId ||
        mutationInFlightRef.current ||
        loadMoreInFlightRef.current
      ) {
        return;
      }
      const lane = board?.stages.find(({ stage }) => stage.id === stageId);
      const cursor = lane?.pageInfo.nextCursor;
      if (!lane || !lane.pageInfo.hasMore || !cursor) return;

      const boardEpoch = boardRequestEpochRef.current;
      loadMoreInFlightRef.current = true;
      setLoadingStageId(stageId);
      setError(null);
      try {
        const query = new URLSearchParams({
          branchId,
          limit: String(lane.pageInfo.limit),
          cursor,
        });
        appendOpportunityBasicQuery(query, basicSearch, actorUserId, {
          includePipeline: false,
          includeStage: false,
        });
        const response = await axiosClient.get<unknown>(
          `/api/tenant/crm/v1/pipelines/${encodeURIComponent(selectedPipelineId)}/stages/${encodeURIComponent(stageId)}/opportunities?${query.toString()}`,
          {
            cache: "no-store",
            maxResponseBytes: 2 * 1024 * 1024,
          },
        );
        const nextLane = parseOpportunityStagePageResponse(
          response.data,
          lane.stage,
        );
        if (nextLane.items.some((item) => item.branchId !== branchId)) {
          throw new Error("Invalid opportunity board response.");
        }
        if (boardEpoch !== boardRequestEpochRef.current) return;
        const existingIds = new Set(lane.items.map(({ id }) => id));
        if (nextLane.items.some(({ id }) => existingIds.has(id))) {
          throw new Error("Invalid opportunity board response.");
        }
        setBoard((current) => {
          if (!current || current.pipeline.id !== selectedPipelineId) {
            return current;
          }
          return {
            ...current,
            stages: current.stages.map((currentLane) => {
              if (
                currentLane.stage.id !== stageId ||
                currentLane.pageInfo.nextCursor !== cursor
              ) {
                return currentLane;
              }
              const currentIds = new Set(
                currentLane.items.map(({ id }) => id),
              );
              if (nextLane.items.some(({ id }) => currentIds.has(id))) {
                return currentLane;
              }
              return {
                ...nextLane,
                items: [...currentLane.items, ...nextLane.items],
              };
            }),
          };
        });
      } catch (caught) {
        if (normalizeApiError(caught).status === 403) void refreshCapabilities();
        setError(
          errorMessage(caught, t.crmOpportunities.stageLoadFailed),
        );
      } finally {
        loadMoreInFlightRef.current = false;
        setLoadingStageId(null);
      }
    },
    [actorUserId, basicSearch, board, branchId, loadingStageId, selectedPipelineId, refreshCapabilities, errorMessage, t.crmOpportunities.stageLoadFailed],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void fetchPipelines(controller.signal);
    });
    return () => controller.abort();
  }, [fetchPipelines]);

  useEffect(() => {
    if (!(boardEnabled || summariesEnabled) || !hasLoadedPipelines || !selectedPipelineId) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        void fetchBoardData(selectedPipelineId, controller.signal);
      }
    });
    return () => controller.abort();
  }, [boardEnabled, summariesEnabled, fetchBoardData, hasLoadedPipelines, pipelinesRevision, selectedPipelineId]);

  const canUpdateOpportunity = useCallback(
    (opportunity: Pick<OpportunityCardRecord, "ownerUserId">) =>
      canMutate && opportunityCapabilityAllowsOwner(
        capabilities?.update ?? null,
        opportunity.ownerUserId,
      ),
    [canMutate, capabilities?.update],
  );

  const canDeleteOpportunity = useCallback(
    (opportunity: OpportunityCardRecord) =>
      canMutate && opportunityCapabilityAllowsOwner(
        capabilities?.delete ?? null,
        opportunity.ownerUserId,
      ),
    [canMutate, capabilities?.delete],
  );

  const performMove = useCallback(
    async (
      cardId: string,
      destStageId: string,
      targetFlag: StageFlag,
      terminalReason?: string,
      listMove?: ListTerminalMoveContext,
    ): Promise<boolean> => {
      const opportunity =
        listMove?.opportunity ??
        board?.stages
          .flatMap(({ items }) => items)
          .find(({ id }) => id === cardId);
      if (
        !selectedPipelineId ||
        !pipelines.find(({ id }) => id === selectedPipelineId)?.stages.some(({ id }) => id === destStageId) ||
        !opportunity ||
        !canUpdateOpportunity(opportunity) ||
        mutationInFlightRef.current ||
        loadMoreInFlightRef.current
      ) {
        return false;
      }
      mutationInFlightRef.current = true;
      setIsMutating(true);
      setError(null);
      const refresh = async (): Promise<boolean> => {
        if (listMove) {
          await listMove.reload();
          if (summariesEnabled) await fetchBoardData(selectedPipelineId);
          return true;
        }
        return fetchBoardData(selectedPipelineId);
      };
      try {
        await axiosClient.post(
          `/api/tenant/crm/v1/opportunities/${encodeURIComponent(cardId)}/stage`,
          buildStageMoveRequest(destStageId, targetFlag, terminalReason),
          {
            nonReplayable: true,
            skipAutoIdempotency: true,
            cache: "no-store",
            maxResponseBytes: 512 * 1024,
          },
        );
        return await refresh();
      } catch (caught) {
        if (normalizeApiError(caught).status === 403) void refreshCapabilities();
        const message = errorMessage(
          caught,
          t.crmOpportunities.moveFailed,
        );
        if (isAmbiguousMutationError(caught)) {
          const committed = await opportunityReachedStage(cardId, destStageId);
          await refresh();
          if (committed === true) return true;
          if (committed === null) {
            setReopenMove(null);
            setTerminalMove((current) =>
              current?.cardId === cardId ? null : current,
            );
            setError(
              listMove
                ? t.crmOpportunities.stageMoveUncertain
                : t.crmOpportunities.boardStageMoveUncertain,
            );
            return false;
          }
        }
        setError(message);
        return false;
      } finally {
        mutationInFlightRef.current = false;
        setIsMutating(false);
      }
    },
    [
      board,
      canUpdateOpportunity,
      fetchBoardData,
      refreshCapabilities,
      selectedPipelineId,
      pipelines,
      summariesEnabled,
      errorMessage,
      t.crmOpportunities.moveFailed,
      t.crmOpportunities.boardStageMoveUncertain,
      t.crmOpportunities.stageMoveUncertain,
    ],
  );

  const requestListStageMove = useCallback(
    (
      opportunity: StageMoveOpportunity,
      destStageId: string,
      reload: () => Promise<void>,
    ) => {
      const stage = pipelines
        .find(({ id }) => id === selectedPipelineId)
        ?.stages.find(({ id }) => id === destStageId);
      if (
        !stage ||
        opportunity.stageId === destStageId ||
        !canUpdateOpportunity(opportunity) ||
        mutationInFlightRef.current ||
        loadMoreInFlightRef.current
      ) {
        return;
      }
      setError(null);
      if (stage.flag !== "WON" && stage.flag !== "LOST") {
        const source = pipelines.find(({ id }) => id === selectedPipelineId)?.stages.find(({ id }) => id === opportunity.stageId);
        if (source?.flag !== "WON" && source?.flag !== "LOST") return;
        setReopenMove({ cardId: opportunity.id, destStageId, targetFlag: stage.flag, opportunity, listMove: { opportunity, reload } });
        return;
      }
      setTerminalMove({
        cardId: opportunity.id,
        destStageId,
        targetFlag: stage.flag,
        opportunity,
        listMove: { opportunity, reload },
      });
    },
    [canUpdateOpportunity, pipelines, selectedPipelineId],
  );

  const moveCard = useCallback(
    (
      cardId: string,
      sourceStageId: string,
      destStageId: string,
    ) => {
      if (
        !board ||
        mutationInFlightRef.current ||
        loadMoreInFlightRef.current
      ) {
        return;
      }
      const destLane = board.stages.find(({ stage }) => stage.id === destStageId);
      if (!destLane) return;
      const sourceLane = board.stages.find(
        ({ stage }) => stage.id === sourceStageId,
      );
      const opportunity = sourceLane?.items.find(({ id }) => id === cardId);
      if (!opportunity || sourceStageId === destStageId || !canUpdateOpportunity(opportunity)) return;
      const targetFlag = destLane.stage.flag;
      if (targetFlag === "WON" || targetFlag === "LOST") {
        setError(null);
        setTerminalMove({
          cardId,
          destStageId,
          targetFlag,
          opportunity,
        });
        return;
      }
      if (sourceLane?.stage.flag === "WON" || sourceLane?.stage.flag === "LOST") {
        setError(null);
        setReopenMove({ cardId, destStageId, targetFlag, opportunity });
        return;
      }
      void performMove(cardId, destStageId, targetFlag);
    },
    [board, canUpdateOpportunity, performMove],
  );

  const confirmReopenMove = useCallback(async () => {
    if (!reopenMove) return false;
    const moved = await performMove(reopenMove.cardId, reopenMove.destStageId, reopenMove.targetFlag, undefined, reopenMove.listMove);
    if (moved) setReopenMove(null);
    return moved;
  }, [performMove, reopenMove]);
  const cancelReopenMove = useCallback(() => {
    if (!isMutating) setReopenMove(null);
  }, [isMutating]);

  const confirmTerminalMove = useCallback(
    async (reason: string): Promise<boolean> => {
      if (!terminalMove) return false;
      const moved = await performMove(
        terminalMove.cardId,
        terminalMove.destStageId,
        terminalMove.targetFlag,
        reason,
        terminalMove.listMove,
      );
      if (moved) setTerminalMove(null);
      return moved;
    },
    [performMove, terminalMove],
  );

  const cancelTerminalMove = useCallback(() => {
    if (!isMutating) setTerminalMove(null);
  }, [isMutating]);

  const updateCard = useCallback(
    async (
      cardId: string,
      requestedPatch: OpportunityCardPatch,
      candidate?: OpportunityCardCandidate,
    ): Promise<boolean> => {
      if (mutationInFlightRef.current || loadMoreInFlightRef.current) return false;
      const opportunity = candidate ?? board?.stages
        .flatMap(({ items }) => items)
        .find(({ id }) => id === cardId);
      if (
        !opportunity ||
        !canUpdateOpportunity(opportunity)
      ) {
        return false;
      }

      const patch: OpportunityCardPatch = {
        ...(requestedPatch.importance !== undefined &&
        requestedPatch.importance !== opportunity.importance
          ? { importance: requestedPatch.importance }
          : {}),
        ...(requestedPatch.cardColor !== undefined &&
        requestedPatch.cardColor !== opportunity.cardColor
          ? { cardColor: requestedPatch.cardColor }
          : {}),
      };
      let body: Record<string, unknown>;
      try {
        body = buildOpportunityCardPatchBody(patch);
      } catch {
        return false;
      }
      if (Object.keys(body).length === 0) return false;

      const previous: OpportunityCardState = {
        importance: opportunity.importance,
        cardColor: opportunity.cardColor,
      };
      const applyCardFields = (fields: OpportunityCardPatch) =>
        setBoard((current) =>
          current
            ? {
                ...current,
                stages: current.stages.map((lane) => ({
                  ...lane,
                  items: lane.items.map((item) =>
                    item.id === cardId
                      ? {
                          ...item,
                          ...(fields.importance !== undefined
                            ? { importance: fields.importance as OpportunityImportance }
                            : {}),
                          ...(fields.cardColor !== undefined
                            ? { cardColor: fields.cardColor }
                            : {}),
                        }
                      : item,
                  ),
                })),
              }
            : current,
        );

      mutationInFlightRef.current = true;
      setIsMutating(true);
      setError(null);
      applyCardFields(patch);
      try {
        let response: AxiosResponse<unknown>;
        try {
          response = await axiosClient.patch<unknown>(
            `/api/tenant/crm/v1/opportunities/${encodeURIComponent(cardId)}`,
            body,
            {
              nonReplayable: true,
              skipAutoIdempotency: true,
              cache: "no-store",
              maxResponseBytes: 512 * 1024,
            },
          );
        } catch (caught) {
          if (normalizeApiError(caught).status === 403) void refreshCapabilities();
          applyCardFields({
            ...(patch.importance !== undefined ? { importance: previous.importance } : {}),
            ...(patch.cardColor !== undefined ? { cardColor: previous.cardColor } : {}),
          });
          if (isAmbiguousMutationError(caught)) {
            if (boardEnabled && selectedPipelineId) {
              await fetchBoardData(selectedPipelineId);
            }
            setError(t.crmOpportunities.cardUpdateAmbiguous);
            // Card and Table callers use `true` as the signal to reconcile
            // their independent data source. The request may have applied.
            return true;
          }
          setError(errorMessage(caught, t.crmOpportunities.cardUpdateFailed));
          return false;
        }

        try {
          const confirmed = parseOpportunityCardPatchResponse(
            response.data,
            cardId,
            previous,
            patch,
          );
          applyCardFields({
            ...(patch.importance !== undefined ? { importance: confirmed.importance } : {}),
            ...(patch.cardColor !== undefined ? { cardColor: confirmed.cardColor } : {}),
          });
          await reconcileOpportunityBoardAfterConfirmedCardPatch(
            patch,
            boardEnabled,
            selectedPipelineId,
            fetchBoardData,
          );
          return true;
        } catch {
          if (boardEnabled && selectedPipelineId) {
            await fetchBoardData(selectedPipelineId);
          }
          setError(t.crmOpportunities.cardUpdateAmbiguous);
          // A 2xx write applied. Card and Table callers reconcile their own
          // source even though this client could not verify the receipt.
          return true;
        }
      } finally {
        mutationInFlightRef.current = false;
        setIsMutating(false);
      }
    },
    [
      board,
      boardEnabled,
      canUpdateOpportunity,
      fetchBoardData,
      refreshCapabilities,
      selectedPipelineId,
      t.crmOpportunities.cardUpdateAmbiguous,
      t.crmOpportunities.cardUpdateFailed,
      errorMessage,
    ],
  );

  const updateImportance = useCallback(
    (
      cardId: string,
      newImportance: number,
      candidate?: OpportunityCardCandidate,
    ) => updateCard(cardId, { importance: newImportance }, candidate),
    [updateCard],
  );

  return {
    actorUserId,
    initialPartyId,
    lang,
    t,
    board,
    funnelLanes: !isLoading && !loadError &&
      boardResponseKey === `${selectedPipelineId}?${boardQuery}`
      ? board?.stages
      : undefined,
    pipelines,
    capabilities: canMutate ? capabilities : null,
    refreshCapabilities,
    reopenMove,
    confirmReopenMove,
    cancelReopenMove,
    branchIds,
    branchId,
    selectBranch: (nextBranchId: string) => {
      boardRequestEpochRef.current += 1;
      selectBranch(nextBranchId);
      setPipelines([]);
      setCapabilities(null);
      setSelectedPipelineId(null);
      setBoard(null);
      setTerminalMove(null);
      setReopenMove(null);
      setError(null);
      setLoadError(null);
      setCapabilitiesUnavailable(false);
      setHasLoadedPipelines(false);
    },
    selectedPipelineId,
    setSelectedPipelineId,
    isLoading,
    isMutating,
    loadingStageId,
    error,
    loadError,
    capabilitiesUnavailable,
    // The server returned no accessible pipelines.
    hasNoPipelines: hasLoadedPipelines && !isLoading && pipelines.length === 0,
    needsBranchSelection: branchId === null,
    fetchPipelines,
    fetchBoardData,
    setBasicSearch,
    loadMoreStage,
    canUpdateOpportunity,
    canDeleteOpportunity,
    moveCard,
    requestListStageMove,
    terminalMove,
    confirmTerminalMove,
    cancelTerminalMove,
    updateCard,
    updateImportance,
  };
}
