"use client";

import {
  Checkbox,
  Field,
  FormDrawer,
  IdentifierText,
  Input,
  Money,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TradeWriteOutcome } from "../../documents/components/TradeBoundaryStates";
import type { QuotationDetail } from "../quotation-contract";
import { useConvertQuotation } from "../hooks/useConvertQuotation";

export interface ConvertQuotationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: QuotationDetail;
  headers: Record<string, string>;
  onConverted: () => Promise<void>;
}

export function ConvertQuotationDrawer(props: ConvertQuotationDrawerProps) {
  // A newly opened drawer or refreshed version must collect and review its own evidence.
  return <ConversionForm key={`${props.quotation.id}:${props.quotation.version}:${props.open}`} {...props} />;
}

function ConversionForm(props: ConvertQuotationDrawerProps) {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const copy = td.quotationConversion;
  const form = useConvertQuotation(props);
  const { quotation } = props;

  return (
    <FormDrawer
      open={props.open}
      onOpenChange={(next) => { if (!form.locked) props.onOpenChange(next); }}
      title={td.executive.convertTitle}
      description={copy.description}
      isDirty={form.isDirty}
      isSubmitting={form.write.isWriting}
      submitDisabled={form.locked || !form.payload || !form.reviewed}
      onSubmit={() => void form.handleSubmit()}
      labels={{
        submit: td.executive.convertSubmit,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
      }}
    >
      <TradeWriteOutcome write={form.write} />
      <Field label={td.documentNumber} showLabel readOnly>
        <Input readOnly value={quotation.documentNumber ?? quotation.draftReference ?? quotation.id} />
      </Field>
      {form.error ? <p role="status" className="text-sm text-destructive">{form.error}</p> : null}
      <fieldset disabled={form.locked} className="space-y-4">
        <legend className="mb-2 text-sm font-medium">{td.taxEvidence}</legend>
        {quotation.currentLines.map((line, index) => {
          const draft = form.evidence[index];
          if (!draft) return null;
          const financial = form.payload?.lines[index]?.financial;
          return (
            <fieldset key={line.clientLineId} className="space-y-3 rounded-md border border-border p-3">
              <legend className="px-1 text-sm font-medium">{line.descriptionSnapshot}</legend>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted-foreground">{td.quantity}</dt><dd><Money value={line.quantity} minimumFractionDigits={0} maximumFractionDigits={8} /></dd></div>
                <div><dt className="text-muted-foreground">{td.unitPrice}</dt><dd><Money value={line.unitPrice} currency={quotation.currencyCode} maximumFractionDigits={8} /></dd></div>
              </dl>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={td.totals.discountTotal} showLabel required>
                  <Input inputMode="decimal" value={draft.discountTotal} onChange={(e) => form.updateEvidence(line.clientLineId, "discountTotal", e.target.value)} />
                </Field>
                <Field label={td.totals.chargeTotal} showLabel required>
                  <Input inputMode="decimal" value={draft.chargeTotal} onChange={(e) => form.updateEvidence(line.clientLineId, "chargeTotal", e.target.value)} />
                </Field>
                <Field label={td.executive.taxCodeLabel} showLabel required>
                  <Input maxLength={120} value={draft.taxCode} onChange={(e) => form.updateEvidence(line.clientLineId, "taxCode", e.target.value)} />
                </Field>
                <Field label={copy.category} showLabel required>
                  <Select disabled={form.locked} value={draft.category} onValueChange={(value) => form.updateEvidence(line.clientLineId, "category", value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STANDARD">{td.executive.taxCategoryStandard}</SelectItem>
                      <SelectItem value="ZERO">{td.executive.taxCategoryZero}</SelectItem>
                      <SelectItem value="EXEMPT">{td.executive.taxCategoryExempt}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={td.executive.taxRatePercentLabel} hint={copy.rateHint} showLabel required>
                  <Input inputMode="decimal" value={draft.ratePercent} onChange={(e) => form.updateEvidence(line.clientLineId, "ratePercent", e.target.value)} />
                </Field>
              </div>
              {financial ? (
                <dl className="grid grid-cols-2 gap-3 text-sm" aria-live="polite">
                  <div><dt className="text-muted-foreground">{td.totals.taxTotal}</dt><dd><Money value={financial.taxTotal} currency={quotation.currencyCode} maximumFractionDigits={8} /></dd></div>
                  <div><dt className="text-muted-foreground">{td.lineTotal}</dt><dd><Money value={financial.lineTotal} currency={quotation.currencyCode} maximumFractionDigits={8} /></dd></div>
                </dl>
              ) : null}
            </fieldset>
          );
        })}
      </fieldset>
      <section className="space-y-2 rounded-md border border-border p-3">
        <h3 className="text-sm font-medium">{td.executive.structuredTermsTitle}</h3>
        <IdentifierText>{JSON.stringify(form.acceptedTerms)}</IdentifierText>
      </section>
      {form.payload ? (
        <dl className="grid grid-cols-2 gap-3 rounded-md bg-muted p-3 text-sm" aria-live="polite">
          {Object.entries(form.payload.totals).map(([key, value]) => (
            <div key={key}>
              <dt className="text-muted-foreground">{td.totals[key as keyof typeof td.totals]}</dt>
              <dd><Money value={value} currency={quotation.currencyCode} maximumFractionDigits={8} /></dd>
            </div>
          ))}
        </dl>
      ) : null}
      <Field label={copy.review} showLabel>
        <Checkbox
          checked={form.reviewed}
          disabled={form.locked || !form.payload}
          onCheckedChange={(value) => form.setReviewed(value === true)}
        />
      </Field>
    </FormDrawer>
  );
}
