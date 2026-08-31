"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isTradeReplay, tradeGet, tradePost } from "../../trade-api";
import { hasTradePermission, useTradeScope } from "../../trade-advanced-scope";
import {
  EXTENSION_MANAGE_PERMISSION,
  EXTENSION_PAGE_SIZE,
  EXTENSION_PROFILES_PATH,
  EXTENSION_READ_PERMISSION,
  EXTENSION_TARGETS_PATH,
  buildCreateExtensionProfileRequest,
  extensionFormMessage,
  extensionMessage,
  extensionProfilesListPath,
  parseExtensionProfilesResponse,
  parseExtensionTargets,
  type ExtensionProfile,
  type ExtensionProfileFormValues,
  type ExtensionProfileStatus,
  type ExtensionTargetCode,
  type ExtensionTargetsCatalogue,
} from "../extension-contract";

const LIST_RESPONSE_LIMIT_BYTES = 800_000;
const ROW_RESPONSE_LIMIT_BYTES = 400_000;
const TARGETS_RESPONSE_LIMIT_BYTES = 100_000;

export function useExtensionProfiles() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  const scope = useTradeScope("BRANCH", branchId);

  const [items, setItems] = useState<ExtensionProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [targetCode, setTargetCode] = useState<ExtensionTargetCode | undefined>(undefined);
  const [status, setStatus] = useState<ExtensionProfileStatus | undefined>(undefined);
  const [catalogue, setCatalogue] = useState<ExtensionTargetsCatalogue | null>(null);
  const [catalogueUnavailable, setCatalogueUnavailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canRead = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    EXTENSION_READ_PERMISSION,
  );
  const canManage = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    EXTENSION_MANAGE_PERMISSION,
  );

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setQueryError(null);
      // allSettled, not all: the targets catalogue and the profile list are two
      // sources, and losing the catalogue must not blank the list.
      const [listResult, catalogueResult] = await Promise.allSettled([
        tradeGet(extensionProfilesListPath(page, targetCode, status), {
          signal,
          headers: scope.headers,
          maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
        }),
        tradeGet(EXTENSION_TARGETS_PATH, {
          signal,
          headers: scope.headers,
          maxResponseBytes: TARGETS_RESPONSE_LIMIT_BYTES,
        }),
      ]);

      if (listResult.status === "fulfilled") {
        try {
          const parsed = parseExtensionProfilesResponse(listResult.value.data);
          setItems(parsed.items);
          setTotal(parsed.total);
          setHasLoaded(true);
        } catch (error) {
          setQueryError(normalizeApiError(error));
        }
      } else if (!isAbortError(listResult.reason)) {
        setQueryError(normalizeApiError(listResult.reason));
      }

      if (catalogueResult.status === "fulfilled") {
        try {
          setCatalogue(parseExtensionTargets(catalogueResult.value.data));
          setCatalogueUnavailable(false);
        } catch {
          setCatalogueUnavailable(true);
        }
      } else if (!isAbortError(catalogueResult.reason)) {
        setCatalogueUnavailable(true);
      }

      if (!signal?.aborted) setIsLoading(false);
    },
    [page, targetCode, status, scope.headers],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const create = useCallback(
    async (values: ExtensionProfileFormValues): Promise<boolean> => {
      if (!canManage || isSubmitting) return false;
      setIsSubmitting(true);
      setFormError(null);
      try {
        const response = await tradePost(
          EXTENSION_PROFILES_PATH,
          buildCreateExtensionProfileRequest(values),
          { headers: scope.headers, maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES },
        );
        setCreateOpen(false);
        toast.success(
          t.tradeCommon.savedTitle,
          isTradeReplay(response.headers)
            ? t.tradeCommon.replayedDescription
            : t.tradeAutomation.profileCreated,
        );
        await load();
        return true;
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status === 403) return false;
        if (toast.outcomeFromApi(normalized)) return false;
        setFormError(extensionMessage(normalized, t) ?? extensionFormMessage(error, t));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, isSubmitting, scope.headers, toast, t, load],
  );

  return {
    t,
    lang,
    canRead,
    canManage,
    branchIds,
    branchId,
    selectBranch,
    items,
    catalogue,
    catalogueUnavailable,
    pageInfo: { page, limit: EXTENSION_PAGE_SIZE, total },
    targetCode,
    status,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    queryError,
    createOpen,
    isSubmitting,
    formError,
    setPage,
    setTargetCode: (next: ExtensionTargetCode | undefined) => {
      setPage(1);
      setTargetCode(next);
    },
    setStatus: (next: ExtensionProfileStatus | undefined) => {
      setPage(1);
      setStatus(next);
    },
    openCreate: () => {
      setFormError(null);
      setCreateOpen(true);
    },
    closeCreate: () => {
      if (isSubmitting) return;
      setCreateOpen(false);
    },
    create,
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
