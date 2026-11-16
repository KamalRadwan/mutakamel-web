"use client";
import { Button, Field, FormModal, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { PeriodFormValues } from "../../inventory-governance-contract";
import { usePeriodForm } from "../hooks/usePeriodForm";

interface Props { isOpen: boolean; onClose: () => void; onSubmit: (values: PeriodFormValues) => Promise<boolean>; isSubmitting: boolean; error: string | null; initialValues?: PeriodFormValues; unresolved?: boolean; onRetryOriginal?: () => Promise<boolean>; canRetryOriginal?: boolean }
export function CreatePeriodModal({ isOpen, onClose, onSubmit, isSubmitting, error, initialValues, unresolved = false, onRetryOriginal, canRetryOriginal = false }: Props) {
  const { t } = useI18n();
  const form = usePeriodForm(onSubmit, initialValues);
  const inv = t.tradeInventory;
  const busy = isSubmitting || unresolved;
  return <FormModal open={isOpen} onOpenChange={(open) => { if (!open && (!unresolved || !canRetryOriginal)) { form.reset(); onClose(); } }} size="wide"
    title={inv.periodCreateTitle} description={inv.periodCreateDescription} isDirty={form.isDirty} isSubmitting={isSubmitting}
    onSubmit={() => void form.submit()} error={error ?? undefined}
    submitDisabled={unresolved} footerLeading={unresolved ? <div className="flex flex-col gap-2"><p role="status" className="text-caption text-muted-foreground">{inv.governanceUnknownWrite}</p><Button variant="outline" disabled={!canRetryOriginal || isSubmitting} onClick={() => void onRetryOriginal?.()}>{inv.governanceRetryOriginal}</Button></div> : undefined}
    labels={{ submit: inv.periodCreate, cancel: t.common.cancel, discardTitle: t.common.discardTitle, discardDescription: t.common.discardDescription,
      discardConfirm: t.common.discardConfirm, discardCancel: t.common.cancel, sections: inv.periodCreateTitle, sectionInvalid: t.common.cancel }}>
    <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
      <Field showLabel label={inv.periodCode} required hint={inv.codePatternHint} error={form.errors.code}><Input value={form.values.code} maxLength={40} disabled={isSubmitting} onChange={(event) => form.set({ code: event.target.value })} /></Field>
      <Field showLabel label={inv.periodMaxBackdateDays} required hint={inv.periodMaxBackdateHint} error={form.errors.maxBackdateDays}><Input type="number" min={0} max={366} value={form.values.maxBackdateDays} disabled={isSubmitting} onChange={(event) => form.set({ maxBackdateDays: event.target.value })} /></Field>
      <Field showLabel label={inv.periodStartsOn} required error={form.errors.startsOn}><Input type="date" value={form.values.startsOn} disabled={isSubmitting} onChange={(event) => form.set({ startsOn: event.target.value })} /></Field>
      <Field showLabel label={inv.periodEndsOn} required error={form.errors.endsOn}><Input type="date" min={form.values.startsOn || undefined} value={form.values.endsOn} disabled={isSubmitting} onChange={(event) => form.set({ endsOn: event.target.value })} /></Field>
    </fieldset>
    <p className="text-caption text-muted-foreground">{inv.periodUtcHint}</p>
  </FormModal>;
}
