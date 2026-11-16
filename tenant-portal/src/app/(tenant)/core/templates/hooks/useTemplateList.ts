"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { can } from "@/lib/auth/permission-scope";
import { fetchTemplates, searchTemplates, type TemplateListRequest } from "../templates-api";
import {
  ACCESS_POLICY_BLOCKED_CODE,
  TEMPLATE_CREATE_PERMISSION,
  TEMPLATE_READ_PERMISSION,
  type TemplateListItem,
  type TemplateSortField,
} from "../templates-contract";
import { isExpiredCursor, useTemplateCursor } from "./useTemplateCursor";
import { templateRequestFence } from "./useTemplateAuthority";

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
export function useTemplateList(
  authority: string,
  readAuthority: () => string | null,
  subscribeAuthority: (listener: () => void) => () => void,
) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { authState, readReadyProfileCommit } = useTenantAuth();
  const user = readAuthority() === authority ? readReadyProfileCommit()?.user : undefined;
  const canRead = user?.permissions.includes(TEMPLATE_READ_PERMISSION) ?? false;
  const canCreate = can(user, TEMPLATE_CREATE_PERMISSION);
  const canReadTenant = can(user, TEMPLATE_READ_PERMISSION, { tenantWide: true });

  const cursor = useTemplateCursor();
  const [items, setItems] = useState<TemplateListItem[]>([]);
  const [nextPage, setNextPage] = useState<{ cursor: string; revision: number } | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [filters, setFilters] = useState<TemplateListFilters>({});
  const [sortBy, setSortBy] = useState<TemplateSortField>("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [accessFailure, setAccessFailure] = useState<"entitlement" | "permission" | null>(null);
  const [revision, setRevision] = useState(0);
  const [emptyRead, setEmptyRead] = useState<number | null>(null);
  const activeRequest = useRef<{ revision: number; controller: AbortController | null }>({
    revision: 0,
    controller: null,
  });

  const activeCursor = cursor.cursor;
  const restart = cursor.restart;
  const nextCursor = nextPage?.revision === revision ? nextPage.cursor : null;

  const invalidatePage = useCallback(() => {
    // Retire the old page before effect cleanup, including any queued replay.
    const request = activeRequest.current;
    const nextRevision = ++request.revision;
    request.controller?.abort();
    setRevision(nextRevision);
    setNextPage(null);
    setIsLoading(true);
  }, []);
  const restartList = useCallback((becauseExpired: boolean) => {
    invalidatePage();
    restart(becauseExpired);
  }, [invalidatePage, restart]);

  const load = useCallback(
    async (signal: AbortSignal): Promise<void> => {
      const current = () => !signal.aborted && activeRequest.current.revision === revision && readAuthority() === authority;
      if (!current()) return;
      setEmptyRead(null);
      if (!canRead || !canReadTenant) {
        setIsLoading(false);
        return;
      }
      const requestCurrent = () => current() && can(readReadyProfileCommit()?.user, TEMPLATE_READ_PERMISSION, { tenantWide: true });
      if (!requestCurrent()) return;
      const assertCurrent = templateRequestFence(requestCurrent);
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
            ? await searchTemplates(request, signal, assertCurrent)
            : await fetchTemplates(request, signal, assertCurrent);
        if (!requestCurrent()) return;
        setItems(page.items);
        setNextPage(page.hasNextPage && page.nextCursor ? { cursor: page.nextCursor, revision } : null);
        setTotalCount(page.totalCount);
        setAccessFailure(null);
        if (!activeCursor && activeFilterCount === 0 &&
            sortBy === "updatedAt" && sortDirection === "desc" && page.items.length === 0 && page.totalCount === 0 &&
            !page.hasNextPage && page.nextCursor === null) {
          setEmptyRead(revision);
        }
      } catch (caught) {
        if (!requestCurrent() || (caught instanceof DOMException && caught.name === "AbortError")) return;
        const normalized = normalizeApiError(caught);
        setNextPage(null);
        if (normalized.status === 403) {
          setAccessFailure(normalized.code === ACCESS_POLICY_BLOCKED_CODE ? "entitlement" : "permission");
          setItems([]);
          setTotalCount(null);
          return;
        }
        setAccessFailure(null);
        if (isExpiredCursor(normalized) && activeCursor) {
          restartList(true);
          return;
        }
        setError(normalized);
      } finally {
        if (current()) setIsLoading(false);
      }
    },
    [canRead, canReadTenant, filters, sortBy, sortDirection, activeCursor, revision, restartList, authority, readAuthority,
      readReadyProfileCommit],
  );

  useLayoutEffect(() => {
    const request = activeRequest.current;
    if (request.revision !== revision) return;
    const controller = new AbortController();
    request.controller = controller;
    const stop = subscribeAuthority(() => { if (readAuthority() !== authority) controller.abort(); });
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => {
      stop();
      controller.abort();
      if (request.controller === controller) request.controller = null;
    };
  }, [load, revision, authority, readAuthority, subscribeAuthority]);

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
    isEntitlementBlocked: accessFailure === "entitlement",
    isPermissionDenied: accessFailure === "permission" || (canRead && !canReadTenant),
    isFirstUseEmpty: authState === "AUTHENTICATED" && canReadTenant && !isLoading && !error && !accessFailure &&
      !cursor.canGoBack && !cursor.wasReset && emptyRead === revision,
    cursor,
    hasNextPage: !!nextCursor,
    applyFilters: (next: TemplateListFilters) => {
      // A new filter set is a new cursor fingerprint, so the trail is dropped.
      restartList(false);
      setFilters(next);
    },
    applySort: (field: TemplateSortField, direction: "asc" | "desc") => {
      restartList(false);
      setSortBy(field);
      setSortDirection(direction);
    },
    goNext: () => {
      if (!nextCursor || !canRead || isLoading || activeRequest.current.revision !== revision) return;
      invalidatePage();
      cursor.advance(nextCursor);
    },
    goBack: () => {
      if (!cursor.canGoBack || isLoading || activeRequest.current.revision !== revision) return;
      invalidatePage();
      cursor.goBack();
    },
    startOver: () => restartList(false),
    totalCount,
    openTemplate: (template: TemplateListItem) =>
      router.push(`${TENANT_ROUTES.coreTemplates}/${template.id}`),
    reload: invalidatePage,
  };
}
