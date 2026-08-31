"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import { hasPermission } from "@/design-system";
import {
  DASHBOARDS_CATALOG_PATH,
  DASHBOARDS_DEFAULT_PATH,
  DASHBOARDS_PATH,
  buildCreateDashboardRequest,
  buildNamedRequest,
  dashboardDefaultPath,
  dashboardDuplicatePath,
  dashboardFavoritePath,
  dashboardFromTemplatePath,
  dashboardPath,
  parseDashboardDetailResponse,
  parseDashboardsResponse,
  type DashboardSummary,
  type DashboardTemplateKey,
} from "../dashboard-contract";
import {
  parseCatalogResponse,
  type DashboardCatalog,
} from "../dashboard-catalog-contract";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 2 * 1024 * 1024 } as const;
const WRITE_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 512 * 1024,
  nonReplayable: true,
} as const;

export interface DashboardWriteResult {
  ok: boolean;
  replayed: boolean;
  createdId: string | null;
  error: NormalizedApiError | null;
}

export interface CreateDashboardInput {
  name: string;
  description: string;
  templateKey: DashboardTemplateKey | null;
}

const OK: DashboardWriteResult = { ok: true, replayed: false, createdId: null, error: null };

export function useDashboards() {
  const { user } = useTenantAuth();
  const permissions = useMemo(() => user?.permissions ?? [], [user]);
  // `crm.dashboards.create/update/delete` are STATIC keys in the CRM catalogue
  // — only `crm.dashboards.read` is seeded with `.own/.team/.all`. Matching
  // them scoped would admit a permission the tenant can never hold.
  const canCreate = hasPermission(permissions, "crm.dashboards.create");
  const canDelete = hasPermission(permissions, "crm.dashboards.delete");

  const [items, setItems] = useState<DashboardSummary[]>([]);
  const [catalog, setCatalog] = useState<DashboardCatalog | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    setIsLoading(true);
    setQueryError(null);
    // allSettled, not all: the catalogue only feeds the template picker, and
    // losing the whole screen because it failed is states.md's exact
    // partial-failure mistake.
    const [list, catalogue] = await Promise.allSettled([
      axiosClient.get<unknown>(DASHBOARDS_PATH, { ...READ_CONFIG, signal }),
      axiosClient.get<unknown>(DASHBOARDS_CATALOG_PATH, { ...READ_CONFIG, signal }),
    ]);
    if (signal?.aborted) return;

    if (list.status === "fulfilled") {
      try {
        setItems(parseDashboardsResponse(list.value.data));
        setHasLoaded(true);
      } catch (error) {
        setQueryError(normalizeApiError(error));
      }
    } else {
      setQueryError(normalizeApiError(list.reason));
    }

    if (catalogue.status === "fulfilled") {
      try {
        setCatalog(parseCatalogResponse(catalogue.value.data));
        setCatalogFailed(false);
      } catch {
        setCatalogFailed(true);
      }
    } else {
      setCatalogFailed(true);
    }
    setIsLoading(false);
  }, []);

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
    return items.filter(({ name, description }) =>
      [name, description ?? ""].some((value) => value.toLocaleLowerCase().includes(query)),
    );
  }, [items, searchQuery]);

  async function write(
    call: () => Promise<{ headers: Headers; data: unknown }>,
    reload = true,
  ): Promise<DashboardWriteResult> {
    try {
      const response = await call();
      if (reload) await load();
      const created = response.data as { id?: unknown } | null;
      return {
        ...OK,
        replayed: isIdempotentReplay(response.headers),
        createdId: typeof created?.id === "string" ? created.id : null,
      };
    } catch (error) {
      return { ok: false, replayed: false, createdId: null, error: normalizeApiError(error) };
    }
  }

  const create = async (input: CreateDashboardInput): Promise<DashboardWriteResult> => {
    if (!canCreate) return forbidden();
    let body: Record<string, unknown>;
    try {
      body = buildCreateDashboardRequest(input);
    } catch (error) {
      return localFailure(error);
    }
    setIsSubmitting(true);
    try {
      return await write(() => axiosClient.post<unknown>(DASHBOARDS_PATH, body, WRITE_CONFIG));
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * `POST /from-template/:key` creates a **new** instance every time.
   * `PUT` on the same path is the idempotent "ensure mine exists" variant; the
   * screen offers the POST because a user picking a template from a list is
   * asking for a new dashboard, not for one they may already own.
   */
  const createFromTemplate = async (
    templateKey: DashboardTemplateKey,
    name: string,
  ): Promise<DashboardWriteResult> => {
    if (!canCreate) return forbidden();
    setIsSubmitting(true);
    try {
      return await write(() =>
        axiosClient.post<unknown>(
          dashboardFromTemplatePath(templateKey),
          buildNamedRequest(name),
          WRITE_CONFIG,
        ),
      );
    } catch (error) {
      return localFailure(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * `PUT /from-template/:key` — get-or-create.
   *
   * The POST on the same path creates a **new** instance every time;
   * `ensureTemplate` returns the actor's existing instance of that template
   * when one exists and only audits a creation when it actually created one.
   * That is what "set up the standard dashboard" means, so this is the verb
   * that button uses.
   */
  const ensureTemplate = async (
    templateKey: DashboardTemplateKey,
  ): Promise<DashboardWriteResult> => {
    if (!canCreate) return forbidden();
    setIsSubmitting(true);
    try {
      return await write(() =>
        axiosClient.put<unknown>(
          dashboardFromTemplatePath(templateKey),
          buildNamedRequest(""),
          WRITE_CONFIG,
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * `GET /dashboards/default` — **a GET that writes.**
   *
   * With no default and no `CRM_DEFAULT` instance it provisions one and emits
   * a `DASHBOARD_CREATED` audit event, so it is never called on mount; it is
   * bound to an explicit action.
   */
  const openDefault = async (): Promise<DashboardWriteResult> => {
    setIsSubmitting(true);
    try {
      const response = await axiosClient.get<unknown>(DASHBOARDS_DEFAULT_PATH, READ_CONFIG);
      const detail = parseDashboardDetailResponse(response.data);
      await load();
      return { ...OK, createdId: detail.id };
    } catch (error) {
      return { ok: false, replayed: false, createdId: null, error: normalizeApiError(error) };
    } finally {
      setIsSubmitting(false);
    }
  };

  const duplicate = async (id: string): Promise<DashboardWriteResult> => {
    if (!canCreate) return forbidden();
    setPendingId(id);
    try {
      return await write(() =>
        axiosClient.post<unknown>(dashboardDuplicatePath(id), {}, WRITE_CONFIG),
      );
    } finally {
      setPendingId(null);
    }
  };

  const remove = async (id: string): Promise<DashboardWriteResult> => {
    if (!canDelete) return forbidden();
    setPendingId(id);
    try {
      // 204 No Content — nothing to read back.
      return await write(() => axiosClient.delete<unknown>(dashboardPath(id), WRITE_CONFIG));
    } finally {
      setPendingId(null);
    }
  };

  /**
   * Default and favourite are **read**-permission writes: both handlers carry
   * `@RequirePermissions('crm.dashboards.read')`, because they store a
   * per-user preference rather than editing the dashboard.
   */
  const setDefault = async (id: string): Promise<DashboardWriteResult> => {
    const previous = items;
    setItems((current) => current.map((item) => ({ ...item, isDefault: item.id === id })));
    setPendingId(id);
    try {
      const result = await write(() =>
        axiosClient.put<unknown>(dashboardDefaultPath(id), undefined, WRITE_CONFIG),
      );
      if (!result.ok) setItems(previous);
      return result;
    } finally {
      setPendingId(null);
    }
  };

  const setFavorite = async (id: string, favorite: boolean): Promise<DashboardWriteResult> => {
    const previous = items;
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, isFavorite: favorite } : item)),
    );
    setPendingId(id);
    try {
      const result = await write(() =>
        axiosClient.put<unknown>(dashboardFavoritePath(id), { favorite }, WRITE_CONFIG),
      );
      if (!result.ok) setItems(previous);
      return result;
    } finally {
      setPendingId(null);
    }
  };

  return {
    items: filteredItems,
    catalog,
    catalogFailed,
    hasLoaded,
    isLoading,
    isSubmitting,
    pendingId,
    queryError,
    canCreate,
    canDelete,
    searchQuery,
    setSearchQuery,
    create,
    createFromTemplate,
    ensureTemplate,
    openDefault,
    duplicate,
    remove,
    setDefault,
    setFavorite,
    reload: () => load(),
  };
}

function forbidden(): DashboardWriteResult {
  return { ok: false, replayed: false, createdId: null, error: { status: 403, code: "FORBIDDEN" } };
}

function localFailure(error: unknown): DashboardWriteResult {
  return {
    ok: false,
    replayed: false,
    createdId: null,
    error: { status: 0, code: error instanceof Error ? error.message : "INVALID_INPUT" },
  };
}
