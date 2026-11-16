"use client";
import { Button } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";

export function MovementRetry({ retry, pending, onComplete }: {
  retry?: () => Promise<boolean>; pending: boolean; onComplete: (completed?: boolean) => void;
}) {
  const { t } = useI18n();
  if (!retry) return null;
  return <Button type="button" size="sm" variant="outline" loading={pending} disabled={pending}
    onClick={() => { void retry().then(saved => { if (saved) onComplete(true); }); }}>{t.tradeInventory.movementRetryOriginal}</Button>;
}
