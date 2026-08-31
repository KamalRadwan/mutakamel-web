"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { fetchTemplates, searchTemplates, type TemplateListRequest } from "../templates-api";
import {
  ACCESS_POLICY_BLOCKED_CODE,
  TEMPLATE_CREATE_PERMISSION,
  TEMPLATE_READ_PERMISSION,
  type TemplateListItem,
  type TemplateSortField,
} from "../templates-contract";
import { isExpiredCursor, useTemplateCursor } from "./useTemplateCursor";

export interface TemplateListFilters {
  name?: string;
  documentType?: string;
  outputChannel?: string;
  lifecycleStatus?: string;
  locale?: string;
}

/** Past this many active filters the query string stops being a safe carrier. */
const SEARCH_POST_THRESHOLD = 3;

/**
 * The template definitions list.
 *
 * Two gates gate it: `@RequiresFeature('core.template_designer')`, whose refusal
 * is `ACCESS_POLICY_BLOCKED` and belongs on the entitlement-blocked surface
 * rather than an empty list, and `templates.read`.
 */
export function useTemplateList() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { user } = useTenantAuth();
  const permissions = user?.permissions ?? [];
  const canRead = permissions.includes(TEMPLATE_READ_PERMISSION);
  const canCreate = permissions.includes(TEMPLATE_CREATE_PERMISSION);

  const cursor = useTemplateCursor();
  const [items, setItems] = useState<TemplateListItem[]>([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [filters, setFilters] = useState<TemplateListFilters>({});
  const [sortBy, setSortBy] = useState<TemplateSortField>("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isEntitlementBlocked, setIsEntitlementBlocked] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const activeCursor = cursor.cursor;
  const restart = cursor.restart;

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!canRead) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      const request: TemplateListRequest = {
        assignmentScopeType: "TENANT",
        ...filters,
        sortBy,
        sortDirection,
        ...(activeCursor ? { cursor: activeCursor } : {}),
      };
      const activeFilterCount = Object.values(filters).filter(Boolean).length;
      try {
        // The read-like POST exists for filter sets too large to encode in a
        // query string; below that it is the same answer through a longer path.
        const page =
          activeFilterCount > SEARCH_POST_THRESHOLD
            ? await searchTemplates(request, signal)
            : await fetchTemplates(request, signal);
        setItems(page.items);
        setHasNextPage(page.hasNextPage);
        setNextCursor(page.nextCursor);
        setTotalCount(page.totalCount);
        setIsEntitlementBlocked(false);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        const normalized = normalizeApiError(caught);
        if (normalized.code === ACCESS_POLICY_BLOCKED_CODE) {
          setIsEntitlementBlocked(true);
          setItems([]);
          return;
        }
        if (isExpiredCursor(normalized) && activeCursor) {
          restart(true);
          return;
        }
        setError(normalized);
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [canRead, filters, sortBy, sortDirection, activeCursor, restart],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load, reloadToken]);

  return {
    t,
    lang,
    canRead,
    canCreate,
    items,
    filters,
    sortBy,
    sortDirection,
    isLoading: isLoading && canRead,
    error,
    isEntitlementBlocked,
    cursor,
    hasNextPage,
    applyFilters: (next: TemplateListFilters) => {
      // A new filter set is a new cursor fingerprint, so the trail is dropped.
      cursor.restart(false);
      setFilters(next);
    },
    applySort: (field: TemplateSortField, direction: "asc" | "desc") => {
      cursor.restart(false);
      setSortBy(field);
      setSortDirection(direction);
    },
    goNext: () => cursor.advance(nextCursor),
    goBack: cursor.goBack,
    startOver: () => cursor.restart(false),
    totalCount,
    openTemplate: (template: TemplateListItem) =>
      router.push(`${TENANT_ROUTES.coreTemplates}/${template.id}`),
    reload: () => setReloadToken((token) => token + 1),
  };
}
