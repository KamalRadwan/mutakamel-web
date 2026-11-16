"use client";

import { ConfirmActionModal, Field, FormModal, Textarea } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { RETRY_REASON_MAX_LENGTH } from "../outbound-email-contract";
import type { useOutboundEmailDetailScreen } from "../hooks/useOutboundEmailDetailScreen";
import { EmailWriteNotice } from "./EmailWriteNotice";

export function RetryEmailModal({ screen }: { screen: ReturnType<typeof useOutboundEmailDetailScreen> }) {
  const { t, lang } = useI18n();
  const copy = t.crmOutboundEmails;
  return <>
    <FormModal size="card" open={screen.retryOpen} onOpenChange={screen.changeOpen}
      title={copy.retryTitle} description={copy.retryDescription}
      isDirty={screen.isDirty} isSubmitting={screen.detail.isRetrying}
      submitDisabled={!screen.detail.canRetry || screen.detail.uncertain}
      onSubmit={screen.submitRetry} error={screen.detail.uncertain ? undefined : screen.error}
      labels={{ submit: copy.queueRetry, cancel: t.common.cancel,
        discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel,
        sections: t.crmShared.formSectionsNav, sectionInvalid: t.crmShared.formSectionInvalid }}>
      <div className="flex flex-col gap-3">
        {screen.detail.uncertain && <EmailWriteNotice pending={screen.detail.isRetrying} onCheck={screen.reconcile} />}
        <Field showLabel label={copy.retryReason} hint={copy.retryReasonHint} error={screen.reasonError} required>
          <Textarea value={screen.reason} onChange={(event) => screen.changeReason(event.target.value)} onBlur={screen.blurReason}
            rows={4} disabled={screen.detail.isRetrying || screen.detail.uncertain} />
        </Field>
        <p className="text-end text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {formatNumber(screen.reasonCount, lang)}/{formatNumber(RETRY_REASON_MAX_LENGTH, lang)}
        </p>
      </div>
    </FormModal>
    <ConfirmActionModal open={screen.navigation.isDiscardOpen} onOpenChange={screen.navigation.cancelDiscard}
      title={t.common.discardTitle} description={screen.detail.uncertain ? copy.unknownOutcome : t.common.discardDescription}
      confirmLabel={screen.detail.uncertain ? copy.checkOriginal : t.common.discardConfirm} cancelLabel={t.common.cancel}
      loading={screen.detail.isRetrying} onConfirm={screen.detail.uncertain ? screen.reconcile : screen.navigation.confirmDiscard} />
  </>;
}
