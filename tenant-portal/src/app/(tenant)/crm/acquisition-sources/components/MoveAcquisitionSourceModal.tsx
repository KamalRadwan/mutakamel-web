"use client";

import { Field, FormModal, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { AcquisitionSource } from "../acquisition-source-contract";
import { useMoveAcquisitionSourceForm } from "../hooks/useMoveAcquisitionSourceForm";

interface MoveAcquisitionSourceModalProps {
  source: AcquisitionSource | null;
  items: AcquisitionSource[];
  isSubmitting: boolean;
  blocked: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (position: number) => Promise<boolean>;
}

export function MoveAcquisitionSourceModal({ source, items, isSubmitting, blocked, error, onClose, onSubmit }: MoveAcquisitionSourceModalProps) {
  const { t } = useI18n();
  const form = useMoveAcquisitionSourceForm(source, items, isSubmitting, blocked, onClose, onSubmit);
  return (
    <FormModal open={source !== null} onOpenChange={form.onOpenChange}
      title={t.crmAcquisitionSources.moveTitle} size="card" density="compact"
      isDirty={form.isDirty} isSubmitting={isSubmitting} submitDisabled={form.submitDisabled}
      onSubmit={() => void form.submit()} error={form.error ?? error ?? undefined}
      labels={{ submit: isSubmitting ? t.crmAcquisitionSources.saving : t.crmAcquisitionSources.move,
        cancel: t.common.cancel, discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel,
        sections: t.crmShared.formSectionsNav, sectionInvalid: t.crmShared.formSectionInvalid, close: t.common.close }}>
      <dl className="grid grid-cols-2 items-baseline gap-x-3 gap-y-2 text-xs">
        <dt className="text-muted-foreground">{t.crmAcquisitionSources.source}</dt>
        <dd className="flex min-w-0 flex-wrap justify-end gap-x-2 text-end text-foreground">
          <bdi dir="rtl" className="min-w-0 break-words">{source?.nameAr}</bdi>
          <bdi dir="ltr" className="min-w-0 break-words">{source?.nameEn}</bdi>
        </dd>
        <dt className="text-muted-foreground">{t.crmAcquisitionSources.currentPosition}</dt>
        <dd className="text-end tabular-nums">{form.currentPosition}</dd>
      </dl>
      <Field label={t.crmAcquisitionSources.movePosition} showLabel required error={form.error} hint={form.preview}>
        <Select value={form.position} onValueChange={form.setPosition} disabled={isSubmitting || blocked}>
          <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {form.positions.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
    </FormModal>
  );
}
