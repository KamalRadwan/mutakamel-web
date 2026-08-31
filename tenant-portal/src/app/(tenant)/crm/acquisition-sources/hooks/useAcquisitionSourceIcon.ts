"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { TenantApiClientError, axiosClient } from "@/lib/api/axiosClient";
import {
  ACQUISITION_SOURCE_ICON_FIELD,
  acquisitionSourceIconPath,
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
  const [selected, setSelected] = useState<AcquisitionSource | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File): Promise<boolean> => {
    const target = selected;
    if (!target || isUploading) return false;
    if (!canManage) {
      setError(t.crmAcquisitionSources.iconForbidden);
      return false;
    }
    const rejection = classifyIconFile(file);
    if (rejection) {
      setError(rejectionMessage(rejection));
      return false;
    }
    setIsUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append(ACQUISITION_SOURCE_ICON_FIELD, file);
      const response = await axiosClient.post<unknown>(
        acquisitionSourceIconPath(target.id),
        body,
        { cache: "no-store", maxResponseBytes: 100_000 },
      );
      onUploaded(parseAcquisitionSourceResponse(response.data));
      setSelected(null);
      return true;
    } catch (caught) {
      setError(uploadMessage(caught));
      return false;
    } finally {
      setIsUploading(false);
    }
  };

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
      const { status } = caught.response;
      if (status === 413) return t.crmAcquisitionSources.iconTooLarge;
      if (status === 415) return t.crmAcquisitionSources.iconUnsupportedType;
      if (status === 400) return t.crmAcquisitionSources.iconMissing;
    }
    return caught instanceof Error && caught.message
      ? caught.message
      : t.crmAcquisitionSources.iconFailed;
  }

  return {
    selected,
    isUploading,
    error,
    select: (source: AcquisitionSource) => {
      if (!canManage) return;
      setError(null);
      setSelected(source);
    },
    close: () => {
      if (isUploading) return;
      setError(null);
      setSelected(null);
    },
    upload,
  };
}
