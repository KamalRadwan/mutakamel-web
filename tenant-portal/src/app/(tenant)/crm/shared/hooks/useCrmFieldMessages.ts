"use client";

import { useMemo } from "react";
import { useI18n } from "@/i18n/I18nContext";
import type { CrmFieldMessages } from "../crm-form-validation";

/**
 * The field-level messages every CRM create form shares.
 *
 * Assembled here rather than at each call site so "this field is required"
 * cannot end up worded four different ways across four screens — and so a form
 * that gains a URL or a phone check does not have to remember to add a message
 * for it. A screen with a rule of its own spreads this and adds that one key.
 *
 * Memoised on `t`, because it feeds `useCrmCreateForm`'s validator and a new
 * object every render would re-validate the whole form on every keystroke.
 */
export function useCrmFieldMessages(): CrmFieldMessages {
  const { t } = useI18n();
  return useMemo(
    () => ({
      required: t.crmShared.fieldRequired,
      email: t.crmShared.fieldEmail,
      maxLength: t.crmShared.fieldMaxLength,
      duplicatePhone: t.crmShared.fieldDuplicatePhone,
      url: t.crmShared.fieldUrl,
    }),
    [t],
  );
}
