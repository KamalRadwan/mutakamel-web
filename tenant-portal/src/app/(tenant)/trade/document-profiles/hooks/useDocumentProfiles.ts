"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isTradeReplay, tradeGet, tradeIfMatch, tradePost } from "../../trade-api";
import { hasTradePermission, useTradeScope } from "../../trade-advanced-scope";
import {
  DOCUMENT_PROFILES_PATH,
  DOCUMENT_PROFILE_MANAGE_PERMISSION,
  DOCUMENT_PROFILE_PAGE_SIZE,
  DOCUMENT_PROFILE_PUBLISH_PERMISSION,
  DOCUMENT_PROFILE_READ_PERMISSION,
  DOCUMENT_PROFILE_VALIDATE_PERMISSION,
  buildCreateDocumentProfileRequest,
  buildCreateDocumentProfileVersionRequest,
  buildPublishDocumentProfileVersionRequest,
  documentProfileFormMessage,
  documentProfileMessage,
  documentProfileVersionActionPath,
  documentProfileVersionsPath,
  documentProfilesListPath,
  parseDocumentProfilesResponse,
  type DocumentProfile,
  type DocumentProfileFormValues,
  type DocumentProfileVersion,
  type DocumentProfileVersionFormValues,
} from "../document-profile-contract";

const LIST_RESPONSE_LIMIT_BYTES = 1_000_000;
const ROW_RESPONSE_LIMIT_BYTES = 400_000;

export type DocumentProfileViewMode = "bento" | "table" | "split";

export function useDocumentProfiles() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchIds, branchId, selectBranch } = useTenantBranchSelection(user);
  const scope = useTradeScope("BRANCH", branchId);

  const [items, setItems] = useState<DocumentProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [documentType, setDocumentType] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<DocumentProfileViewMode>("bento");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [versionFor, setVersionFor] = useState<DocumentProfile | null>(null);
  const [publishFor, setPublishFor] = useState<DocumentProfileVersion | null>(null);
  const [publishProfile, setPublishProfile] = useState<DocumentProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const canRead = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    DOCUMENT_PROFILE_READ_PERMISSION,
  );
  const canManage = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    DOCUMENT_PROFILE_MANAGE_PERMISSION,
  );
  const canValidate = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    DOCUMENT_PROFILE_VALIDATE_PERMISSION,
  );
  const canPublish = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    DOCUMENT_PROFILE_PUBLISH_PERMISSION,
  );

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setQueryError(null);
      try {
        const response = await tradeGet(documentProfilesListPath(page, documentType), {
          signal,
          headers: scope.headers,
          maxResponseBytes: LIST_RESPONSE_LIMIT_BYTES,
        });
        const parsed = parseDocumentProfilesResponse(response.data);
        setItems(parsed.items);
        setTotal(parsed.total);
        setHasLoaded(true);
        if (parsed.items.length > 0) {
          setSelectedId((prev) =>
            prev && parsed.items.some((p) => p.id === prev) ? prev : parsed.items[0].id,
          );
        }
      } catch (error) {
        if (isAbortError(error)) return;
        setQueryError(normalizeApiError(error));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [page, documentType, scope.headers],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const submit = useCallback(
    async (operation: () => Promise<{ headers: Headers }>, success: string): Promise<boolean> => {
      setFormError(null);
      try {
        const response = await operation();
        toast.success(
          t.tradeCommon.savedTitle,
          isTradeReplay(response.headers) ? t.tradeCommon.replayedDescription : success,
        );
        return true;
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status === 403) return false;
        if (toast.outcomeFromApi(normalized)) return false;
        setFormError(documentProfileMessage(normalized, t) ?? documentProfileFormMessage(error, t));
        return false;
      }
    },
    [toast, t],
  );

  const createProfile = useCallback(
    async (values: DocumentProfileFormValues): Promise<boolean> => {
      if (!canManage || isSubmitting) return false;
      setIsSubmitting(true);
      const done = await submit(
        () =>
          tradePost(DOCUMENT_PROFILES_PATH, buildCreateDocumentProfileRequest(values), {
            headers: scope.headers,
            maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
          }),
        t.tradeGovernance.profileCreated,
      );
      setIsSubmitting(false);
      if (done) {
        setCreateOpen(false);
        await load();
      }
      return done;
    },
    [canManage, isSubmitting, submit, scope.headers, t, load],
  );

  const createVersion = useCallback(
    async (values: DocumentProfileVersionFormValues): Promise<boolean> => {
      if (!canManage || !versionFor || isSubmitting) return false;
      setIsSubmitting(true);
      const done = await submit(
        () =>
          tradePost(
            documentProfileVersionsPath(versionFor.id),
            buildCreateDocumentProfileVersionRequest(values),
            {
              headers: { ...scope.headers, "If-Match": tradeIfMatch(versionFor.version) },
              maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
            },
          ),
        t.tradeGovernance.profileVersionCreated,
      );
      setIsSubmitting(false);
      if (done) {
        setVersionFor(null);
        await load();
      }
      return done;
    },
    [canManage, versionFor, isSubmitting, submit, scope.headers, t, load],
  );

  const validateVersion = useCallback(
    async (version: DocumentProfileVersion): Promise<void> => {
      if (!canValidate || pendingId) return;
      setPendingId(version.id);
      await submit(
        () =>
          tradePost(documentProfileVersionActionPath(version.id, "validate"), undefined, {
            headers: { ...scope.headers, "If-Match": tradeIfMatch(version.version) },
            maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
          }),
        t.tradeGovernance.profileValidated,
      );
      setPendingId(null);
      await load();
    },
    [canValidate, pendingId, submit, scope.headers, t, load],
  );

  const publishVersion = useCallback(
    async (pointerVersion: string): Promise<boolean> => {
      if (!canPublish || !publishFor || pendingId) return false;
      setPendingId(publishFor.id);
      const done = await submit(
        () =>
          tradePost(
            documentProfileVersionActionPath(publishFor.id, "publish"),
            buildPublishDocumentProfileVersionRequest(pointerVersion),
            {
              headers: { ...scope.headers, "If-Match": tradeIfMatch(publishFor.version) },
              maxResponseBytes: ROW_RESPONSE_LIMIT_BYTES,
            },
          ),
        t.tradeGovernance.profilePublished,
      );
      setPendingId(null);
      if (done) {
        setPublishFor(null);
        setPublishProfile(null);
      }
      await load();
      return done;
    },
    [canPublish, publishFor, pendingId, submit, scope.headers, t, load],
  );

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.documentType.toLowerCase().includes(q) ||
        p.scopeTarget.toLowerCase().includes(q),
    );
  }, [items, search]);

  const selectedProfile = useMemo(
    () => filteredItems.find((p) => p.id === selectedId) ?? filteredItems[0] ?? null,
    [filteredItems, selectedId],
  );

  return {
    t,
    lang,
    canRead,
    canManage,
    canValidate,
    canPublish,
    branchIds,
    branchId,
    selectBranch,
    items: filteredItems,
    allItems: items,
    selectedProfile,
    selectedId,
    setSelectedId,
    viewMode,
    setViewMode,
    search,
    setSearch,
    pageInfo: { page, limit: DOCUMENT_PROFILE_PAGE_SIZE, total },
    documentType,
    isLoading: isLoading && !hasLoaded,
    isRefreshing: isLoading,
    queryError,
    createOpen,
    versionFor,
    publishFor,
    publishProfile,
    isSubmitting,
    formError,
    pendingId,
    setPage,
    setDocumentType: (next: string | undefined) => {
      setPage(1);
      setDocumentType(next);
    },
    openCreate: () => {
      setFormError(null);
      setCreateOpen(true);
    },
    closeCreate: () => {
      if (isSubmitting) return;
      setCreateOpen(false);
    },
    openVersion: (profile: DocumentProfile) => {
      setFormError(null);
      setVersionFor(profile);
    },
    closeVersion: () => {
      if (isSubmitting) return;
      setVersionFor(null);
    },
    openPublish: (version: DocumentProfileVersion, profile?: DocumentProfile) => {
      setFormError(null);
      setPublishFor(version);
      setPublishProfile(profile ?? null);
    },
    closePublish: () => {
      if (pendingId) return;
      setPublishFor(null);
      setPublishProfile(null);
    },
    createProfile,
    createVersion,
    validateVersion,
    publishVersion,
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
