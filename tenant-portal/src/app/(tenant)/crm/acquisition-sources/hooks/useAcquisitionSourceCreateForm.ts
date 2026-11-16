"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { validateAcquisitionSourceNames, type CreateAcquisitionSourceInput } from "../acquisition-source-contract";

export function useAcquisitionSourceCreateForm(
  onSubmit: (input: CreateAcquisitionSourceInput) => Promise<boolean>,
  onClose: () => void,
) {
  const { t } = useI18n();
  const [draft, setDraft] = useState({ nameAr: "", nameEn: "" });
  const [attempted, setAttempted] = useState(false);
  const failures = validateAcquisitionSourceNames(draft);
  const errors = {
    nameAr: attempted && failures.nameAr ? failures.nameAr === "required"
      ? t.crmAcquisitionSources.arabicRequired : t.crmAcquisitionSources.nameTooLong : undefined,
    nameEn: attempted && failures.nameEn ? failures.nameEn === "required"
      ? t.crmAcquisitionSources.englishRequired : t.crmAcquisitionSources.nameTooLong : undefined,
  };
  return {
    draft, setDraft, errors,
    isDirty: draft.nameAr !== "" || draft.nameEn !== "",
    error: errors.nameAr || errors.nameEn,
    close: () => { setDraft({ nameAr: "", nameEn: "" }); setAttempted(false); onClose(); },
    submit: async () => {
      setAttempted(true);
      if (failures.nameAr || failures.nameEn) return;
      if (await onSubmit(draft)) { setDraft({ nameAr: "", nameEn: "" }); setAttempted(false); }
    },
  };
}
