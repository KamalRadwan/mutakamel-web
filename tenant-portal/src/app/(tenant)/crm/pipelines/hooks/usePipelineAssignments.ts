"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeReplacementDiff, type ReplacementItem } from "@/design-system";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import { buildReplaceAssignmentsRequest, parseAssignmentsResponse, pipelineAssignmentsPath,
  type PipelineAccessMode, type PipelineAssignmentOption, type PipelineAssignments } from "../pipeline-contract";
import { usePipelineAssignmentOptions } from "./usePipelineAssignmentOptions";
import { usePipelineSafety, type PipelineWriteTicket } from "./usePipelineSafety";
import { PIPELINE_READ_CONFIG, PIPELINE_WRITE_CONFIG, assertReceiptStatus, localPipelineError,
  pipelineWriteError, refusedPipelineWrite, type PipelineWriteResult } from "./pipeline-write-support";

export function usePipelineAssignments(pipelineId: string, canManage: boolean) {
  const safety = usePipelineSafety(`assignments:${pipelineId}`);
  const { scope, startRead, currentRead, reconciled } = safety;
  const [snapshot, setSnapshot] = useState<{ scope: string; value: PipelineAssignments } | null>(null);
  const confirmed = useRef(snapshot);
  const [accessMode, setAccessMode] = useState<PipelineAccessMode>("ALL");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const readFailed = useRef(false);
  const options = usePipelineAssignmentOptions(canManage);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingScope, setPendingScope] = useState<string>();
  const applyDraft = useCallback((next: PipelineAssignments) => {
    setAccessMode(next.accessMode); setUserIds(next.userIds); setTeamIds(next.teamIds);
  }, []);
  const load = useCallback(async (signal?: AbortSignal, preserveDraft = false, write?: PipelineWriteTicket) => {
    if (!canManage) return false;
    const ticket = startRead(write);
    if (!ticket) return false;
    setIsLoading(true); setLoadError(null);
    try {
      const response = await axiosClient.get<unknown>(pipelineAssignmentsPath(pipelineId), { ...PIPELINE_READ_CONFIG, signal });
      if (signal?.aborted || !currentRead(ticket)) return false;
      assertReceiptStatus(response, 200);
      const next = parseAssignmentsResponse(response.data);
      confirmed.current = { scope, value: next };
      readFailed.current = false;
      setSnapshot(confirmed.current);
      if (!preserveDraft) applyDraft(next);
      reconciled(ticket);
      return true;
    } catch (caught) {
      if (signal?.aborted || !currentRead(ticket)) return false;
      readFailed.current = true;
      setLoadError(normalizeApiError(caught));
      return false;
    } finally { if (!signal?.aborted && currentRead(ticket)) setIsLoading(false); }
  }, [scope, pipelineId, canManage, startRead, currentRead, reconciled, applyDraft]);
  useEffect(() => {
    if (safety.busy) return;
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal, confirmed.current?.scope === scope); });
    return () => controller.abort();
  }, [load, scope, safety.busy]);
  const assignments = snapshot?.scope === scope ? snapshot.value : null;
  const userDiff = useMemo(() => computeReplacementDiff(toItems(assignments?.userIds ?? [], options.knownUsers),
    toItems(accessMode === "ALL" ? [] : userIds, options.knownUsers)), [assignments, userIds, accessMode, options.knownUsers]);
  const teamDiff = useMemo(() => computeReplacementDiff(toItems(assignments?.teamIds ?? [], options.knownTeams),
    toItems(accessMode === "ALL" ? [] : teamIds, options.knownTeams)), [assignments, teamIds, accessMode, options.knownTeams]);
  const isDirty = assignments !== null && (assignments.accessMode !== accessMode
    || userDiff.added.length + userDiff.removed.length + teamDiff.added.length + teamDiff.removed.length > 0);
  const save = async (): Promise<PipelineWriteResult> => {
    let body: Record<string, unknown>;
    try { body = accessMode === "ALL" ? buildReplaceAssignmentsRequest("ALL", [], []) : buildReplaceAssignmentsRequest("RESTRICTED", userIds, teamIds); }
    catch (caught) { return localPipelineError(caught); }
    const write = safety.beginWrite(canManage && confirmed.current?.scope === scope && !readFailed.current);
    if (!write) return refusedPipelineWrite(canManage ? undefined : "FORBIDDEN");
    setIsSaving(true);
    setPendingScope(scope);
    try {
      const response = await axiosClient.put<unknown>(pipelineAssignmentsPath(pipelineId), body, PIPELINE_WRITE_CONFIG);
      if (!safety.currentWrite(write)) throw new Error("Pipeline assignment write scope changed.");
      assertReceiptStatus(response, 200);
      const receipt = parseAssignmentsResponse(response.data);
      if (receipt.accessMode !== body.accessMode || !sameIds(receipt.userIds, body.userIds as string[]) || !sameIds(receipt.teamIds, body.teamIds as string[])) throw new Error("Assignment receipt does not match its requested replacement.");
      confirmed.current = { scope, value: receipt };
      setSnapshot(confirmed.current); applyDraft(receipt);
      safety.fence(write);
      const checked = await load(undefined, false, write);
      return { ok: true, replayed: isIdempotentReplay(response.headers), error: null, reconciled: checked };
    } catch (caught) {
      const failure = pipelineWriteError(caught);
      if (failure.uncertain) {
        safety.fence(write);
        failure.reconciled = await load(undefined, true, write);
      }
      return { ...failure, stale: !safety.currentWrite(write) };
    } finally {
      const active = safety.currentWrite(write);
      safety.finish(write);
      if (active) setIsSaving(false);
    }
  };
  return {
    assignments, accessMode, setAccessMode, userIds, setUserIds, teamIds, setTeamIds,
    ...options, users: includeSelected(options.users, options.knownUsers, userIds), teams: includeSelected(options.teams, options.knownTeams, teamIds),
    isLoading, isSaving: isSaving && pendingScope === scope, loadError, userDiff, teamDiff, isDirty, save,
    needsReconciliation: safety.needsReconciliation, writeBlocked: safety.busy || safety.needsReconciliation,
    revert: () => { if (assignments) applyDraft(assignments); },
    reload: () => load(), reconcile: () => load(undefined, true),
  };
}
function sameIds(left: string[], right: string[]) { return left.length === right.length && left.every((id) => right.includes(id)); }
function toItems(ids: readonly string[], options: readonly PipelineAssignmentOption[]): ReplacementItem[] {
  return ids.map((id) => { const option = options.find((candidate) => candidate.id === id); return { id, label: option?.label ?? id, hint: option?.code ?? undefined }; });
}
function includeSelected(matches: PipelineAssignmentOption[], known: PipelineAssignmentOption[], ids: string[]) {
  return [...new Map([...matches, ...known.filter((item) => ids.includes(item.id))].map((item) => [item.id, item])).values()];
}
