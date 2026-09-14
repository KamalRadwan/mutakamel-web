"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, FilePlus2, RotateCcw } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useGenerateInvoice } from "../hooks/use-generate-invoice";
import { INVOICE_PURPOSES, type GenerateInvoiceDraft, type InvoiceValidationCode } from "../types/invoices";
import {
  formatInvoiceMoney,
  INVOICE_COPY,
  InvoiceMutationNotice,
  InvoicePageFrame,
  InvoiceSnapshotMeta,
  InvoiceStatePanel,
  type InvoiceCopy,
} from "./invoice-shared";
import { Button, Card, CardHeader, CardTitle, CardContent, Field, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/design-system";

export function GenerateInvoiceScreen() {
  const { lang, dir } = useI18n();
  const copy = INVOICE_COPY[lang];
  const generator = useGenerateInvoice();

  return (
    <InvoicePageFrame dir={dir}>
      <Button variant="link" size="sm" asChild className="w-fit px-0">
        <Link href="/invoices">
          {dir === "rtl" ? <ArrowRight className="size-3.5" /> : <ArrowLeft className="size-3.5" />}
          {copy.backToInvoices}
        </Link>
      </Button>
      {generator.isAuthLoading ? (
        <InvoiceStatePanel kind="loading" title={copy.loading} copy={copy} />
      ) : !generator.permissions.canCreate ? (
        <InvoiceStatePanel kind="forbidden" title={copy.forbiddenCreate} detail={copy.createPermission} copy={copy} />
      ) : generator.created ? (
        <GeneratedInvoice generator={generator} copy={copy} lang={lang} />
      ) : (
        <GenerateForm generator={generator} copy={copy} />
      )}
    </InvoicePageFrame>
  );
}

function GenerateForm({ generator, copy }: { generator: ReturnType<typeof useGenerateInvoice>; copy: InvoiceCopy }) {
  const pending = generator.mutation.phase === "PENDING";
  return (
    <Card className="mx-auto w-full max-w-4xl">
      <CardHeader className="p-3 pb-0 sm:p-3.5 sm:pb-0">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-info-subtle text-info-subtle-foreground">
            <FilePlus2 className="size-3.5" aria-hidden="true" />
          </span>
          {copy.generationTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-3.5">
        <form onSubmit={(event) => void generator.submit(event)} className="space-y-3" aria-label={copy.generationTitle}>
          <InvoiceMutationNotice mutation={generator.mutation} copy={copy} />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={copy.tenantId} hideLabel error={generator.validationErrors.tenantId ? invoiceFieldErrorText(generator.validationErrors.tenantId, copy) : undefined}>
              {(fp) => (
                <Input
                  {...fp}
                  size="sm"
                  dir="ltr"
                  placeholder={`${copy.tenantId} *`}
                  value={generator.draft.tenantId}
                  invalid={Boolean(generator.validationErrors.tenantId)}
                  onChange={(event) => generator.updateDraft("tenantId", event.target.value)}
                />
              )}
            </Field>
            <Field label={copy.purpose} hideLabel>
              {(fp) => (
                <Select value={generator.draft.purpose} onValueChange={(value) => generator.updateDraft("purpose", value as GenerateInvoiceDraft["purpose"])}>
                  <SelectTrigger {...fp} size="sm">
                    <SelectValue placeholder={copy.purpose} />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_PURPOSES.map((purpose) => (
                      <SelectItem key={purpose} value={purpose}>
                        {purpose.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label={copy.periodStart} hideLabel error={generator.validationErrors.periodStart ? invoiceFieldErrorText(generator.validationErrors.periodStart, copy) : undefined}>
              {(fp) => (
                <Input
                  {...fp}
                  size="sm"
                  type="datetime-local"
                  placeholder={copy.periodStart}
                  value={generator.draft.periodStart}
                  invalid={Boolean(generator.validationErrors.periodStart)}
                  onChange={(event) => generator.updateDraft("periodStart", event.target.value)}
                />
              )}
            </Field>
            <Field
              label={copy.periodEnd}
              hideLabel
              error={
                generator.validationErrors.periodEnd || generator.validationErrors.periodRange
                  ? invoiceFieldErrorText(generator.validationErrors.periodEnd ?? generator.validationErrors.periodRange!, copy)
                  : undefined
              }
            >
              {(fp) => (
                <Input
                  {...fp}
                  size="sm"
                  type="datetime-local"
                  placeholder={copy.periodEnd}
                  value={generator.draft.periodEnd}
                  invalid={Boolean(generator.validationErrors.periodEnd ?? generator.validationErrors.periodRange)}
                  onChange={(event) => generator.updateDraft("periodEnd", event.target.value)}
                />
              )}
            </Field>
            <Field label={copy.currency} hideLabel className="md:col-span-2">
              {(fp) => <Input {...fp} size="sm" readOnly dir="ltr" placeholder={copy.currency} value={copy.canonicalUsd} className="text-muted-foreground" />}
            </Field>
          </div>
          <div className="flex justify-end border-t border-border pt-3">
            <Button size="sm" type="submit" variant="primary" loading={pending}>
              <FilePlus2 className="size-3.5" aria-hidden="true" />
              {pending ? copy.generating : copy.submitGenerate}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function invoiceFieldErrorText(code: InvoiceValidationCode, copy: InvoiceCopy): string {
  return (
    {
      INVALID_UUID_V7: copy.invalidUuid,
      SEARCH_TOO_LONG: copy.searchTooLong,
      INVALID_LIMIT: copy.invalidLimit,
      INVALID_PERIOD_START: copy.invalidPeriodStart,
      INVALID_PERIOD_END: copy.invalidPeriodEnd,
      INVALID_PERIOD_RANGE: copy.invalidPeriodRange,
      INVALID_DUE_DATE: copy.invalidDueDate,
      DUE_DATE_CANNOT_CLEAR: copy.dueDateCannotClear,
      LINES_REQUIRED: copy.linesRequired,
      TOO_MANY_LINES: copy.tooManyLines,
      DESCRIPTION_REQUIRED: copy.descriptionRequired,
      DESCRIPTION_TOO_LONG: copy.descriptionTooLong,
      INVALID_QUANTITY: copy.invalidQuantity,
      INVALID_UNIT_PRICE: copy.invalidUnitPrice,
      REASON_REQUIRED: copy.reasonRequired,
      REASON_TOO_LONG: copy.reasonTooLong,
      CONFIRMATION_REQUIRED: copy.confirmationRequired,
    }[code] ?? code
  );
}

function GeneratedInvoice({ generator, copy, lang }: { generator: ReturnType<typeof useGenerateInvoice>; copy: InvoiceCopy; lang: "ar" | "en" }) {
  const created = generator.created;
  if (!created) return null;
  return (
    <div className="mx-auto w-full max-w-4xl space-y-3">
      <section role="status" aria-live="polite" className="rounded-lg border border-success/30 bg-success-subtle p-4 sm:p-5 text-success-subtle-foreground">
        <h1 className="text-lg font-semibold">{copy.generated}</h1>
        <p className="mt-1 text-xs">{copy.generatedHelp}</p>
        <dl className="mt-3 grid gap-2.5 sm:grid-cols-3">
          <Evidence label={copy.number} value={created.data.number} mono />
          <Evidence label={copy.status} value={created.data.status} mono />
          <Evidence label={copy.total} value={formatInvoiceMoney(created.data.total, created.data.currencyCode)} mono />
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          {generator.permissions.canRead ? (
            <Button size="sm" variant="primary" asChild>
              <Link href={`/invoices/${created.data.id}`}>{copy.viewGenerated}</Link>
            </Button>
          ) : null}
          <Button size="sm" type="button" variant="outline" onClick={generator.startAnother}>
            <RotateCcw className="size-3.5" />
            {copy.startAnother}
          </Button>
        </div>
      </section>
      <InvoiceSnapshotMeta snapshot={created} copy={copy} lang={lang} />
    </div>
  );
}

function Evidence({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md bg-card px-3 py-2">
      <dt className="text-sm font-semibold opacity-70">{label}</dt>
      <dd dir={mono ? "ltr" : undefined} className={`mt-1 text-base font-semibold ${mono ? "font-mono text-start" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
