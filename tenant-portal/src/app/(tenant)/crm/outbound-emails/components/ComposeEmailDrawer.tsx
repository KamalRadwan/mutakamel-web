"use client";

import {
  Combobox, ConfirmActionModal, DegradedBanner, Field, FormDrawer,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { useI18n } from "@/i18n/I18nContext";
import { OUTBOUND_EMAIL_SOURCE_TYPES, type OutboundEmailRecipientReference, type OutboundEmailSourceType } from "../outbound-email-contract";
import type { useOutboundEmailComposer } from "../hooks/useOutboundEmailComposer";
import { useComposeEmailForm } from "../hooks/useComposeEmailForm";
import { ComposeEmailOptions } from "./ComposeEmailOptions";
import { EmailWriteNotice } from "./EmailWriteNotice";

interface ComposeEmailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  composer: ReturnType<typeof useOutboundEmailComposer>;
  error?: string;
  onSelectionChange: () => void;
  onReconcile: () => void;
  onSend: (sourceType: OutboundEmailSourceType, sourceId: string, recipient: OutboundEmailRecipientReference, templateVersionId: string | null) => void;
}

export function ComposeEmailDrawer({ open, onOpenChange, composer, error, onSend, onReconcile, onSelectionChange }: ComposeEmailDrawerProps) {
  const { t } = useI18n();
  const form = useComposeEmailForm(open, composer, onSelectionChange);
  return <>
    <FormDrawer open={open} onOpenChange={onOpenChange}
      title={t.crmOutboundEmails.composeTitle} description={t.crmOutboundEmails.composeDescription}
      isDirty={form.isDirty} isSubmitting={composer.isSending}
      submitDisabled={!form.canSend} error={composer.uncertain ? undefined : error}
      onSubmit={() => form.canSend && form.sourceId && form.recipient && onSend(form.sourceType, form.sourceId, form.recipient.reference, form.chosenTemplateVersionId || null)}
      labels={{
        submit: t.crmOutboundEmails.queueSend, cancel: t.common.cancel,
        discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel,
      }}>
      <div className="flex flex-col gap-4">
        {composer.uncertain && <EmailWriteNotice pending={composer.isSending} onCheck={onReconcile} />}
        <TenantBranchSelect branchIds={form.branchIds} branchId={form.branchId} onChange={form.changeBranch} disabled={form.frozen} />
        <Field showLabel label={t.crmOutboundEmails.sourceType}>
          <Select value={form.sourceType} onValueChange={form.changeType} disabled={form.frozen}>
            <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
            <SelectContent>{OUTBOUND_EMAIL_SOURCE_TYPES.map((type) => <SelectItem key={type} value={type}>{t.crmOutboundEmails.sourceTypeValues[type]}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field showLabel label={t.crmOutboundEmails.sourceRecord} required
          error={form.records.error ? t.crmOutboundEmails.recordsFailed : undefined}>
          <Combobox value={form.sourceId} selectedLabel={form.sourceLabel} onValueChange={form.changeSource}
            options={form.records.options} onSearch={form.records.search} loading={form.records.isLoading}
            disabled={form.frozen || !form.branchId}
            placeholder={t.crmOutboundEmails.sourceRecordPlaceholder} searchPlaceholder={t.common.search}
            loadingLabel={t.common.loading} emptyLabel={t.crmOutboundEmails.recordsEmpty} clearLabel={t.common.dismiss} />
        </Field>
        {!form.branchId && <p className="text-xs text-muted-foreground">{t.crmOutboundEmails.chooseBranch}</p>}
        {form.records.error?.status === 403 && <DegradedBanner message={t.crmOutboundEmails.sourceAccess} />}
        <ComposeEmailOptions composer={composer} form={form} />
        <p className="text-xs text-muted-foreground">{t.crmOutboundEmails.queuedNotice}</p>
      </div>
    </FormDrawer>
    <ConfirmActionModal open={form.navigation.isDiscardOpen} onOpenChange={form.navigation.cancelDiscard}
      title={t.common.discardTitle}
      description={composer.uncertain ? t.crmOutboundEmails.unknownOutcome : t.common.discardDescription}
      confirmLabel={composer.uncertain ? t.crmOutboundEmails.checkOriginal : t.common.discardConfirm}
      cancelLabel={t.common.cancel}
      loading={composer.isSending} onConfirm={composer.uncertain ? onReconcile : form.navigation.confirmDiscard} />
  </>;
}
