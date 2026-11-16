"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { hasPermission } from "@/design-system";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import { definitionListPath, mergeDefinitionItems } from "../definition-pagination";
import { DASHBOARDS_CATALOG_PATH, DASHBOARDS_DEFAULT_PATH, DASHBOARDS_PATH, buildCreateDashboardRequest, buildNamedRequest,
  dashboardDefaultPath, dashboardDuplicatePath, dashboardFavoritePath, dashboardFromTemplatePath, dashboardPath,
  parseDashboardDetailResponse, parseDashboardsResponse, type DashboardDetail, type DashboardSummary, type DashboardTemplateKey } from "../dashboard-contract";
import { parseCatalogResponse, type DashboardCatalog } from "../dashboard-catalog-contract";
import { dashboardWriteDenied, invalidDashboardReceipt, uncertainDashboardWrite, useDashboardSafety } from "./useDashboardSafety";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 2 * 1024 * 1024 } as const;
const WRITE_CONFIG = { ...READ_CONFIG, nonReplayable: true } as const;
export interface DashboardWriteResult { ok: boolean; replayed: boolean; createdId: string | null; error: NormalizedApiError | null; refreshFailed?: boolean; ignored?: boolean; }
export interface CreateDashboardInput { name: string; description: string; templateKey: DashboardTemplateKey | null; }
const failed = (error: NormalizedApiError): DashboardWriteResult => ({ ok: false, replayed: false, createdId: null, error });

export function useDashboards(enabled: boolean) {
  const { user } = useTenantAuth();
  const safety = useDashboardSafety("catalogue");
  const { scope, startRead, currentRead, readSettled, readSucceeded, beginWrite, currentWrite, fence, finish } = safety;
  const permission = (key: string) => Boolean(user?.isTenantOwner) || hasPermission(user?.permissions ?? [], key);
  const canCreate = safety.canMutate && permission("crm.dashboards.create");
  const canUseTemplates = canCreate && permission("crm.widgets.create");
  const canDelete = safety.canMutate && permission("crm.dashboards.delete");
  const [items, setItems] = useState<DashboardSummary[]>([]);
  const [catalog, setCatalog] = useState<DashboardCatalog | null>(null);
  const [dataScope, setDataScope] = useState<object | null>(null);
  const [attemptScope, setAttemptScope] = useState<object | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [catalogError, setCatalogError] = useState<NormalizedApiError | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const request = useRef<AbortController | null>(null);
  const visible = dataScope === scope && enabled;
  const visibleItems = useMemo(() => visible ? items : [], [visible, items]);

  const load = useCallback(async (signal?: AbortSignal, cursor?: string): Promise<boolean> => {
    const ticket = enabled ? startRead() : null;
    if (!ticket) return false;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    signal?.addEventListener("abort", () => controller.abort(), { once: true });
    const activeSignal = controller.signal;
    setIsLoading(true); setQueryError(null);
    const [list, catalogue] = await Promise.allSettled([
      axiosClient.get<unknown>(definitionListPath(DASHBOARDS_PATH, cursor), { ...READ_CONFIG, signal: activeSignal }),
      axiosClient.get<unknown>(DASHBOARDS_CATALOG_PATH, { ...READ_CONFIG, signal: activeSignal }),
    ]);
    if (activeSignal.aborted || !currentRead(ticket)) {
      if (!activeSignal.aborted && readSettled(ticket)) { setAttemptScope(scope); setIsLoading(false); }
      return false;
    }
    let loaded = false;
    try {
      if (list.status === "rejected") throw list.reason;
      const page = parseDashboardsResponse(list.value.data);
      setItems((current) => cursor ? mergeDefinitionItems(current, page.items) : page.items);
      setNextCursor(page.nextCursor); setDataScope(scope); readSucceeded(); loaded = true;
    } catch (error) { setQueryError(normalizeApiError(error)); }
    try {
      if (catalogue.status === "rejected") throw catalogue.reason;
      setCatalog(parseCatalogResponse(catalogue.value.data)); setCatalogFailed(false); setCatalogError(null);
    } catch (error) { setCatalog(null); setCatalogFailed(true); setCatalogError(normalizeApiError(error)); }
    setAttemptScope(scope); setIsLoading(false);
    return loaded;
  }, [enabled, scope, startRead, currentRead, readSettled, readSucceeded]);
  useEffect(() => {
    const controller = new AbortController(); const requests = request;
    queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); });
    return () => { controller.abort(); requests.current?.abort(); };
  }, [load]);
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return query ? visibleItems.filter(({ name, description }) => [name, description ?? ""].some((v) => v.toLocaleLowerCase().includes(query))) : visibleItems;
  }, [visibleItems, searchQuery]);

  async function write(allowed: boolean, id: string | null,
    call: () => Promise<{ status: number; headers: Headers; data: unknown }>,
    validate: (data: unknown, status: number) => DashboardDetail | null): Promise<DashboardWriteResult> {
    const ticket = beginWrite(enabled && allowed);
    if (!ticket) return enabled && allowed && safety.canMutate ? { ok: false, replayed: false, createdId: null, error: null, ignored: true } : failed(dashboardWriteDenied());
    setPendingId(id); setIsSubmitting(true);
    let receipt: DashboardDetail | null = null;
    let replayed = false;
    try {
      const response = await call();
      receipt = validate(response.data, response.status);
      if (!currentWrite(ticket)) return { ok: false, replayed: false, createdId: null, error: null, ignored: true };
      replayed = response.headers ? isIdempotentReplay(response.headers) : false;
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (uncertainDashboardWrite(normalized)) fence(ticket);
      if (!currentWrite(ticket)) return { ok: false, replayed: false, createdId: null, error: null, ignored: true };
      return failed(normalized);
    } finally {
      finish(ticket); setPendingId(null); setIsSubmitting(false);
    }
    const refreshFailed = !(await load());
    if (!safety.isScopeCurrent()) return { ok: false, replayed: false, createdId: null, error: null, ignored: true };
    return { ok: true, replayed, createdId: receipt?.id ?? null, error: null, refreshFailed };
  }
  const exact = (id: string, check: (detail: DashboardDetail) => boolean = () => true) => (data: unknown) => {
    const receipt = parseDashboardDetailResponse(data);
    if (receipt.id !== id || !check(receipt)) invalidDashboardReceipt();
    return receipt;
  };
  const create = async (input: CreateDashboardInput) => {
    let body: Record<string, unknown>;
    try { body = buildCreateDashboardRequest(input); } catch (error) { return failed({ status: 0, code: error instanceof Error ? error.message : "INVALID_INPUT" }); }
    return write(canCreate && (!input.templateKey || canUseTemplates), null,
      () => axiosClient.post<unknown>(DASHBOARDS_PATH, body, WRITE_CONFIG), (data) => {
        const receipt = parseDashboardDetailResponse(data);
        if (receipt.name !== input.name.trim() || receipt.accessLevel !== "OWNER" || receipt.ownerUserId !== user?.id) invalidDashboardReceipt();
        return receipt;
      });
  };
  const ensureTemplate = async (templateKey: DashboardTemplateKey) => write(canUseTemplates, null,
    () => axiosClient.put<unknown>(dashboardFromTemplatePath(templateKey), buildNamedRequest(""), WRITE_CONFIG), (data) => {
      const receipt = parseDashboardDetailResponse(data);
      if (receipt.sourceTemplateKey !== templateKey || receipt.accessLevel !== "OWNER" || receipt.ownerUserId !== user?.id) invalidDashboardReceipt();
      return receipt;
    });
  const duplicate = async (id: string, name = "") => write(canUseTemplates && visibleItems.some((item) => item.id === id), id,
    () => axiosClient.post<unknown>(dashboardDuplicatePath(id), buildNamedRequest(name), WRITE_CONFIG), (data) => {
      const receipt = parseDashboardDetailResponse(data);
      if (receipt.id === id || receipt.accessLevel !== "OWNER" || receipt.ownerUserId !== user?.id || (name.trim() && receipt.name !== name.trim())) invalidDashboardReceipt();
      return receipt;
    });
  const remove = async (id: string) => write(canDelete && visibleItems.some((item) => item.id === id && item.accessLevel === "OWNER"), id,
    () => axiosClient.delete<unknown>(dashboardPath(id), WRITE_CONFIG), (data, status) => {
      if (status !== 204 || (data !== null && data !== undefined && data !== "")) invalidDashboardReceipt();
      return null;
    });
  const setDefault = async (id: string) => write(visibleItems.some((item) => item.id === id), id,
    () => axiosClient.put<unknown>(dashboardDefaultPath(id), undefined, WRITE_CONFIG), exact(id, (receipt) => receipt.isDefault));
  const setFavorite = async (id: string, favorite: boolean) => write(visibleItems.some((item) => item.id === id), id,
    () => axiosClient.put<unknown>(dashboardFavoritePath(id), { favorite }, WRITE_CONFIG), exact(id, (receipt) => receipt.isFavorite === favorite));
  const openDefault = async (): Promise<DashboardWriteResult> => {
    const ticket = enabled ? startRead() : null;
    if (!ticket) return enabled ? { ok: false, replayed: false, createdId: null, error: null, ignored: true } : failed(dashboardWriteDenied());
    try {
      const response = await axiosClient.get<unknown>(DASHBOARDS_DEFAULT_PATH, READ_CONFIG);
      const receipt = parseDashboardDetailResponse(response.data);
      if (!currentRead(ticket)) return { ok: false, replayed: false, createdId: null, error: null, ignored: true };
      return { ok: true, replayed: false, createdId: receipt.id, error: null };
    } catch (error) { return currentRead(ticket) ? failed(normalizeApiError(error)) : { ok: false, replayed: false, createdId: null, error: null, ignored: true }; }
  };
  return { items: filteredItems, catalog: visible ? catalog : null, catalogFailed: visible && catalogFailed,
    catalogError: attemptScope === scope ? catalogError : null, hasLoaded: visible, isLoading: enabled && (attemptScope !== scope || isLoading), hasMore: visible && nextCursor !== null,
    loadMore: () => nextCursor && visible && !isLoading ? load(undefined, nextCursor) : Promise.resolve(false),
    isSubmitting, pendingId, queryError: attemptScope === scope ? queryError : null,
    canCreate: canCreate && !safety.blocked, canUseTemplates: canUseTemplates && !safety.blocked,
    mayUseTemplates: canUseTemplates,
    canDelete: canDelete && !safety.blocked, canMutate: safety.canMutate && !safety.blocked,
    needsReconciliation: safety.blocked, reviewReady: safety.reviewReady, acknowledge: safety.acknowledge,
    searchQuery, setSearchQuery, create, ensureTemplate, openDefault, duplicate, remove, setDefault, setFavorite,
    reload: () => load() };
}




