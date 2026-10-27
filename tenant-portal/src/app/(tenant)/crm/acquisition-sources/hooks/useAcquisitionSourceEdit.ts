"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import {
  acquisitionSourcePath,
  buildUpdateAcquisitionSourceRequest,
  parseAcquisitionSourceResponse,
  type AcquisitionSource,
  type UpdateAcquisitionSourceInput,
} from "../acquisition-source-contract";

export function useAcquisitionSourceEdit(
  canManage: boolean,
  onSaved: (source: AcquisitionSource) => void,
  reload: () => Promise<boolean>,
) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<AcquisitionSource | null>(null);
  const [draft, setDraft] = useState<UpdateAcquisitionSourceInput>({ nameAr: "", nameEn: "", isActive: true });
  const [error, setError] = useState<string | null>(null);
  const [namesError, setNamesError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);

  async function save() {
    if (!selected || saving.current) return;
    if (!canManage) { setError(t.crmAcquisitionSources.iconForbidden); return; }
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
    setNamesError(null);
    try {
      const response = await axiosClient.patch<unknown>(acquisitionSourcePath(selected.id), payload, {
        cache: "no-store", nonReplayable: true, skipAutoIdempotency: true, maxResponseBytes: 100_000,
      });
      const updated = parseAcquisitionSourceResponse(response.data);
      if (updated.id !== selected.id) throw new Error("Unexpected acquisition-source id.");
      onSaved(updated);
      setSelected(null);
    } catch (caught) {
      if (!(caught instanceof TenantApiClientError) || caught.response.status === 0 || caught.response.status >= 500) {
        const refreshed = await reload();
        setSelected(null);
        setError(refreshed ? t.crmAcquisitionSources.editUncertain : t.crmAcquisitionSources.editUncertainStale);
      } else {
        setError(caught.message || t.crmAcquisitionSources.editFailed);
      }
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  return {
    selected, draft, setDraft, error, namesError, isSaving, save,
    isDirty: !!selected && (draft.nameAr !== selected.nameAr || draft.nameEn !== selected.nameEn || draft.isActive !== selected.isActive),
    select: (source: AcquisitionSource) => {
      if (!canManage || saving.current) return;
      setSelected(source);
      setDraft({ nameAr: source.nameAr, nameEn: source.nameEn, isActive: source.isActive });
      setError(null);
      setNamesError(null);
    },
    close: () => {
      if (saving.current) return;
      setSelected(null);
      setError(null);
    },
  };
}
