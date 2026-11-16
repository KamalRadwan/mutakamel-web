import { ConfirmActionModal } from "@/design-system";
import type { UnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useI18n } from "@/i18n/I18nContext";

export function PriceBookLeaveDialog({ guard, unknownWrite }: { guard: UnsavedChangesGuard; unknownWrite: boolean }) {
  const { t } = useI18n();
  return <ConfirmActionModal open={guard.isDiscardOpen}
    onOpenChange={(open) => { if (!open) guard.cancelDiscard(); }}
    title={unknownWrite ? t.tradePricing.leaveUnknownTitle : t.common.discardTitle}
    description={unknownWrite ? t.tradePricing.leaveUnknownDescription : t.common.discardDescription}
    confirmLabel={unknownWrite ? t.tradePricing.leaveUnknownConfirm : t.common.discardConfirm}
    cancelLabel={t.common.cancel} onConfirm={guard.confirmDiscard} />;
}
