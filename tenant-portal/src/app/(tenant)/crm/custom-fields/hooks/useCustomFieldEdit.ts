"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { customFieldPath, parseCrmCustomField, type CustomFieldItem, type UpdateCustomFieldInput } from "../custom-field-contract";

export function useCustomFieldEdit(
  canManage: boolean,
  onSaved: (field: CustomFieldItem) => void,
  reload: () => Promise<boolean>,
) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<CustomFieldItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);

  async function save(input: UpdateCustomFieldInput): Promise<boolean> {
    if (!selected || saving.current) return false;
    if (!canManage) { setError(t.crmCustomFields.editForbidden); return false; }
    saving.current = true;
    setIsSaving(true);
    setError(null);
    try {
      // Whitelist metadata: fieldKey, ownerType and type remain fixed in this editor.
      const payload: UpdateCustomFieldInput = { nameAr: input.nameAr.trim(), nameEn: input.nameEn.trim(),
        isActive: input.isActive, isSearchable: input.isSearchable,
        ...(input.options ? { options: input.options } : {}) };
      const response = await axiosClient.patch<unknown>(customFieldPath(selected.id), payload, {
        cache: "no-store", nonReplayable: true, skipAutoIdempotency: true, maxResponseBytes: 250_000,
      });
      const updated = parseCrmCustomField(response.data);
      if (updated.id !== selected.id) throw new Error("Unexpected custom-field id.");
      // PATCH does not attach requirement rows; retain the list's confirmed flags.
      onSaved({ ...updated, requirements: selected.requirements });
      setSelected(null);
      return true;
    } catch (caught) {
      if (!(caught instanceof TenantApiClientError) || caught.response.status === 0 || caught.response.status >= 500) {
        const refreshed = await reload();
        setSelected(null);
        setError(refreshed ? t.crmCustomFields.editUncertain : t.crmCustomFields.editUncertainStale);
      } else if (normalizeApiError(caught).code === "CUSTOM_FIELD_OPTION_IN_USE") {
        setError(t.crmCustomFields.optionInUse);
      } else {
        setError(caught.message || t.crmCustomFields.editFailed);
      }
      return false;
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  return {
    selected, error, isSaving, save,
    select: (field: CustomFieldItem) => {
      if (!canManage || saving.current) return;
      setSelected(field);
      setError(null);
    },
    close: () => {
      if (saving.current) return;
      setSelected(null);
      setError(null);
    },
  };
}
