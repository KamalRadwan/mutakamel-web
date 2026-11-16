"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { PIPELINE_ASSIGNMENT_OPTIONS_PATH, parseAssignmentOptionsResponse, type PipelineAssignmentOption } from "../pipeline-contract";
import { usePipelineSafety } from "./usePipelineSafety";
import { assertReceiptStatus } from "./pipeline-write-support";

export function usePipelineAssignmentOptions(enabled: boolean) {
  const { scope, startRead, currentRead, busy } = usePipelineSafety("assignment-options");
  const [loadedScope, setLoadedScope] = useState<string>();
  const cacheScope = useRef<string | undefined>(undefined);
  const [users, setUsers] = useState<PipelineAssignmentOption[]>([]);
  const [teams, setTeams] = useState<PipelineAssignmentOption[]>([]);
  const [knownUsers, setKnownUsers] = useState<PipelineAssignmentOption[]>([]);
  const [knownTeams, setKnownTeams] = useState<PipelineAssignmentOption[]>([]);
  const [optionsQuery, setOptionsQuery] = useState("");
  const queryRef = useRef("");
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState<NormalizedApiError | null>(null);
  const sequence = useRef(0);
  const invalidate = useCallback(() => { sequence.current++; }, []);
  const load = useCallback(async (search: string, signal?: AbortSignal) => {
    if (!enabled) return;
    const ticket = startRead();
    if (!ticket) return;
    const request = ++sequence.current;
    setIsLoadingOptions(true);
    setOptionsError(null);
    try {
      // PipelineAssignmentOptionsQueryDto: search <=80; limit 1–100, default50.
      const params = new URLSearchParams({ limit: "50" });
      if (search.trim()) params.set("search", search.trim().slice(0, 80));
      const response = await axiosClient.get<unknown>(`${PIPELINE_ASSIGNMENT_OPTIONS_PATH}?${params}`, {
        signal, cache: "no-store", maxResponseBytes: 256 * 1024,
      });
      if (signal?.aborted || request !== sequence.current || !currentRead(ticket)) return;
      assertReceiptStatus(response, 200);
      const options = parseAssignmentOptionsResponse(response.data);
      const sameScope = cacheScope.current === scope;
      cacheScope.current = scope;
      setLoadedScope(scope);
      setUsers(options.users);
      setTeams(options.teams);
      setKnownUsers((current) => sameScope ? mergeOptions(current, options.users) : options.users);
      setKnownTeams((current) => sameScope ? mergeOptions(current, options.teams) : options.teams);
    } catch (error) {
      if (signal?.aborted || request !== sequence.current || !currentRead(ticket)) return;
      setUsers([]);
      setTeams([]);
      setOptionsError(normalizeApiError(error));
    } finally {
      if (!signal?.aborted && request === sequence.current) setIsLoadingOptions(false);
    }
  }, [enabled, scope, startRead, currentRead]);
  useEffect(() => {
    if (busy) return;
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void load(queryRef.current, controller.signal); });
    return () => { controller.abort(); invalidate(); };
  }, [load, invalidate, busy]);
  return {
    users: loadedScope === scope ? users : [], teams: loadedScope === scope ? teams : [],
    knownUsers: loadedScope === scope ? knownUsers : [], knownTeams: loadedScope === scope ? knownTeams : [],
    optionsQuery, optionsError, isLoadingOptions,
    searchOptions: (query: string) => { queryRef.current = query.slice(0, 80); setOptionsQuery(queryRef.current); void load(query); },
    reloadOptions: () => load(optionsQuery),
  };
}

function mergeOptions(previous: PipelineAssignmentOption[], next: PipelineAssignmentOption[]) {
  return [...new Map([...previous, ...next].map((option) => [option.id, option])).values()];
}
