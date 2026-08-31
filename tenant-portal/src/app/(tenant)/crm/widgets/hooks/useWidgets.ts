"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { hasPermission } from "@/design-system";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import {
  DASHBOARDS_CATALOG_PATH,
} from "../../dashboards/dashboard-contract";
import {
  parseCatalogResponse,
  type DashboardCatalog,
} from "../../dashboards/dashboard-catalog-contract";
import {
  WIDGETS_PATH,
  WIDGET_PREVIEW_PATH,
  buildCloneWidgetRequest,
  buildCreateWidgetRequest,
  parseWidgetsResponse,
  widgetClonePath,
  widgetPath,
  type CrmVisualization,
  type WidgetDefinition,
  type WidgetQuerySpec,
} from "../../dashboards/widget-contract";
import { parseWidgetResult, type WidgetResult } from "../../dashboards/dashboard-run-contract";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 2 * 1024 * 1024 } as const;
const WRITE_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 512 * 1024,
  nonReplayable: true,
} as const;

export interface WidgetWriteResult {
  ok: boolean;
  replayed: boolean;
  createdId: string | null;
  error: NormalizedApiError | null;
}

export function useWidgets() {
  const { user } = useTenantAuth();
  const permissions = useMemo(() => user?.permissions ?? [], [user]);
  // Every `crm.widgets.*` key is STATIC in the CRM catalogue — `widgets` is not
  // in `CRM_SCOPED_RESOURCES`, so there is no `.own`/`.team`/`.all` variant.
  const canCreate = hasPermission(permissions, "crm.widgets.create");
  const canDelete = hasPermission(permissions, "crm.widgets.delete");
  // Preview is gated on `crm.dashboards.read`, NOT `crm.widgets.*` — see
  // dashboard-widgets.controller.ts.
  const canPreview = hasPermission(permissions, "crm.dashboards.read", true);

  const [items, setItems] = useState<WidgetDefinition[]>([]);
  const [catalog, setCatalog] = useState<DashboardCatalog | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [preview, setPreview] = useState<WidgetResult | null>(null);
  const [previewError, setPreviewError] = useState<NormalizedApiError | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    setIsLoading(true);
    setQueryError(null);
    const [list, catalogue] = await Promise.allSettled([
      axiosClient.get<unknown>(WIDGETS_PATH, { ...READ_CONFIG, signal }),
      axiosClient.get<unknown>(DASHBOARDS_CATALOG_PATH, { ...READ_CONFIG, signal }),
    ]);
    if (signal?.aborted) return;

    if (list.status === "fulfilled") {
      try {
        setItems(parseWidgetsResponse(list.value.data));
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
    return items.filter(({ name }) => name.toLocaleLowerCase().includes(query));
  }, [items, searchQuery]);

  const create = async (input: {
    name: string;
    visualizationType: CrmVisualization;
    querySpec: WidgetQuerySpec;
  }): Promise<WidgetWriteResult> => {
    if (!canCreate) return forbidden();
    setIsSubmitting(true);
    try {
      const response = await axiosClient.post<unknown>(
        WIDGETS_PATH,
        buildCreateWidgetRequest(input),
        WRITE_CONFIG,
      );
      await load();
      const created = response.data as { id?: unknown } | null;
      return {
        ok: true,
        replayed: isIdempotentReplay(response.headers),
        createdId: typeof created?.id === "string" ? created.id : null,
        error: null,
      };
    } catch (error) {
      return failure(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clone = async (id: string): Promise<WidgetWriteResult> => {
    if (!canCreate) return forbidden();
    setPendingId(id);
    try {
      const response = await axiosClient.post<unknown>(
        widgetClonePath(id),
        buildCloneWidgetRequest(""),
        WRITE_CONFIG,
      );
      await load();
      const created = response.data as { id?: unknown } | null;
      return {
        ok: true,
        replayed: isIdempotentReplay(response.headers),
        createdId: typeof created?.id === "string" ? created.id : null,
        error: null,
      };
    } catch (error) {
      return failure(error);
    } finally {
      setPendingId(null);
    }
  };

  const remove = async (id: string): Promise<WidgetWriteResult> => {
    if (!canDelete) return forbidden();
    setPendingId(id);
    try {
      // 204. Deleting also soft-deletes every placement of this widget on
      // every dashboard and bumps their revisions — the confirmation says so.
      await axiosClient.delete<unknown>(widgetPath(id), WRITE_CONFIG);
      await load();
      return { ok: true, replayed: false, createdId: null, error: null };
    } catch (error) {
      return failure(error);
    } finally {
      setPendingId(null);
    }
  };

  /** `POST /widgets/preview` — executes an unsaved definition. 201, READ_HEAVY. */
  const runPreview = async (input: {
    name: string;
    visualizationType: CrmVisualization;
    querySpec: WidgetQuerySpec;
  }): Promise<void> => {
    if (!canPreview) return;
    setIsPreviewing(true);
    setPreviewError(null);
    try {
      const response = await axiosClient.post<unknown>(
        WIDGET_PREVIEW_PATH,
        buildCreateWidgetRequest(input),
        { ...READ_CONFIG, skipAutoIdempotency: true },
      );
      setPreview(parseWidgetResult(response.data));
    } catch (error) {
      setPreview(null);
      setPreviewError(normalizeApiError(error));
    } finally {
      setIsPreviewing(false);
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
    canPreview,
    searchQuery,
    setSearchQuery,
    preview,
    previewError,
    isPreviewing,
    clearPreview: () => {
      setPreview(null);
      setPreviewError(null);
    },
    runPreview,
    create,
    clone,
    remove,
    reload: () => load(),
  };
}

function forbidden(): WidgetWriteResult {
  return { ok: false, replayed: false, createdId: null, error: { status: 403, code: "FORBIDDEN" } };
}

function failure(error: unknown): WidgetWriteResult {
  return { ok: false, replayed: false, createdId: null, error: normalizeApiError(error) };
}
