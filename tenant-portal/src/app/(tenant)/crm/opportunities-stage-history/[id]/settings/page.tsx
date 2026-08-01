"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/I18nContext";

export default function OpportunitySettingsPage() {
    const { t } = useI18n();
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.crm.settingsAndRangeOfDiscount}</h2>
      <Input label={t.crm.maximumDiscountLimitAllowed} defaultValue="10%" />
      <Button variant="secondary">{t.crm.saveFacilities}</Button>
    </div>
  );
}
