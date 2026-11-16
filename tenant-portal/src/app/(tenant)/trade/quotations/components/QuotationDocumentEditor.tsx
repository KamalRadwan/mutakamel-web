"use client";

import type { KeyboardEvent } from "react";
import { RefreshCw } from "lucide-react";
import { Button, DatePicker, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, Field, Input, NameSelect } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import type { QuotationComposerState } from "../hooks/useQuotationComposer";
import type { QuotationFieldEditorState } from "../hooks/useQuotationFieldEditor";

export function QuotationDocumentEditor({ editor, composer }: {
  editor: QuotationFieldEditorState; composer: QuotationComposerState;
}) {
  const { t } = useI18n();
  const currencies = composer.currencies;
  return <Dialog open={editor.open} onOpenChange={editor.setOpen}><DialogContent size="lg" className="gap-4 p-5">
    <DialogHeader><DialogTitle>{t.quotationFlow.editDocument}</DialogTitle><DialogDescription>{t.quotationFlow.documentReferenceHint}</DialogDescription></DialogHeader>
    <div className="grid gap-3.5 sm:grid-cols-2">
      <Field label={t.tradeDocuments.currency} required={!editor.headerLocked} readOnly={editor.headerLocked} showLabel>
        {editor.headerLocked ? <Input size="sm" dir="ltr" readOnly value={editor.draft.currencyCode} /> : <NameSelect size="sm" options={currencies.options} value={editor.draft.currencyCode || undefined}
          onValueChange={(value) => editor.change({ currencyCode: value })} placeholder={t.tradeDocuments.currency}
          disabled={editor.blocked || currencies.loading || !currencies.canRead} className="w-full" />}
      </Field>
      <Field label={t.quotationExperience.validity} required showLabel error={!editor.dateValid ? t.quotationFlow.invalidDate : undefined}>
        <DatePicker size="sm" value={editor.dateValue} onValueChange={editor.selectDate} placeholder={t.quotationExperience.validity} disabled={editor.blocked} />
      </Field>
      <Field label={t.quotationFlow.documentReferenceOptional} readOnly={editor.headerLocked} showLabel hint={t.quotationFlow.documentReferenceHint} className="sm:col-span-2">
        <Input size="sm" dir="ltr" value={editor.draft.draftReference} maxLength={80} readOnly={editor.headerLocked} disabled={editor.blocked}
          onChange={(event) => editor.change({ draftReference: event.target.value })} />
      </Field>
    </div>
    {currencies.loading && !editor.headerLocked ? <p role="status" className="text-xs text-muted-foreground">{t.common.loading}</p> : null}
    {!editor.headerLocked && (currencies.error || !currencies.canRead || (!currencies.loading && !currencies.options.length)) ? <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-xs text-warning-subtle-foreground"><p>{t.quotationFlow.currencyUnavailable}</p>{currencies.canRead ? <Button variant="outline" size="xs" onClick={currencies.retry}><RefreshCw className="size-3.5" aria-hidden="true" />{t.common.retry}</Button> : null}</div> : null}
    <DialogFooter><Button variant="outline" size="sm" disabled={editor.blocked} onClick={() => editor.setOpen(false)}>{t.common.cancel}</Button><Button variant="primary" size="sm" disabled={!editor.canApply} onClick={editor.apply}>{t.quotationFlow.applyChanges}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

export function QuotationTermsEditor({
  editor,
  inline = false,
  readOnly = false,
}: {
  editor: QuotationFieldEditorState;
  inline?: boolean;
  readOnly?: boolean;
}) {
  const { t } = useI18n();
  const c = t.quotationExperience;
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !readOnly && editor.canApply) {
      event.preventDefault();
      editor.apply();
    }
  };
  const fields = <div className={inline ? "grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4" : "grid gap-4 sm:grid-cols-2"}>
    <Field label={c.paymentTerm} readOnly={readOnly} showLabel className="gap-1">
      <Input size="sm" dir="ltr" readOnly={readOnly} disabled={editor.blocked} value={editor.draft.paymentTermCode} maxLength={80}
        onKeyDown={onKeyDown} onChange={(event) => editor.change({ paymentTermCode: event.target.value })} />
    </Field>
    <Field label={c.incoterm} readOnly={readOnly} showLabel className="gap-1">
      <Input size="sm" dir="ltr" readOnly={readOnly} disabled={editor.blocked} value={editor.draft.incotermCode} maxLength={80}
        onKeyDown={onKeyDown} onChange={(event) => editor.change({ incotermCode: event.target.value })} />
    </Field>
    <Field label={c.deliveryDays} readOnly={readOnly} showLabel error={!editor.deliveryValid ? t.tradeDocuments.executive.revisionTermIntegerInvalid : undefined} className="gap-1">
      <Input size="sm" inputMode="numeric" dir="ltr" readOnly={readOnly} disabled={editor.blocked} value={editor.draft.deliveryDays} maxLength={10}
        onKeyDown={onKeyDown} onChange={(event) => editor.change({ deliveryDays: event.target.value })} />
    </Field>
    <Field label={c.warrantyMonths} readOnly={readOnly} showLabel error={!editor.warrantyValid ? t.tradeDocuments.executive.revisionTermIntegerInvalid : undefined} className="gap-1">
      <Input size="sm" inputMode="numeric" dir="ltr" readOnly={readOnly} disabled={editor.blocked} value={editor.draft.warrantyMonths} maxLength={10}
        onKeyDown={onKeyDown} onChange={(event) => editor.change({ warrantyMonths: event.target.value })} />
    </Field>
  </div>;

  if (inline) {
    return <div className="space-y-2 border-t border-border px-3 py-2.5">
      {fields}
      {!readOnly ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{c.termsDescription}</p>
          <div className="ms-auto flex items-center gap-1.5">
            <Button variant="ghost" size="xs" disabled={editor.blocked} onClick={() => editor.setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button variant="outline" size="xs" disabled={!editor.canApply} onClick={editor.apply}>
              {t.quotationFlow.applyChanges}
            </Button>
          </div>
        </div>
      ) : null}
    </div>;
  }

  return <Dialog open={editor.open} onOpenChange={editor.setOpen}><DialogContent size="lg" className="gap-4 p-5">
    <DialogHeader><DialogTitle>{t.quotationFlow.editTerms}</DialogTitle><DialogDescription>{c.termsDescription}</DialogDescription></DialogHeader>
    {fields}
    <DialogFooter><Button variant="outline" size="sm" disabled={editor.blocked} onClick={() => editor.setOpen(false)}>{t.common.cancel}</Button><Button variant="primary" size="sm" disabled={!editor.canApply} onClick={editor.apply}>{t.quotationFlow.applyChanges}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
