"use client";

import { Button, DegradedBanner } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

export function EmailWriteNotice({ pending, onCheck }: { pending: boolean; onCheck: () => void }) {
  const { t } = useI18n();
  return <div className="flex flex-col items-start gap-2" role="status">
    <DegradedBanner message={t.crmOutboundEmails.unknownOutcome} />
    <Button size="sm" variant="outline" onClick={onCheck} loading={pending}>{t.crmOutboundEmails.checkOriginal}</Button>
  </div>;
}
