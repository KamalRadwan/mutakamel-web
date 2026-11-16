"use client";

import { useI18n } from "@/i18n/I18nContext";
import type { NormalizedApiError } from "@/lib/api/errors";
import { useCrmErrorText } from "../../shared/hooks/useCrmErrorText";

export function useAcquisitionSourceErrors() {
  const { t } = useI18n();
  const crmErrorText = useCrmErrorText();
  return (error: NormalizedApiError) => {
    const labels: Record<string, string> = {
      CRM_ACQUISITION_SOURCE_NAME_TAKEN: t.crmAcquisitionSources.duplicateName,
      CRM_ACQUISITION_SOURCE_LIMIT_EXCEEDED: t.crmAcquisitionSources.limitReached,
      CRM_ACQUISITION_SOURCE_IN_USE: t.crmAcquisitionSources.deleteInUse,
      CRM_ACQUISITION_SOURCE_NOT_FOUND: t.crmAcquisitionSources.missingSource,
      CRM_ACQUISITION_SOURCE_REORDER_INVALID: t.crmAcquisitionSources.reorderFailed,
      CRM_ACQUISITION_SOURCE_ICON_REQUIRED: t.crmAcquisitionSources.iconMissing,
      CRM_ACQUISITION_SOURCE_ICON_EMPTY: t.crmAcquisitionSources.iconEmpty,
      CRM_ACQUISITION_SOURCE_ICON_TOO_LARGE: t.crmAcquisitionSources.iconTooLarge,
      CRM_ACQUISITION_SOURCE_ICON_TYPE_UNSUPPORTED: t.crmAcquisitionSources.iconUnsupportedType,
      CRM_ACQUISITION_SOURCE_ICON_EXTENSION_UNSUPPORTED: t.crmAcquisitionSources.iconExtensionMismatch,
      CRM_ACQUISITION_SOURCE_ICON_CONTENT_INVALID: t.crmAcquisitionSources.iconContentInvalid,
    };
    const fallback = error.status === 400 || error.status === 422
      ? t.crmShared.errorValidation
      : t.crmShared.errorGeneric;
    return (error.code && labels[error.code]) || crmErrorText({ ...error, message: fallback });
  };
}
