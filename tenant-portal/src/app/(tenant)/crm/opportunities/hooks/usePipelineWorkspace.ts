"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTenantAuth } from "@/context/AuthContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { useI18n } from "@/i18n/I18nContext";
import { TenantApiClientError, axiosClient } from "@/lib/api/axiosClient";
import { isUUIDv7 } from "@/lib/uuid";
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
    !/^-?\d{1,16}(?:\.\d{1,2})?$/.test(value)
  ) {
    throw new Error(`Invalid ${contract} response.`);
  }
  return value;
}

function aggregateMoney(value: unknown, contract: string): string {
  if (
    typeof value !== "string" ||
    !/^-?\d{1,32}(?:\.\d{1,2})?$/.test(value)
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
      : enumValue(item.stageFlag, STAGE_FLAGS, "opportunity board");
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
  return {
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
    nextOpenActivityAt: nullableString(item.nextOpenActivityAt),
    activityState,
    customerDisplayName: optionalString(item.customerDisplayName),
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

// Owns branch/pipeline selection and the board (the purpose-built
// GET /pipelines/:id/board projection) — see
// docs/design/views.md#opportunities-pipeline. Card and table views fetch
// from their own purpose-built/generic endpoints in sibling hooks
// (useOpportunityCards, useOpportunitiesList) but read branchId/pipelineId
// from here, so the pipeline selector stays a single shared control.
export function usePipelineWorkspace() {
  const { lang, t } = useI18n();
  const { user } = useTenantAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [loadingStageId, setLoadingStageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mutationInFlightRef = useRef(false);
  const loadMoreInFlightRef = useRef(false);
  const boardRequestEpochRef = useRef(0);
  const [terminalMove, setTerminalMove] = useState<{
    cardId: string;
    destStageId: string;
    targetFlag: StageFlag;
    opportunity: OpportunityCardRecord | null;
  } | null>(null);

  const { branchIds, branchId, selectBranch } =
    useTenantBranchSelection(user);

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
        setError("Select one accessible branch before loading opportunities.");
        return;
      }
      boardRequestEpochRef.current += 1;
      setIsLoading(true);
      setError(null);
      setBoard(null);
      try {
        const [response, capabilitiesResponse] = await Promise.all([
          axiosClient.get<unknown>("/api/tenant/crm/v1/pipelines", {
            signal,
            cache: "no-store",
            maxResponseBytes: 512 * 1024,
          }),
          axiosClient.get<unknown>(
            `/api/tenant/crm/v1/opportunities/capabilities?branchId=${encodeURIComponent(branchId)}`,
            {
              signal,
              cache: "no-store",
              maxResponseBytes: 128 * 1024,
            },
          ),
        ]);
        const available = parsePipelinesResponse(response.data);
        const nextCapabilities = parseOpportunityCapabilitiesResponse(
          capabilitiesResponse.data,
          branchId,
        );
        if (available.length === 0) {
          setPipelines([]);
          setCapabilities(nextCapabilities);
          setSelectedPipelineIdState(null);
          setError("No accessible opportunity pipeline is configured.");
          return;
        }
        setPipelines(available);
        setCapabilities(nextCapabilities);
        setSelectedPipelineIdState((current) =>
          current && available.some(({ id }) => id === current)
            ? current
            : (available.find(({ isDefault }) => isDefault) ?? available[0]).id,
        );
      } catch (caught) {
        if (isAbortError(caught)) return;
        setPipelines([]);
        setCapabilities(null);
        setSelectedPipelineIdState(null);
        setBoard(null);
        setError(errorMessage(caught, "Unable to load opportunity pipelines."));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [branchId],
  );

  const fetchBoardData = useCallback(
    async (pipelineId: string, signal?: AbortSignal): Promise<boolean> => {
      if (!branchId) return false;
      const requestEpoch = boardRequestEpochRef.current + 1;
      boardRequestEpochRef.current = requestEpoch;
      setIsLoading(true);
      setError(null);
      setBoard(null);
      try {
        const response = await axiosClient.get<unknown>(
          `/api/tenant/crm/v1/pipelines/${encodeURIComponent(pipelineId)}/board?branchId=${encodeURIComponent(branchId)}&limitPerStage=50`,
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
        if (requestEpoch !== boardRequestEpochRef.current) return false;
        setBoard(nextBoard);
        return true;
      } catch (caught) {
        if (
          isAbortError(caught) ||
          requestEpoch !== boardRequestEpochRef.current
        ) {
          return false;
        }
        setError(errorMessage(caught, "Unable to load the opportunity board."));
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
    [branchId],
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
        setError(
          errorMessage(caught, "Unable to load more opportunities."),
        );
      } finally {
        loadMoreInFlightRef.current = false;
        setLoadingStageId(null);
      }
    },
    [board, branchId, loadingStageId, selectedPipelineId],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void fetchPipelines(controller.signal);
    });
    return () => controller.abort();
  }, [fetchPipelines]);

  useEffect(() => {
    if (!selectedPipelineId) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        void fetchBoardData(selectedPipelineId, controller.signal);
      }
    });
    return () => controller.abort();
  }, [fetchBoardData, selectedPipelineId]);

  const canUpdateOpportunity = useCallback(
    (opportunity: OpportunityCardRecord) =>
      opportunityCapabilityAllowsOwner(
        capabilities?.update ?? null,
        opportunity.ownerUserId,
      ),
    [capabilities?.update],
  );

  const canDeleteOpportunity = useCallback(
    (opportunity: OpportunityCardRecord) =>
      opportunityCapabilityAllowsOwner(
        capabilities?.delete ?? null,
        opportunity.ownerUserId,
      ),
    [capabilities?.delete],
  );

  const performMove = useCallback(
    async (
      cardId: string,
      destStageId: string,
      targetFlag: StageFlag,
      terminalReason?: string,
    ): Promise<boolean> => {
      const opportunity = board?.stages
        .flatMap(({ items }) => items)
        .find(({ id }) => id === cardId);
      if (
        !selectedPipelineId ||
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
        return await fetchBoardData(selectedPipelineId);
      } catch (caught) {
        const message = errorMessage(
          caught,
          "Unable to move the opportunity.",
        );
        if (isAmbiguousMutationError(caught)) {
          const committed = await opportunityReachedStage(cardId, destStageId);
          await fetchBoardData(selectedPipelineId);
          if (committed === true) return true;
          if (committed === null) {
            setTerminalMove((current) =>
              current?.cardId === cardId ? null : current,
            );
            setError(
              "The stage-change result is uncertain. The board was refreshed; review the opportunity before trying again.",
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
    [board, canUpdateOpportunity, fetchBoardData, selectedPipelineId],
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
      if (!opportunity || !canUpdateOpportunity(opportunity)) return;
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
      void performMove(cardId, destStageId, targetFlag);
    },
    [board, canUpdateOpportunity, performMove],
  );

  const confirmTerminalMove = useCallback(
    async (reason: string): Promise<boolean> => {
      if (!terminalMove) return false;
      const moved = await performMove(
        terminalMove.cardId,
        terminalMove.destStageId,
        terminalMove.targetFlag,
        reason,
      );
      if (moved) setTerminalMove(null);
      return moved;
    },
    [performMove, terminalMove],
  );

  const cancelTerminalMove = useCallback(() => {
    if (!isMutating) setTerminalMove(null);
  }, [isMutating]);

  const updateImportance = useCallback(
    async (cardId: string, newImportance: number) => {
      if (
        mutationInFlightRef.current ||
        loadMoreInFlightRef.current ||
        !Number.isInteger(newImportance) ||
        newImportance < 0 ||
        newImportance > 3
      ) {
        return;
      }
      const opportunity = board?.stages
        .flatMap(({ items }) => items)
        .find(({ id }) => id === cardId);
      if (
        !opportunity ||
        !canUpdateOpportunity(opportunity) ||
        opportunity.importance === newImportance
      ) {
        return;
      }
      mutationInFlightRef.current = true;
      setIsMutating(true);
      setError(null);
      try {
        await axiosClient.patch(
          `/api/tenant/crm/v1/opportunities/${encodeURIComponent(cardId)}`,
          { importance: newImportance },
          {
            nonReplayable: true,
            skipAutoIdempotency: true,
            cache: "no-store",
            maxResponseBytes: 512 * 1024,
          },
        );
        if (selectedPipelineId) await fetchBoardData(selectedPipelineId);
      } catch (caught) {
        const message = errorMessage(
          caught,
          "Unable to update opportunity importance.",
        );
        if (selectedPipelineId && isAmbiguousMutationError(caught)) {
          await fetchBoardData(selectedPipelineId);
        }
        setError(message);
      } finally {
        mutationInFlightRef.current = false;
        setIsMutating(false);
      }
    },
    [board, canUpdateOpportunity, fetchBoardData, selectedPipelineId],
  );

  return {
    lang,
    t,
    board,
    pipelines,
    capabilities,
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
      setError(null);
    },
    selectedPipelineId,
    setSelectedPipelineId,
    isLoading,
    isMutating,
    loadingStageId,
    error,
    fetchPipelines,
    fetchBoardData,
    loadMoreStage,
    canUpdateOpportunity,
    canDeleteOpportunity,
    moveCard,
    terminalMove,
    confirmTerminalMove,
    cancelTerminalMove,
    updateImportance,
  };
}
