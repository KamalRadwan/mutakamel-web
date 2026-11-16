"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useToast } from "@/design-system";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { useAcquisitionSourceErrors } from "./useAcquisitionSourceErrors";
import {
  acquisitionSourcePath,
  buildUpdateAcquisitionSourceRequest,
  parseAcquisitionSourceResponse,
  validateAcquisitionSourceNames,
  type AcquisitionSource,
  type UpdateAcquisitionSourceInput,
} from "../acquisition-source-contract";

export function useAcquisitionSourceEdit(
  canManage: boolean,
  onSaved: (source: AcquisitionSource) => void,
  reload: () => Promise<boolean>,
) {
  const { t } = useI18n();
  const sourceErrorText = useAcquisitionSourceErrors();
  const toast = useToast();
  const [selected, setSelected] = useState<AcquisitionSource | null>(null);
  const [draft, setDraft] = useState<UpdateAcquisitionSourceInput>({ nameAr: "", nameEn: "", isActive: true });
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<NormalizedApiError | null>(null);
  const [namesError, setNamesError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);

  async function save() {
    if (!selected || saving.current) return;
    if (!canManage) { setApiError(null); setError(t.crmAcquisitionSources.iconForbidden); return; }
    let payload: UpdateAcquisitionSourceInput;
    try {
      payload = buildUpdateAcquisitionSourceRequest(draft);
    } catch {
      setNamesError(t.crmAcquisitionSources.invalidNames);
      return;
    }
    saving.current = true;
    setIsSaving(true);
    setError(null);
    setApiError(null);
    setNamesError(null);
    try {
      const response = await axiosClient.patch<unknown>(acquisitionSourcePath(selected.id), payload, {
        cache: "no-store", nonReplayable: true, skipAutoIdempotency: true, maxResponseBytes: 100_000,
      });
      const updated = parseAcquisitionSourceResponse(response.data);
      if (updated.id !== selected.id) throw new Error("Unexpected acquisition-source id.");
      onSaved(updated);
      setSelected(null);
      toast.success(t.crmAcquisitionSources.saved);
    } catch (caught) {
      if (!(caught instanceof TenantApiClientError) || caught.response.status === 0 || caught.response.status >= 500) {
        const refreshed = await reload();
        setSelected(null);
        setError(refreshed ? t.crmAcquisitionSources.editUncertain : t.crmAcquisitionSources.editUncertainStale);
      } else {
        setApiError(normalizeApiError(caught));
        if (caught.response.status === 404) {
          setSelected(null);
          await reload();
        }
      }
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  const failures = validateAcquisitionSourceNames(draft);
  const duplicate = apiError?.code === "CRM_ACQUISITION_SOURCE_NAME_TAKEN";
  const fieldErrors = {
    nameAr: duplicate ? t.crmAcquisitionSources.duplicateName : namesError && failures.nameAr
      ? failures.nameAr === "required" ? t.crmAcquisitionSources.arabicRequired : t.crmAcquisitionSources.nameTooLong : undefined,
    nameEn: duplicate ? t.crmAcquisitionSources.duplicateName : namesError && failures.nameEn
      ? failures.nameEn === "required" ? t.crmAcquisitionSources.englishRequired : t.crmAcquisitionSources.nameTooLong : undefined,
  };
  return {
    selected, draft, setDraft,
    error: apiError ? sourceErrorText(apiError) ?? t.crmAcquisitionSources.editFailed : error,
    namesError, fieldErrors, isSaving, save,
    isDirty: !!selected && (draft.nameAr !== selected.nameAr || draft.nameEn !== selected.nameEn || draft.isActive !== selected.isActive),
    select: (source: AcquisitionSource) => {
      if (!canManage || saving.current) return;
      setSelected(source);
      setDraft({ nameAr: source.nameAr, nameEn: source.nameEn, isActive: source.isActive });
      setError(null);
      setApiError(null);
      setNamesError(null);
    },
    close: () => {
      if (saving.current) return;
      setSelected(null);
      setError(null);
      setApiError(null);
    },
  };
}
