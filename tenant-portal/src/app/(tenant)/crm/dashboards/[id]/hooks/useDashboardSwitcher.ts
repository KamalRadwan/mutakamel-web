"use client";

import { useCallback, useEffect, useState } from "react";
import { definitionListPath, mergeDefinitionItems } from '../../definition-pagination';
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  DASHBOARDS_PATH,
  DASHBOARDS_CATALOG_PATH,
  dashboardFromTemplatePath,
  parseDashboardDetailResponse,
  parseDashboardsResponse,
  type DashboardSummary,
  type DashboardTemplateKey,
} from "../../dashboard-contract";
import { parseCatalogResponse, type TemplateDefinition } from "../../dashboard-catalog-contract";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 2 * 1024 * 1024 } as const;
const WRITE_CONFIG = { maxResponseBytes: 1024 * 1024 } as const;

export function useDashboardSwitcher(canCreate: boolean) {
  const [items, setItems] = useState<DashboardSummary[]>([]);
  const [templates, setTemplates] = useState<TemplateDefinition[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const load = useCallback(async (signal?: AbortSignal, cursor?: string): Promise<void> => {
    setError(null);
    setIsLoading(true);
    // The list and navigation use the same accessible rows, but only the list
    // includes sourceTemplateKey (dashboard-definitions.service.ts).
    const [list, catalog] = await Promise.allSettled([
      axiosClient.get<unknown>(definitionListPath(DASHBOARDS_PATH, cursor), { ...READ_CONFIG, signal }),
      axiosClient.get<unknown>(DASHBOARDS_CATALOG_PATH, { ...READ_CONFIG, signal }),
    ]);
    if (signal?.aborted) return;
    try {
      if (list.status === "rejected") throw list.reason;
      const page = parseDashboardsResponse(list.value.data);
      setItems((current) => cursor ? mergeDefinitionItems(current, page.items) : page.items);
      setNextCursor(page.nextCursor);
      setHasLoaded(true);
    } catch (failure) {
      setHasLoaded(false);
      setError(normalizeApiError(failure));
    }
    try {
      if (catalog.status === "rejected") throw catalog.reason;
      setTemplates(parseCatalogResponse(catalog.value.data).templates);
    } catch (failure) {
      setTemplates([]);
      setError(normalizeApiError(failure));
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

  const ensureTemplateDashboard = useCallback(
    async (templateKey: DashboardTemplateKey): Promise<string | null> => {
      if (!canCreate) return null;
      try {
        const response = await axiosClient.put<unknown>(
          dashboardFromTemplatePath(templateKey),
          {},
          WRITE_CONFIG,
        );
        const detail = parseDashboardDetailResponse(response.data);
        await load();
        return detail.id;
      } catch {
        return null;
      }
    },
    [canCreate, load],
  );

  // ensureTemplate resolves the actor's own instance, never a shared one
  // (dashboard-template.service.ts: createFromTemplate).
  const provisionedKeys = new Set(
    items.filter((item) => item.accessLevel === "OWNER").map((item) => item.sourceTemplateKey),
  );
  const unprovisionedTemplates = canCreate && hasLoaded && nextCursor === null
    ? templates.filter((template) => !provisionedKeys.has(template.key))
    : [];

  return {
    items, error, reload: load, unprovisionedTemplates, ensureTemplateDashboard, isLoading,
    hasMore: nextCursor !== null,
    loadMore: () => nextCursor && !isLoading ? load(undefined, nextCursor) : Promise.resolve(),
  };
}
