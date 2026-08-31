"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  PIPELINES_CONFIGURATION_PATH,
  PIPELINES_PATH,
  buildCreatePipelineRequest,
  parsePipelinesResponse,
  pipelineDefaultPath,
  pipelinePath,
  type CreatePipelineInput,
  type Pipeline,
} from "../pipeline-contract";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 512 * 1024 } as const;
// Auto-idempotency is deliberately NOT skipped: PUT /:id/default is declared
// `idempotent: true` in the Gateway contract and answers IDEM_MISSING without
// the header. `nonReplayable` only stops the transport re-sending after a
// session refresh; it does not remove the key.
const WRITE_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 256 * 1024,
  nonReplayable: true,
} as const;

export interface PipelineWriteResult {
  ok: boolean;
  replayed: boolean;
  error: NormalizedApiError | null;
}

const OK: PipelineWriteResult = { ok: true, replayed: false, error: null };

export function usePipelines() {
  const { t, lang } = useI18n();
  const { user } = useTenantAuth();
  // Pipelines are a tenant-wide catalogue, not a branch- or owner-scoped
  // record, and CRM exposes no capabilities endpoint for them — the guard on
  // every write is the static `crm.pipelines.manage`. D11 is about SCOPED
  // permissions, which these are not.
  const canManage = user?.permissions.includes("crm.pipelines.manage") ?? false;
  const [items, setItems] = useState<Pipeline[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // A manager reads the full catalogue, including inactive pipelines and their
  // assignment configuration; a read-only actor sees only the pipelines they
  // can reach. Two routes, one screen — verified in pipelines.controller.ts.
  const listPath = canManage ? PIPELINES_CONFIGURATION_PATH : PIPELINES_PATH;

  const load = useCallback(
    async (signal?: AbortSignal): Promise<boolean> => {
      setIsLoading(true);
      setQueryError(null);
      try {
        const response = await axiosClient.get<unknown>(listPath, {
          ...READ_CONFIG,
          signal,
        });
        setItems(parsePipelinesResponse(response.data));
        setHasLoaded(true);
        return true;
      } catch (error) {
        if (isAbortError(error)) return false;
        setQueryError(normalizeApiError(error));
        return false;
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [listPath],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return items;
    return items.filter(({ nameAr, nameEn, code }) =>
      [nameAr, nameEn, code].some((value) =>
        value.toLocaleLowerCase().includes(query),
      ),
    );
  }, [items, searchQuery]);

  const create = async (
    input: CreatePipelineInput,
  ): Promise<PipelineWriteResult> => {
    if (!canManage) return forbidden();
    let body: Record<string, unknown>;
    try {
      body = buildCreatePipelineRequest(input);
    } catch (error) {
      return { ok: false, replayed: false, error: localError(error) };
    }
    setIsCreating(true);
    try {
      const response = await axiosClient.post<unknown>(
        PIPELINES_PATH,
        body,
        WRITE_CONFIG,
      );
      await load();
      return { ...OK, replayed: isIdempotentReplay(response.headers) };
    } catch (error) {
      return { ok: false, replayed: false, error: normalizeApiError(error) };
    } finally {
      setIsCreating(false);
    }
  };

  const remove = async (id: string): Promise<PipelineWriteResult> => {
    if (!canManage) return forbidden();
    setPendingId(id);
    try {
      // 204 No Content — there is no body to parse and none is read.
      const response = await axiosClient.delete<unknown>(
        pipelinePath(id),
        WRITE_CONFIG,
      );
      setItems((current) => current.filter((item) => item.id !== id));
      await load();
      return { ...OK, replayed: isIdempotentReplay(response.headers) };
    } catch (error) {
      await load();
      return { ok: false, replayed: false, error: normalizeApiError(error) };
    } finally {
      setPendingId(null);
    }
  };

  const setDefault = async (id: string): Promise<PipelineWriteResult> => {
    if (!canManage) return forbidden();
    const previous = items;
    // Optimistic: exactly one pipeline is default, so the flag moves rather
    // than toggling. Reverted below the moment the write fails.
    setItems((current) =>
      current.map((item) => ({ ...item, isDefault: item.id === id })),
    );
    setPendingId(id);
    try {
      const response = await axiosClient.put<unknown>(
        pipelineDefaultPath(id),
        undefined,
        WRITE_CONFIG,
      );
      await load();
      return { ...OK, replayed: isIdempotentReplay(response.headers) };
    } catch (error) {
      setItems(previous);
      return { ok: false, replayed: false, error: normalizeApiError(error) };
    } finally {
      setPendingId(null);
    }
  };

  return {
    t,
    lang,
    items: filteredItems,
    hasLoaded,
    isLoading,
    isCreating,
    pendingId,
    queryError,
    canManage,
    searchQuery,
    setSearchQuery,
    create,
    remove,
    setDefault,
    reload: () => load(),
  };
}

function forbidden(): PipelineWriteResult {
  return {
    ok: false,
    replayed: false,
    error: { status: 403, code: "FORBIDDEN" },
  };
}

function localError(error: unknown): NormalizedApiError {
  return {
    status: 0,
    code: error instanceof Error ? error.message : "INVALID_INPUT",
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
