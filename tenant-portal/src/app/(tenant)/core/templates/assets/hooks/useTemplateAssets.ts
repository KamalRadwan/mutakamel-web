"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useTenantAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  ACCESS_POLICY_BLOCKED_CODE,
  TEMPLATE_ASSETS_PERMISSION,
  TEMPLATE_READ_PERMISSION,
} from "../../templates-contract";
import {
  ASSET_CHECKSUM_MISMATCH_CODE,
  ASSET_EMAIL_PUBLIC_CODE,
  ASSET_FILE_MAX_BYTES,
  ASSET_IN_USE_CODE,
  ASSET_UPLOAD_INVALID_CODE,
  fetchTemplateAssets,
  retireTemplateAsset,
  sha256Hex,
  uploadTemplateAsset,
  type AssetDeliveryClass,
  type AssetSort,
  type AssetType,
  type TemplateAsset,
} from "../../template-assets-contract";
import { isExpiredCursor, useTemplateCursor } from "../../hooks/useTemplateCursor";

export interface AssetUploadValues {
  assetType: AssetType;
  deliveryClass: AssetDeliveryClass;
  file: File | null;
  /** Only meaningful for `EMAIL_PUBLIC`, and never pre-checked. */
  confirmedPublic: boolean;
}

export const EMPTY_ASSET_UPLOAD: AssetUploadValues = {
  assetType: "IMAGE",
  deliveryClass: "PRIVATE_ONLY",
  file: null,
  confirmedPublic: false,
};

export function useTemplateAssets() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { user } = useTenantAuth();
  const permissions = user?.permissions ?? [];
  const canRead = permissions.includes(TEMPLATE_READ_PERMISSION);
  const canManage = permissions.includes(TEMPLATE_ASSETS_PERMISSION);
  const copy = t.coreOperations.templates;

  const cursor = useTemplateCursor();
  const [items, setItems] = useState<TemplateAsset[]>([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [sort, setSort] = useState<AssetSort>("createdAt:desc");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isEntitlementBlocked, setIsEntitlementBlocked] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [retiring, setRetiring] = useState<TemplateAsset | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
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
      try {
        const page = await fetchTemplateAssets(
          { sort, ...(activeCursor ? { cursor: activeCursor } : {}) },
          signal,
        );
        setItems(page.items);
        setHasNextPage(page.hasNextPage);
        setNextCursor(page.nextCursor);
        setIsEntitlementBlocked(false);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        const normalized = normalizeApiError(caught);
        if (normalized.code === ACCESS_POLICY_BLOCKED_CODE) {
          setIsEntitlementBlocked(true);
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
    [canRead, sort, activeCursor, restart],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load, reloadToken]);

  const upload = useCallback(
    async (values: AssetUploadValues): Promise<boolean> => {
      if (!canManage || isSubmitting || !values.file) return false;
      if (values.file.size > ASSET_FILE_MAX_BYTES) {
        setFormError(copy.assetTooLarge);
        return false;
      }
      // EMAIL_PUBLIC means served unauthenticated, forever, to anyone with the
      // id. The server requires exactly one explicit confirmation and so does
      // this form — it is a separate decision, not a checkbox tucked into it.
      if (values.deliveryClass === "EMAIL_PUBLIC" && !values.confirmedPublic) {
        setFormError(copy.assetPublicConfirmationRequired);
        return false;
      }
      setIsSubmitting(true);
      setFormError(null);
      try {
        await uploadTemplateAsset(
          {
            definitionId: null,
            assetType: values.assetType,
            deliveryClass: values.deliveryClass,
            fileName: values.file.name.slice(0, 255),
            declaredMimeType: values.file.type === "image/jpeg" ? "image/jpeg" : "image/png",
            expectedRawSha256: await sha256Hex(values.file),
            ...(values.deliveryClass === "EMAIL_PUBLIC"
              ? { confirmPublicEmailDelivery: true as const }
              : {}),
          },
          values.file,
        );
        setIsUploadOpen(false);
        toast.success(copy.savedTitle, copy.assetUploaded);
        setReloadToken((token) => token + 1);
        return true;
      } catch (caught) {
        const normalized = normalizeApiError(caught);
        if (normalized.status === 403) return false;
        if (toast.outcomeFromApi(normalized)) return false;
        setFormError(assetMessage(normalized.code, copy) ?? copy.assetUploadFailed);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canManage, isSubmitting, toast, copy],
  );

  const retire = useCallback(async (): Promise<void> => {
    if (!retiring || !canManage || pendingId) return;
    setPendingId(retiring.id);
    try {
      await retireTemplateAsset(retiring.id, retiring.etag);
      toast.success(copy.savedTitle, copy.assetRetired);
      setReloadToken((token) => token + 1);
    } catch (caught) {
      const normalized = normalizeApiError(caught);
      if (normalized.status !== 403 && !toast.outcomeFromApi(normalized)) {
        const specific = assetMessage(normalized.code, copy);
        if (specific) toast.error(copy.assetRetireFailed, specific);
        else toast.errorFromApi(copy.assetRetireFailed, normalized);
      }
    } finally {
      setPendingId(null);
      setRetiring(null);
    }
  }, [retiring, canManage, pendingId, toast, copy]);

  return {
    t,
    lang,
    canRead,
    canManage,
    items,
    sort,
    isLoading: isLoading && canRead,
    error,
    isEntitlementBlocked,
    cursor,
    hasNextPage,
    isUploadOpen,
    isSubmitting,
    formError,
    retiring,
    pendingId,
    setSort: (next: AssetSort) => {
      cursor.restart(false);
      setSort(next);
    },
    goNext: () => cursor.advance(nextCursor),
    goBack: cursor.goBack,
    startOver: () => cursor.restart(false),
    openUpload: () => {
      setFormError(null);
      setIsUploadOpen(true);
    },
    closeUpload: () => {
      if (isSubmitting) return;
      setIsUploadOpen(false);
    },
    openRetire: (asset: TemplateAsset) => setRetiring(asset),
    closeRetire: () => {
      if (pendingId) return;
      setRetiring(null);
    },
    upload,
    retire,
    reload: () => setReloadToken((token) => token + 1),
  };
}

type TemplatesCopy = ReturnType<typeof useI18n>["t"]["coreOperations"]["templates"];

function assetMessage(code: string | undefined, copy: TemplatesCopy): string | undefined {
  if (code === ASSET_UPLOAD_INVALID_CODE) return copy.assetUploadInvalid;
  if (code === ASSET_EMAIL_PUBLIC_CODE) return copy.assetPublicConfirmationRequired;
  if (code === ASSET_CHECKSUM_MISMATCH_CODE) return copy.assetChecksumMismatch;
  if (code === ASSET_IN_USE_CODE) return copy.assetInUse;
  return undefined;
}
