"use client";

import { useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TenantApiClientError, axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { generateUUIDv7 } from "@/lib/uuid";
import { useAcquisitionSourceErrors } from "./useAcquisitionSourceErrors";
import {
  ACQUISITION_SOURCE_ICON_FIELD,
  acquisitionSourceIconPath,
  acquisitionSourcePath,
  classifyIconFile,
  parseAcquisitionSourceResponse,
  type AcquisitionSource,
  type IconRejection,
} from "../acquisition-source-contract";

/**
 * `POST /acquisition-sources/:id/icon` — multipart, field name `file`.
 *
 * Split out of `useAcquisitionSources` because it is a separate
 * responsibility with its own state, its own transport shape (multipart, not
 * JSON) and its own failure vocabulary: the controller answers **three**
 * distinct statuses and they must read as three distinct messages —
 * **400** for a missing or empty file, **413** for one over 2 MB, and **415**
 * for an unsupported type, a filename whose extension does not match its type,
 * or content that does not match the type it declares.
 *
 * Size and type are checked locally first, so the two failures that can be
 * known without a round trip cost none. The server still re-checks every one
 * of them, including the magic-byte test this cannot do.
 */
export function useAcquisitionSourceIcon(
  canManage: boolean,
  onUploaded: (source: AcquisitionSource) => void,
) {
  const { t } = useI18n();
  const sourceErrorText = useAcquisitionSourceErrors();
  const toast = useToast();
  const busy = useRef(false);
  const attempt = useRef<{ sourceId: string; file: File; key: string } | null>(null);
  const [selected, setSelected] = useState<AcquisitionSource | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUncertain, setIsUncertain] = useState(false);
  const [reconcileOnly, setReconcileOnly] = useState(false);

  const upload = async (file: File): Promise<boolean> => {
    const target = selected;
    if (!target || busy.current || reconcileOnly) return false;
    if (!canManage) {
      setError(t.crmAcquisitionSources.iconForbidden);
      return false;
    }
    const rejection = classifyIconFile(file);
    if (rejection) {
      setError(rejectionMessage(rejection));
      return false;
    }
    if (isUncertain && attempt.current?.file !== file) return false;
    if (attempt.current?.sourceId !== target.id || attempt.current.file !== file) {
      attempt.current = { sourceId: target.id, file, key: generateUUIDv7() };
    }
    busy.current = true;
    setIsUploading(true);
    setError(null);
    let received = false;
    try {
      const body = new FormData();
      body.append(ACQUISITION_SOURCE_ICON_FIELD, file);
      const response = await axiosClient.post<unknown>(
        acquisitionSourceIconPath(target.id),
        body,
        { cache: "no-store", nonReplayable: true, maxResponseBytes: 100_000, headers: { "x-idempotency-key": attempt.current.key } },
      );
      received = true;
      const updated = parseAcquisitionSourceResponse(response.data);
      if (updated.id !== target.id) throw new Error("Unexpected acquisition-source id.");
      onUploaded(updated);
      setSelected(null);
      setIsUncertain(false);
      setReconcileOnly(false);
      attempt.current = null;
      toast.success(t.crmAcquisitionSources.iconSaved);
      return true;
    } catch (caught) {
      const failure = normalizeApiError(caught);
      if (!(caught instanceof TenantApiClientError) || failure.status === 0 || failure.status >= 500) {
        setIsUncertain(true);
        setReconcileOnly(received);
        setError(received ? t.crmAcquisitionSources.iconUnreadable : t.crmAcquisitionSources.iconUncertain);
      } else {
        setIsUncertain(false);
        setError(uploadMessage(caught));
      }
      return false;
    } finally {
      busy.current = false;
      setIsUploading(false);
    }
  };

  async function reconcile() {
    if (!selected || busy.current) return;
    busy.current = true;
    setIsUploading(true);
    try {
      const response = await axiosClient.get<unknown>(acquisitionSourcePath(selected.id), { cache: "no-store", maxResponseBytes: 100_000 });
      const current = parseAcquisitionSourceResponse(response.data);
      if (current.id !== selected.id) throw new Error("Unexpected acquisition-source id.");
      onUploaded(current);
      setSelected(null);
      setIsUncertain(false);
      setReconcileOnly(false);
      attempt.current = null;
      toast.warning(t.crmAcquisitionSources.iconReviewed);
    } catch (caught) {
      setError(sourceErrorText(normalizeApiError(caught)) ?? t.crmAcquisitionSources.iconFailed);
    } finally { busy.current = false; setIsUploading(false); }
  }

  function rejectionMessage(rejection: IconRejection): string {
    if (rejection === "empty") return t.crmAcquisitionSources.iconEmpty;
    if (rejection === "tooLarge") return t.crmAcquisitionSources.iconTooLarge;
    if (rejection === "extensionMismatch") {
      return t.crmAcquisitionSources.iconExtensionMismatch;
    }
    return t.crmAcquisitionSources.iconUnsupportedType;
  }

  /** Maps the upload route's own statuses onto its three distinct messages. */
  function uploadMessage(caught: unknown): string {
    if (caught instanceof TenantApiClientError) {
      const failure = normalizeApiError(caught);
      if (failure.code) {
        const specific = sourceErrorText(failure);
        if (specific) return specific;
      }
      const { status } = caught.response;
      if (status === 413) return t.crmAcquisitionSources.iconTooLarge;
      if (status === 415) return t.crmAcquisitionSources.iconUnsupportedType;
      if (status === 400) return t.crmAcquisitionSources.iconMissing;
      return sourceErrorText(failure) ?? t.crmAcquisitionSources.iconFailed;
    }
    return t.crmAcquisitionSources.iconFailed;
  }

  return {
    selected,
    isUploading,
    error, isUncertain, reconcileOnly, reconcile,
    select: (source: AcquisitionSource) => {
      if (!canManage || busy.current) return;
      attempt.current = null;
      setIsUncertain(false);
      setReconcileOnly(false);
      setError(null);
      setSelected(source);
    },
    close: () => {
      if (busy.current) return;
      attempt.current = null;
      setIsUncertain(false);
      setReconcileOnly(false);
      setError(null);
      setSelected(null);
    },
    upload,
  };
}
