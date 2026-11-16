"use client";

import { ArrowRightLeft } from "lucide-react";
import {
  Badge,
  Checkbox,
  Field,
  FormModal,
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

export interface ConvertQuotationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: QuotationDetail;
  headers: Record<string, string>;
  onConverted: () => Promise<void>;
}

/**
 * Centered Wide Modal (`FormModal size="wide"`) for `POST /quotations/:id/convert-to-sales-order`.
 *
 * Replaces `ConvertQuotationDrawer` while preserving `useConvertQuotation`'s
 * strict per-line tax/discount/charge evidence calculation.
 */
export function ConvertQuotationModal(props: ConvertQuotationModalProps) {
  return (
    <ConversionModalBody
      key={`${props.quotation.id}:${props.quotation.version}:${props.open}`}
      {...props}
    />
  );
}

function ConversionModalBody(props: ConvertQuotationModalProps) {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const copy = td.quotationConversion;
  const form = useConvertQuotation(props);
  const { quotation } = props;

  return (
    <FormModal
      open={props.open}
      onOpenChange={(next) => {
        if (!form.locked) props.onOpenChange(next);
      }}
      size="wide"
      title={td.executive.convertTitle}
      description={copy.description}
      headerIcon={
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-lg border border-success/30 bg-success-subtle text-success-subtle-foreground"
        >
          <ArrowRightLeft className="size-4" />
        </span>
      }
      titleBadge={
        <Badge tone="brand" size="sm">
          <IdentifierText>{`If-Match v${quotation.version}`}</IdentifierText>
        </Badge>
      }
      isDirty={form.isDirty}
      isSubmitting={form.write.isWriting}
      submitDisabled={form.locked || !form.payload || !form.reviewed}
      onSubmit={() => void form.handleSubmit()}
      labels={{
        submit: td.executive.convertSubmit,
        cancel: t.common.cancel,
        close: t.common.close,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: td.executive.convertTitle,
        sectionInvalid: copy.evidenceInvalid,
      }}
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <TradeWriteOutcome write={form.write} />

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/35 px-3.5 py-2.5 text-xs">
          <span className="font-semibold text-foreground">
            {td.sourceQuotation}:{" "}
            <IdentifierText>
              {quotation.documentNumber ?? quotation.draftReference ?? quotation.id}
            </IdentifierText>
          </span>
          <Badge tone="positive" size="sm">
            <IdentifierText>{quotation.currencyCode}</IdentifierText>
          </Badge>
        </div>

        {form.error ? (
          <p
            role="status"
            className="rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-xs text-destructive-subtle-foreground"
          >
            {form.error}
          </p>
        ) : null}

        <fieldset disabled={form.locked} className="space-y-3">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {td.taxEvidence}
          </legend>
          {quotation.currentLines.map((line, index) => {
            const draft = form.evidence[index];
            if (!draft) return null;
            const financial = form.payload?.lines[index]?.financial;
            return (
              <fieldset
                key={line.clientLineId}
                className="space-y-3 rounded-lg border border-border bg-card p-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                  <legend className="text-xs font-semibold text-foreground">
                    #{line.printLineNumber} · {line.descriptionSnapshot}
                  </legend>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      {td.quantity}:{" "}
                      <strong className="text-foreground">
                        <Money
                          value={line.quantity}
                          minimumFractionDigits={0}
                          maximumFractionDigits={8}
                        />
                      </strong>
                    </span>
                    <span>
                      {td.unitPrice}:{" "}
                      <strong className="text-foreground">
                        <Money
                          value={line.unitPrice}
                          currency={quotation.currencyCode}
                          maximumFractionDigits={8}
                        />
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Field label={td.totals.discountTotal} showLabel readOnly hint={t.quotationDiscount.carriedDiscount}>
                    <Input
                      size="sm"
                      inputMode="decimal"
                      value={draft.discountTotal}
                      readOnly
                    />
                  </Field>
                  <Field label={td.totals.chargeTotal} showLabel required>
                    <Input
                      size="sm"
                      inputMode="decimal"
                      value={draft.chargeTotal}
                      onChange={(e) =>
                        form.updateEvidence(line.clientLineId, "chargeTotal", e.target.value)
                      }
                    />
                  </Field>
                  <Field label={td.executive.taxCodeLabel} showLabel required>
                    <Input
                      size="sm"
                      maxLength={120}
                      placeholder="VAT_14"
                      value={draft.taxCode}
                      onChange={(e) =>
                        form.updateEvidence(line.clientLineId, "taxCode", e.target.value)
                      }
                    />
                  </Field>
                  <Field label={copy.category} showLabel required>
                    <Select
                      disabled={form.locked}
                      value={draft.category}
                      onValueChange={(value) =>
                        form.updateEvidence(line.clientLineId, "category", value)
                      }
                    >
                      <SelectTrigger size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STANDARD">
                          {td.executive.taxCategoryStandard}
                        </SelectItem>
                        <SelectItem value="ZERO">{td.executive.taxCategoryZero}</SelectItem>
                        <SelectItem value="EXEMPT">{td.executive.taxCategoryExempt}</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={td.executive.taxRatePercentLabel} showLabel required>
                    <Input
                      size="sm"
                      inputMode="decimal"
                      placeholder="14"
                      value={draft.ratePercent}
                      onChange={(e) =>
                        form.updateEvidence(line.clientLineId, "ratePercent", e.target.value)
                      }
                    />
                  </Field>
                </div>

                {financial ? (
                  <dl
                    className="flex flex-wrap items-center justify-end gap-5 border-t border-border pt-2 text-xs"
                    aria-live="polite"
                  >
                    <div className="flex items-center gap-1.5">
                      <dt className="text-muted-foreground">{td.totals.taxTotal}:</dt>
                      <dd className="font-semibold">
                        <Money
                          value={financial.taxTotal}
                          currency={quotation.currencyCode}
                          maximumFractionDigits={8}
                        />
                      </dd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <dt className="text-muted-foreground">{td.lineTotal}:</dt>
                      <dd className="font-bold text-primary">
                        <Money
                          value={financial.lineTotal}
                          currency={quotation.currencyCode}
                          maximumFractionDigits={8}
                        />
                      </dd>
                    </div>
                  </dl>
                ) : null}
              </fieldset>
            );
          })}
        </fieldset>

        <section className="space-y-1.5 rounded-lg border border-border bg-muted/25 p-3">
          <h3 className="text-xs font-semibold text-foreground">
            {td.executive.structuredTermsTitle}
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            {Object.entries(form.acceptedTerms).map(([key, val]) => (
              <div key={key} className="rounded border border-border bg-card px-2.5 py-1.5">
                <span className="block text-micro text-muted-foreground">
                  <IdentifierText>{key}</IdentifierText>
                </span>
                <span className="text-xs font-medium text-foreground">
                  <IdentifierText>{String(val)}</IdentifierText>
                </span>
              </div>
            ))}
          </div>
        </section>

        {form.payload ? (
          <dl
            className="grid grid-cols-2 gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs sm:grid-cols-4"
            aria-live="polite"
          >
            {Object.entries(form.payload.totals).map(([key, value]) => (
              <div key={key}>
                <dt className="text-muted-foreground">
                  {td.totals[key as keyof typeof td.totals] ?? key}
                </dt>
                <dd className="mt-0.5 font-semibold text-foreground">
                  <Money
                    value={value}
                    currency={quotation.currencyCode}
                    maximumFractionDigits={8}
                  />
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card p-3 text-xs text-foreground">
          <Checkbox
            checked={form.reviewed}
            disabled={form.locked || !form.payload}
            onCheckedChange={(value) => form.setReviewed(value === true)}
          />
          <span>{copy.review}</span>
        </label>
      </div>
    </FormModal>
  );
}
