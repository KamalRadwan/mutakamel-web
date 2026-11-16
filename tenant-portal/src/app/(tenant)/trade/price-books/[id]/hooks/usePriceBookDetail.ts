"use client";

import { useCallback, useMemo, useState } from "react";
import { replaceSearchParams, useConnectivity, useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";

import { isUuidV7 } from "../../../trade-advanced-validation";
import { hasTradePermission, useTradeScope } from "../../../trade-advanced-scope";
import {
  isTradeReplay,
  tradeDelete,
  tradeIfMatch,
  tradePatch,
  tradePost,
  type TradeResult,
} from "../../../trade-api";
import { usePricingReferenceData } from "../../hooks/usePricingReferenceData";
import {
  CONFIGURATION_MANAGE_PERMISSION,
  POLICY_PUBLISH_PERMISSION,
  PRICING_MANAGE_PERMISSION,
  PRICING_READ_PERMISSION,
  buildClonePriceBookVersionRequest,
  buildUpdatePriceBookRequest,
  companyDefaultPriceBookPath,
  companyDefaultPriceBookUpsertPath,
  priceBookCloneVersionPath,
  priceBookDetailPath,
  type ClonePriceBookVersionInput,
  type UpdatePriceBookInput,
} from "../../pricing-contract";
import { pricingFormMessage, pricingMessage } from "../../pricing-messages";
import {
  deriveVersionTemporalState,
  selectDefaultTimelineVersion,
} from "../../version-temporal";
import { usePricingMutation } from "../../workspace/usePricingMutation";
import { usePriceBookLoader } from "../../workspace/usePriceBookLoader";
import { usePricingClock } from "../../workspace/usePricingClock";
import { usePriceBookScopeOptions } from "../../hooks/usePriceBookScopeOptions";
import { useVersionWorkspaceController } from "../../workspace/useVersionWorkspaceController";


type BookAction = "updateBook" | "toggleDefault" | "createDraft";

function readInitialVersionQuery(): string | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("versionId");
  return raw && isUuidV7(raw) ? raw : null;
}

export function usePriceBookDetail(id: string) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const isOffline = useConnectivity().status === "offline";
  const { user, authState, realtimeAuthGeneration } = useTenantAuth();
  const scope = useTradeScope("COMPANY", null);
  const validId = isUuidV7(id);
  const companyId = scope.headers[COMPANY_SCOPE_HEADER] ?? null;

  const canRead = hasTradePermission(scope.permissions, scope.isTenantOwner, PRICING_READ_PERMISSION);
  const canManage = hasTradePermission(scope.permissions, scope.isTenantOwner, PRICING_MANAGE_PERMISSION);
  const canManageDefaults = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    CONFIGURATION_MANAGE_PERMISSION,
  );
  const canPublishOrRetire = hasTradePermission(
    scope.permissions,
    scope.isTenantOwner,
    POLICY_PUBLISH_PERMISSION,
  );

  const [actionError, setActionError] = useState<string | null>(null);
  const [requestedVersionId, setRequestedVersionId] = useState<string | null>(readInitialVersionQuery);


  const reference = usePricingReferenceData({
    enabled: validId && canRead && scope.isResolved,
    includeBooks: canManage,
  });

  const directory = usePriceBookScopeOptions();
  const companyName = directory.companyOptions.find(company => company.value === companyId)?.label ?? null;
  const readScopeKey = JSON.stringify([id, user?.id, realtimeAuthGeneration, scope.headers, scope.permissions, scope.isTenantOwner]);
  const { detail, isLoading, queryError, load } = usePriceBookLoader({
    id, scopeKey: readScopeKey, companyId, headers: scope.headers,
    enabled: validId && canRead && scope.isResolved,
  });
  const selectedVersion = useMemo(() => {
    if (!detail || detail.versions.length === 0) return null;
    if (requestedVersionId) {
      const found = detail.versions.find((v) => v.id === requestedVersionId);
      if (found) return found;
    }
    return selectDefaultTimelineVersion(detail.versions);
  }, [detail, requestedVersionId]);

  const selectVersion = useCallback((versionId: string | null) => {
    setRequestedVersionId(versionId);
    if (typeof window !== "undefined") {
      replaceSearchParams({ versionId });
    }
  }, []);

  const versionWorkspace = useVersionWorkspaceController({
    versionId: selectedVersion?.id ?? null,
    expectedBookId: detail?.book.id,
    onParentMutated: async () => {
      await load();
    },
    onVersionDeleted: (deletedId) => {
      if (requestedVersionId === deletedId) {
        selectVersion(null);
      }
    },
  });

  const bookScopeKey = JSON.stringify([user?.id, companyId, id]);
  const bookMutation = usePricingMutation<BookAction>({
    scopeKey: bookScopeKey,
    onSuccess: async (action, response: TradeResult) => {
      const replay = isTradeReplay(response.headers);
      if (action === "updateBook") {
        toast.success(
          t.tradeCommon.savedTitle,
          replay ? t.tradeCommon.replayedDescription : t.tradePricing.bookUpdated,
        );
      } else if (action === "toggleDefault") {
        toast.success(
          t.tradeCommon.savedTitle,
          replay
            ? t.tradeCommon.replayedDescription
            : detail?.book.isCompanyDefault
              ? t.tradePricing.defaultBookRemoved
              : t.tradePricing.defaultBookSaved,
        );
      } else if (action === "createDraft") {
        const body = response.data as Record<string, unknown> | null;
        const createdId = body && typeof body.id === "string" && isUuidV7(body.id) ? body.id : null;

        toast.success(
          t.tradeCommon.savedTitle,
          replay ? t.tradeCommon.replayedDescription : t.tradePricing.versionCloned,
        );
        if (createdId) selectVersion(createdId);
      }
      await load();
    },
    onRejected: (_action, normalized) => {
      const msg = pricingMessage(normalized, t) ?? normalized.message;
      setActionError(msg ?? t.tradeCommon.actionFailed);
      if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
        toast.error(t.tradeCommon.actionFailed, msg);
      }
    },
  });

  const updateMetadata = useCallback(
    async (patch: UpdatePriceBookInput): Promise<boolean> => {
      if (!detail || !canManage || isOffline || authState !== "AUTHENTICATED" || queryError) return false;
      if (patch.status === "INACTIVE" && detail.book.isCompanyDefault) {
        setActionError(t.tradePricing.cannotDeactivateDefault);
        return false;
      }
      setActionError(null);
      try {
        const body = buildUpdatePriceBookRequest(patch);
        const headers = { ...scope.headers, "If-Match": tradeIfMatch(detail.book.version) };
        return await bookMutation.run("updateBook", t.tradePricing.editBookDetails, (key) =>
          tradePatch(priceBookDetailPath(detail.book.id), body, {
            headers: { ...headers, "x-idempotency-key": key },
            maxResponseBytes: 250_000,
          }),
        );
      } catch (err) {
        setActionError(pricingFormMessage(err, t));
        return false;
      }
    },
    [detail, canManage, isOffline, authState, queryError, scope.headers, bookMutation, t],
  );

  const toggleCompanyDefault = useCallback(async (): Promise<boolean> => {
    if (!detail || !canManageDefaults || isOffline || authState !== "AUTHENTICATED" || queryError || (detail.book.status !== "ACTIVE" && !detail.book.isCompanyDefault)) return false;
    setActionError(null);
    const mapping = detail.companyDefaultMapping;
    if (detail.book.isCompanyDefault && mapping) {
      const headers = { ...scope.headers, "If-Match": tradeIfMatch(mapping.version) };
      return bookMutation.run("toggleDefault", t.tradePricing.removeCompanyDefault, (key) =>
        tradeDelete(companyDefaultPriceBookPath(detail.book.purpose, detail.book.currencyCode), {
          headers: { ...headers, "x-idempotency-key": key },
        }),
      );
    }
    const headers = { ...scope.headers, "If-Match": tradeIfMatch(mapping ? mapping.version : 0) };
    return bookMutation.run("toggleDefault", t.tradePricing.setAsCompanyDefault, (key) =>
      tradePost(
        companyDefaultPriceBookUpsertPath(detail.book.purpose, detail.book.currencyCode),
        { priceBookId: detail.book.id },
        { headers: { ...headers, "x-idempotency-key": key }, maxResponseBytes: 200_000 },
      ),
    );
  }, [detail, canManageDefaults, isOffline, authState, queryError, scope.headers, bookMutation, t.tradePricing]);

  const cloneOrSeedVersion = useCallback(
    async (input: ClonePriceBookVersionInput): Promise<boolean> => {
      if (!detail || !canManage || isOffline || authState !== "AUTHENTICATED" || queryError) return false;
      setActionError(null);

      try {
        const body = buildClonePriceBookVersionRequest(input);
        const headers = { ...scope.headers, "If-Match": tradeIfMatch(detail.book.version) };
        const ok = await bookMutation.run("createDraft", t.tradePricing.createNewDraft, (key) =>
          tradePost(priceBookCloneVersionPath(detail.book.id), body, {
            headers: { ...headers, "x-idempotency-key": key },
            maxResponseBytes: 300_000,
          }),
        );
        return ok;
      } catch (err) {
        setActionError(pricingFormMessage(err, t));
        return false;
      }
    },
    [detail, canManage, isOffline, authState, queryError, scope.headers, bookMutation, t],
  );

  const now = usePricingClock(detail?.versions.flatMap(version => [version.effectiveFrom, version.effectiveTo, version.supersededAt]) ?? []);
  const hasEffectiveVersionNow = useMemo(
    () => Boolean(detail?.versions.some((v) => deriveVersionTemporalState(v, now).isEffectiveNow)),
    [detail?.versions, now],
  );

  return {
    t, lang, user, scope, companyId, companyName, isOffline, validId,
    canRead, canManage, canManageDefaults, canPublishOrRetire,
    detail, isLoading, queryError,
    isNotFound: !validId || queryError?.status === 404,
    isDenied: !canRead || queryError?.status === 403 || versionWorkspace.error?.status === 403,
    isBusy: bookMutation.isBlocked,
    bookAmbiguous: bookMutation.ambiguous, bookPending: bookMutation.pending,
    actionError, clearActionError: () => setActionError(null),
    hasEffectiveVersionNow, selectedVersion, selectVersion,
    versionWorkspace, reference,
    updateMetadata, toggleCompanyDefault, cloneOrSeedVersion,
    reload: () => load(),
  };
}
