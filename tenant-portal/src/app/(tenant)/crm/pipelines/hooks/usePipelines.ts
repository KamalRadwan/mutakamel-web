"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import { PIPELINES_CONFIGURATION_PATH, PIPELINES_PATH, buildCreatePipelineRequest, parsePipelinesResponse,
  pipelineDefaultPath, pipelinePath, type CreatePipelineInput, type Pipeline } from "../pipeline-contract";
import { usePipelineSafety, type PipelineWriteTicket } from "./usePipelineSafety";
import { PIPELINE_READ_CONFIG, PIPELINE_WRITE_CONFIG, assertReceiptStatus, assertPipelineConfiguration, localPipelineError,
  pipelineReceipt, pipelineWriteError, refusedPipelineWrite, type PipelineWriteResult } from "./pipeline-write-support";
export type { PipelineWriteResult } from "./pipeline-write-support";
const EMPTY_PIPELINES: Pipeline[] = [];

export function usePipelines() {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  const canManage = user?.permissions.includes("crm.pipelines.manage") ?? false;
  const safety = usePipelineSafety("catalogue");
  const { scope, startRead, currentRead, beginWrite, reconciled: reconcileRead } = safety;
  const [snapshot, setSnapshot] = useState<{ scope: string; items: Pipeline[] } | null>(null);
  const confirmed = useRef(snapshot);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const readError = useRef<NormalizedApiError | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingScope, setPendingScope] = useState<string>();
  const listPath = canManage ? PIPELINES_CONFIGURATION_PATH : PIPELINES_PATH;
  const load = useCallback(async (signal?: AbortSignal, write?: PipelineWriteTicket, expected?: (rows: Pipeline[]) => boolean) => {
    const ticket = startRead(write);
    if (!ticket) return false;
    setIsLoading(true);
    setQueryError(null);
    try {
      const response = await axiosClient.get<unknown>(listPath, { ...PIPELINE_READ_CONFIG, signal });
      if (signal?.aborted || !currentRead(ticket)) return false;
      assertReceiptStatus(response, 200);
      const rows = parsePipelinesResponse(response.data);
      if (canManage) rows.forEach(assertPipelineConfiguration);
      if (expected && !expected(rows)) throw new Error("Pipeline read does not confirm its mutation receipt.");
      confirmed.current = { scope, items: rows };
      readError.current = null;
      setSnapshot(confirmed.current);
      if (canManage) reconcileRead(ticket);
      return true;
    } catch (caught) {
      if (signal?.aborted || !currentRead(ticket)) return false;
      readError.current = normalizeApiError(caught);
      setQueryError(readError.current);
      return false;
    } finally { if (!signal?.aborted && currentRead(ticket)) setIsLoading(false); }
  }, [scope, listPath, canManage, startRead, currentRead, reconcileRead]);
  useEffect(() => {
    if (safety.busy) return;
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); });
    return () => controller.abort();
  }, [load, safety.busy]);

  const execute = async (kind: "create" | "delete" | "default", id?: string, body?: Record<string, unknown>): Promise<PipelineWriteResult> => {
    const write = beginWrite(canManage && confirmed.current?.scope === scope && !readError.current);
    if (!write) return refusedPipelineWrite(canManage ? undefined : "FORBIDDEN");
    setPendingScope(scope);
    if (kind === "create") setIsCreating(true);
    else setPendingId(id!);
    try {
      const response = kind === "create"
        ? await axiosClient.post<unknown>(PIPELINES_PATH, body, PIPELINE_WRITE_CONFIG)
        : kind === "delete" ? await axiosClient.delete<unknown>(pipelinePath(id!), PIPELINE_WRITE_CONFIG)
          : await axiosClient.put<unknown>(pipelineDefaultPath(id!), undefined, PIPELINE_WRITE_CONFIG);
      if (!safety.currentWrite(write)) throw new Error("Pipeline write scope changed.");
      let expected: (rows: Pipeline[]) => boolean;
      if (kind === "delete") {
        assertReceiptStatus(response, 204);
        expected = (rows) => !rows.some((row) => row.id === id);
      } else {
        const receipt = pipelineReceipt(response, kind === "create" ? 201 : 200, id);
        if (kind === "create" && receipt.code !== body?.code) throw new Error("Created pipeline code does not match.");
        if (kind === "create" && (receipt.nameAr !== body?.nameAr || receipt.nameEn !== body?.nameEn
          || (body?.description !== undefined && receipt.description !== body.description)
          || (body?.isDefault === true && !receipt.isDefault) || !receipt.isActive || receipt.accessMode !== "ALL")) throw new Error("Created pipeline receipt does not match its request.");
        if (kind === "create" && Array.isArray(body?.stageIds)
          && (receipt.stages.length !== body.stageIds.length || receipt.stages.some((stage, index) => stage.opportunityStageId !== (body.stageIds as string[])[index]))) throw new Error("Created stage order does not match its request.");
        if (kind === "default" && (!receipt.isDefault || !receipt.isActive || receipt.accessMode !== "ALL")) throw new Error("Invalid default pipeline receipt.");
        expected = (rows) => rows.some((row) => row.id === receipt.id && row.code === receipt.code);
      }
      safety.fence(write);
      const reconciled = await load(undefined, write, expected);
      return { ok: true, replayed: isIdempotentReplay(response.headers), error: null, reconciled };
    } catch (caught) {
      const failure = pipelineWriteError(caught);
      if (failure.uncertain) {
        safety.fence(write);
        failure.reconciled = await load(undefined, write);
      }
      return { ...failure, stale: !safety.currentWrite(write) };
    } finally {
      const current = safety.currentWrite(write);
      safety.finish(write);
      if (current) { setIsCreating(false); setPendingId(null); }
    }
  };
  const items = snapshot?.scope === scope ? snapshot.items : EMPTY_PIPELINES;
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return query ? items.filter(({ code, nameAr, nameEn }) => [code, nameAr, nameEn].some((value) => value.toLocaleLowerCase().includes(query))) : items;
  }, [items, searchQuery]);
  return {
    t, lang, canManage, items: filteredItems, allItems: items, hasLoaded: snapshot?.scope === scope,
    isLoading, queryError, searchQuery, setSearchQuery,
    pendingId: pendingScope === scope ? pendingId : null, isCreating: isCreating && pendingScope === scope,
    needsReconciliation: safety.needsReconciliation, writeBlocked: safety.busy || safety.needsReconciliation,
    isPending: safety.isPending,
    create: (input: CreatePipelineInput) => {
      try { return execute("create", undefined, buildCreatePipelineRequest(input)); }
      catch (caught) { return Promise.resolve(localPipelineError(caught)); }
    },
    remove: (id: string) => {
      const target = confirmed.current?.scope === scope ? confirmed.current.items.find((row) => row.id === id) : undefined;
      return !target || target.isDefault ? Promise.resolve(refusedPipelineWrite(canManage ? undefined : "FORBIDDEN")) : execute("delete", id);
    },
    setDefault: (id: string) => {
      const target = confirmed.current?.scope === scope ? confirmed.current.items.find((row) => row.id === id) : undefined;
      return !target || target.isDefault || !target.isActive || target.accessMode !== "ALL"
        ? Promise.resolve(refusedPipelineWrite()) : execute("default", id);
    },
    reload: () => load(),
  };
}
