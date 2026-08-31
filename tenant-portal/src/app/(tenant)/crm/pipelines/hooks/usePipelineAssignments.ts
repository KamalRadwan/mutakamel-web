"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { computeReplacementDiff, type ReplacementItem } from "@/design-system";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import {
  PIPELINE_ASSIGNMENT_OPTIONS_PATH,
  buildReplaceAssignmentsRequest,
  parseAssignmentOptionsResponse,
  parseAssignmentsResponse,
  pipelineAssignmentsPath,
  type PipelineAccessMode,
  type PipelineAssignmentOption,
  type PipelineAssignments,
} from "../pipeline-contract";
import type { PipelineWriteResult } from "./usePipelines";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 256 * 1024 } as const;
const WRITE_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 256 * 1024,
  nonReplayable: true,
} as const;

// PipelineAssignmentOptionsQueryDto: @Min(1) @Max(100), default 50.
const OPTIONS_LIMIT = 50;

/**
 * `GET`/`PUT /pipelines/:id/assignments` plus the eligible-target picker.
 *
 * The PUT replaces the entire assignment set atomically, so what is being
 * taken away is invisible in the payload — the caller renders
 * `AtomicReplacementConfirm` over the diffs this hook computes before it ever
 * sends. See docs/design/patterns.md#atomicreplacementconfirm.
 */
export function usePipelineAssignments(
  pipelineId: string,
  canManage: boolean,
) {
  const [assignments, setAssignments] = useState<PipelineAssignments | null>(
    null,
  );
  const [accessMode, setAccessMode] = useState<PipelineAccessMode>("ALL");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [users, setUsers] = useState<PipelineAssignmentOption[]>([]);
  const [teams, setTeams] = useState<PipelineAssignmentOption[]>([]);
  const [optionsError, setOptionsError] = useState<NormalizedApiError | null>(
    null,
  );
  const [optionsQuery, setOptionsQuery] = useState("");
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const applyServerState = useCallback((next: PipelineAssignments) => {
    setAssignments(next);
    setAccessMode(next.accessMode);
    setUserIds(next.userIds);
    setTeamIds(next.teamIds);
  }, []);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!canManage) return;
      setIsLoading(true);
      setLoadError(null);
      try {
        const response = await axiosClient.get<unknown>(
          pipelineAssignmentsPath(pipelineId),
          { ...READ_CONFIG, signal },
        );
        applyServerState(parseAssignmentsResponse(response.data));
      } catch (error) {
        if (isAbortError(error)) return;
        setAssignments(null);
        setLoadError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [applyServerState, canManage, pipelineId],
  );

  const loadOptions = useCallback(
    async (search: string, signal?: AbortSignal) => {
      if (!canManage) return;
      setIsLoadingOptions(true);
      setOptionsError(null);
      try {
        const params = new URLSearchParams({ limit: String(OPTIONS_LIMIT) });
        const trimmed = search.trim();
        if (trimmed) params.set("search", trimmed);
        const response = await axiosClient.get<unknown>(
          `${PIPELINE_ASSIGNMENT_OPTIONS_PATH}?${params.toString()}`,
          { ...READ_CONFIG, signal },
        );
        const options = parseAssignmentOptionsResponse(response.data);
        setUsers(options.users);
        setTeams(options.teams);
      } catch (error) {
        if (isAbortError(error)) return;
        setUsers([]);
        setTeams([]);
        setOptionsError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoadingOptions(false);
      }
    },
    [canManage],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void load(controller.signal);
      void loadOptions("", controller.signal);
    });
    return () => controller.abort();
  }, [load, loadOptions]);

  const searchOptions = useCallback(
    (query: string) => {
      setOptionsQuery(query);
      void loadOptions(query);
    },
    [loadOptions],
  );

  const userDiff = useMemo(
    () =>
      computeReplacementDiff(
        toItems(assignments?.userIds ?? [], users),
        toItems(userIds, users),
      ),
    [assignments, userIds, users],
  );

  const teamDiff = useMemo(
    () =>
      computeReplacementDiff(
        toItems(assignments?.teamIds ?? [], teams),
        toItems(teamIds, teams),
      ),
    [assignments, teamIds, teams],
  );

  const isDirty =
    assignments !== null &&
    (assignments.accessMode !== accessMode ||
      userDiff.added.length > 0 ||
      userDiff.removed.length > 0 ||
      teamDiff.added.length > 0 ||
      teamDiff.removed.length > 0);

  const save = async (): Promise<PipelineWriteResult> => {
    if (!canManage) {
      return {
        ok: false,
        replayed: false,
        error: { status: 403, code: "FORBIDDEN" },
      };
    }
    let body: Record<string, unknown>;
    try {
      // ALL clears both target lists: leaving stale ids on an ALL pipeline
      // would silently re-restrict it the next time the mode changed.
      body =
        accessMode === "ALL"
          ? buildReplaceAssignmentsRequest("ALL", [], [])
          : buildReplaceAssignmentsRequest("RESTRICTED", userIds, teamIds);
    } catch (error) {
      return {
        ok: false,
        replayed: false,
        error: {
          status: 0,
          code: error instanceof Error ? error.message : "INVALID_INPUT",
        },
      };
    }
    setIsSaving(true);
    try {
      const response = await axiosClient.put<unknown>(
        pipelineAssignmentsPath(pipelineId),
        body,
        WRITE_CONFIG,
      );
      applyServerState(parseAssignmentsResponse(response.data));
      return {
        ok: true,
        replayed: isIdempotentReplay(response.headers),
        error: null,
      };
    } catch (error) {
      return { ok: false, replayed: false, error: normalizeApiError(error) };
    } finally {
      setIsSaving(false);
    }
  };

  return {
    assignments,
    accessMode,
    setAccessMode,
    userIds,
    setUserIds,
    teamIds,
    setTeamIds,
    users,
    teams,
    optionsQuery,
    searchOptions,
    isLoading,
    isLoadingOptions,
    isSaving,
    loadError,
    optionsError,
    userDiff,
    teamDiff,
    isDirty,
    save,
    revert: () => {
      if (assignments) applyServerState(assignments);
    },
    reload: () => load(),
  };
}

/**
 * The options endpoint returns only the page matching the current search, so
 * an assigned id that is not on it would otherwise render as a bare UUID. The
 * id is the honest fallback — inventing a name for it would be worse.
 */
function toItems(
  ids: readonly string[],
  options: readonly PipelineAssignmentOption[],
): ReplacementItem[] {
  return ids.map((id) => {
    const option = options.find((candidate) => candidate.id === id);
    return {
      id,
      label: option?.label ?? id,
      hint: option?.code ?? undefined,
    };
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
