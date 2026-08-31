"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { useTenantBranchSelection } from "@/hooks/useTenantBranchSelection";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { tradeGet, tradeIfMatch, tradePatch, tradePost } from "../../../trade-api";
import { parseTradeOffsetPage } from "../../../trade-advanced-validation";
import { hasTradePermission, useTradeScope } from "../../../trade-advanced-scope";
import {
  EXTENSION_MANAGE_PERMISSION,
  EXTENSION_PUBLISH_PERMISSION,
  EXTENSION_READ_PERMISSION,
  buildUpdateExtensionProfileRequest,
  extensionFormMessage,
  extensionMessage,
  extensionProfileActionPath,
  extensionProfilePath,
  extensionProfileVersionsPath,
  invalidExtensionResponse,
  parseExtensionProfile,
  parseExtensionProfileDetail,
  toFieldDrafts,
  type ExtensionFieldDraft,
  type ExtensionProfile,
  type ExtensionProfileDetail,
} from "../../extension-contract";

const DETAIL_RESPONSE_LIMIT_BYTES = 800_000;

type PendingAction = "save" | "validate" | "publish" | null;

export function useExtensionProfile(id: string) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const { branchId } = useTenantBranchSelection(user);
  const scope = useTradeScope("BRANCH", branchId);

  const [profile, setProfile] = useState<ExtensionProfileDetail | null>(null);
  const [versions, setVersions] = useState<ExtensionProfile[]>([]);
  const [versionsUnavailable, setVersionsUnavailable] = useState(false);
  const [fields, setFields] = useState<ExtensionFieldDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [queryError, setQueryError] = useState<NormalizedApiError | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const canRead = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    EXTENSION_READ_PERMISSION,
  );
  // Validate is behind `.manage`, not a test grant — the controller says so.
  const canManage = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    EXTENSION_MANAGE_PERMISSION,
  );
  const canPublish = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    EXTENSION_PUBLISH_PERMISSION,
  );

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setQueryError(null);
      const [detailResult, versionsResult] = await Promise.allSettled([
        tradeGet(extensionProfilePath(id), {
          signal,
          headers: scope.headers,
          maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
        }),
        tradeGet(extensionProfileVersionsPath(id, 1), {
          signal,
          headers: scope.headers,
          maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
        }),
      ]);

      if (detailResult.status === "fulfilled") {
        try {
          const parsed = parseExtensionProfileDetail(detailResult.value.data);
          setProfile(parsed);
          // The draft is what a PATCH replaces; when there is none, the
          // published field set is the honest starting point for a new draft.
          setFields(
            toFieldDrafts(
              parsed.draftFields.length > 0 ? parsed.draftFields : parsed.currentPublishedFields,
            ),
          );
        } catch (error) {
          setQueryError(normalizeApiError(error));
        }
      } else if (!isAbortError(detailResult.reason)) {
        setQueryError(normalizeApiError(detailResult.reason));
      }

      if (versionsResult.status === "fulfilled") {
        try {
          setVersions(
            parseTradeOffsetPage(
              versionsResult.value.data,
              parseExtensionProfile,
              invalidExtensionResponse,
            ).items,
          );
          setVersionsUnavailable(false);
        } catch {
          setVersionsUnavailable(true);
        }
      } else if (!isAbortError(versionsResult.reason)) {
        setVersionsUnavailable(true);
      }

      if (!signal?.aborted) setIsLoading(false);
    },
    [id, scope.headers],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load]);

  const run = useCallback(
    async (action: PendingAction, call: () => Promise<unknown>): Promise<void> => {
      if (!profile || pending) return;
      setPending(action);
      setFormError(null);
      try {
        await call();
        toast.success(t.tradeCommon.savedTitle, t.tradeAutomation.profileActionApplied);
      } catch (error) {
        const normalized = normalizeApiError(error);
        if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
          setFormError(extensionMessage(normalized, t) ?? extensionFormMessage(error, t));
        }
      } finally {
        setPending(null);
        await load();
      }
    },
    [profile, pending, toast, t, load],
  );

  const ifMatch = (version: number) => ({
    ...scope.headers,
    "If-Match": tradeIfMatch(version),
  });

  return {
    t,
    lang,
    canRead,
    canManage,
    canPublish,
    profile,
    versions,
    versionsUnavailable,
    fields,
    setFields,
    isLoading,
    queryError,
    isNotFound: queryError?.status === 404,
    pending,
    formError,
    saveFields: () =>
      run("save", () =>
        tradePatch(
          extensionProfilePath(id),
          buildUpdateExtensionProfileRequest(fields),
          {
            headers: ifMatch(profile?.version ?? 0),
            maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
          },
        ),
      ),
    validate: () =>
      run("validate", () =>
        tradePost(extensionProfileActionPath(id, "validate"), undefined, {
          headers: ifMatch(profile?.version ?? 0),
          maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
        }),
      ),
    publish: () =>
      run("publish", () =>
        tradePost(extensionProfileActionPath(id, "publish"), undefined, {
          headers: ifMatch(profile?.version ?? 0),
          maxResponseBytes: DETAIL_RESPONSE_LIMIT_BYTES,
        }),
      ),
    reload: () => load(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
