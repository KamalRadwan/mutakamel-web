"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleDollarSign, FileCheck2, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import {
  Card,
  Field,
  Input,
  Textarea,
  Checkbox,
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Label,
  StatusBadge,
  type ColumnDef,
} from "@/design-system";
import { useInvoiceDetail } from "../hooks/use-invoice-detail";
import type { InvoiceLine, InvoiceValidationCode } from "../types/invoices";
import {
  formatInvoiceDate,
  formatInvoiceDecimal,
  formatInvoiceMoney,
  INVOICE_COPY,
  InvoiceFieldError,
  InvoiceMutationNotice,
  InvoicePageFrame,
  InvoiceSnapshotMeta,
  InvoiceStatePanel,
  invoiceValidationMessage,
  RetryInvoiceButton,
  type InvoiceCopy,
} from "./invoice-shared";

export function InvoiceDetailScreen({ invoiceId }: { invoiceId: string }) {
  const { lang, dir } = useI18n();
  const copy = INVOICE_COPY[lang];
  const detail = useInvoiceDetail(invoiceId);

  return (
    <InvoicePageFrame dir={dir}>
      <Button variant="link" size="sm" asChild className="w-fit px-0">
        <Link href="/invoices">
          {dir === "rtl" ? <ArrowRight className="size-4" aria-hidden="true" /> : <ArrowLeft className="size-4" aria-hidden="true" />}
          {copy.backToInvoices}
        </Link>
      </Button>
      <InvoiceDetailBody detail={detail} copy={copy} lang={lang} />
      {detail.dialog === "EDIT" ? <EditInvoiceDialog detail={detail} copy={copy} lang={lang} /> : null}
      {detail.dialog === "ISSUE" ? <CriticalInvoiceDialog kind="ISSUE" detail={detail} copy={copy} /> : null}
      {detail.dialog === "VOID" ? <CriticalInvoiceDialog kind="VOID" detail={detail} copy={copy} /> : null}
    </InvoicePageFrame>
  );
}

function InvoiceDetailBody({ detail, copy, lang }: { detail: ReturnType<typeof useInvoiceDetail>; copy: InvoiceCopy; lang: "ar" | "en" }) {
  if (detail.state === "LOADING") return <InvoiceStatePanel kind="loading" title={copy.loading} copy={copy} />;
  if (detail.state === "FORBIDDEN") return <InvoiceStatePanel kind="forbidden" title={copy.forbiddenRead} detail={copy.readPermission} copy={copy} />;
  if (detail.state === "NOT_FOUND") return <InvoiceStatePanel kind="notFound" title={copy.notFound} detail={detail.error?.message} correlationId={detail.error?.correlationId} copy={copy} />;
  if (detail.state === "UNAVAILABLE") return <InvoiceStatePanel kind="unavailable" title={copy.unavailable} detail={detail.error?.message} correlationId={detail.error?.correlationId} copy={copy} action={<RetryInvoiceButton label={copy.retry} onClick={detail.refresh} />} />;
  if (detail.state === "ERROR" || !detail.snapshot) return <InvoiceStatePanel kind="error" title={copy.error} detail={detail.error?.message} correlationId={detail.error?.correlationId} copy={copy} action={<RetryInvoiceButton label={copy.retry} onClick={detail.refresh} />} />;
  const invoice = detail.snapshot.data;

  const lineColumns: ColumnDef<InvoiceLine>[] = [
    {
      key: "description",
      headerEn: copy.description,
      headerAr: copy.description,
      cell: (line) => <span className="font-medium">{line.descriptionI18n[lang]}</span>,
    },
    {
      key: "quantity",
      headerEn: copy.quantity,
      headerAr: copy.quantity,
      cell: (line) => <span dir="ltr" className="block text-start font-mono">{formatInvoiceDecimal(line.quantity)}</span>,
    },
    {
      key: "unitPrice",
      headerEn: copy.unitPrice,
      headerAr: copy.unitPrice,
      cell: (line) => <span dir="ltr" className="block text-start font-mono">{formatInvoiceMoney(line.unitPrice, invoice.currencyCode)}</span>,
    },
    {
      key: "lineTotal",
      headerEn: copy.lineTotal,
      headerAr: copy.lineTotal,
      cell: (line) => <span dir="ltr" className="block text-start font-mono font-semibold">{formatInvoiceMoney(line.lineTotal, invoice.currencyCode)}</span>,
    },
  ];

  return (
    <div className="space-y-4" aria-busy={detail.isRefreshing || detail.mutation.phase === "PENDING"}>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 dir="ltr" className="font-mono text-xl font-semibold text-start sm:text-2xl">{invoice.number}</h1>
              <StatusBadge status={invoice.status} enumType="invoice" />
            </div>
            <code dir="ltr" className="mt-2 block break-all text-start text-sm text-muted-foreground">{invoice.id}</code>
            <p dir="ltr" className="mt-2 text-start font-mono text-sm font-semibold text-muted-foreground">{invoice.purpose}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={detail.refresh} disabled={detail.isRefreshing}>
              <RefreshCw className={`size-4 ${detail.isRefreshing ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
              {copy.refresh}
            </Button>
            {detail.canEdit ? (
              <Button type="button" variant="outline" onClick={detail.openEdit}>
                <Pencil className="size-4" aria-hidden="true" />
                {copy.editDraft}
              </Button>
            ) : null}
            {detail.canIssue ? (
              <Button type="button" variant="primary" onClick={detail.openIssue}>
                <FileCheck2 className="size-4" aria-hidden="true" />
                {copy.issueInvoice}
              </Button>
            ) : null}
            {detail.canVoid ? (
              <Button type="button" variant="destructive" onClick={detail.openVoid}>
                <Trash2 className="size-4" aria-hidden="true" />
                {copy.voidInvoice}
              </Button>
            ) : null}
          </div>
        </div>
        {invoice.status === "DRAFT" && invoice.purpose !== "MANUAL" ? (
          <p className="mt-3 rounded-lg border border-warning/30 bg-warning-subtle px-3 py-2 text-sm text-warning-subtle-foreground">
            {copy.systemDraftLocked}
          </p>
        ) : null}
      </Card>

      <InvoiceMutationNotice mutation={detail.mutation} copy={copy} />

      <div className="grid gap-4 xl:grid-cols-3">
        <EvidenceCard title={copy.identity}>
          <Evidence label={copy.tenantId} value={invoice.tenantId} mono link={`/tenants/${invoice.tenantId}`} />
          <Evidence label={copy.subscriptionId} value={invoice.subscriptionId} mono />
          <Evidence label={copy.purpose} value={invoice.purpose} mono />
        </EvidenceCard>
        <EvidenceCard title={copy.financials}>
          <Evidence label={copy.total} value={formatInvoiceMoney(invoice.total, invoice.currencyCode)} mono />
          <Evidence label={copy.subtotal} value={formatInvoiceMoney(invoice.subtotal, invoice.currencyCode)} mono />
          <Evidence label={copy.tax} value={formatInvoiceMoney(invoice.taxTotal, invoice.currencyCode)} mono />
          <Evidence label={copy.settlementTotal} value={invoice.settlementTotalUsd ? formatInvoiceMoney(invoice.settlementTotalUsd, "USD") : copy.notRecorded} mono />
          <Evidence label={copy.amountPaid} value={formatInvoiceMoney(invoice.amountPaidUsd, "USD")} mono />
          <Evidence label={copy.fxRate} value={invoice.fxUnitsPerUsd ?? copy.notRecorded} mono />
        </EvidenceCard>
        <EvidenceCard title={copy.dates}>
          <Evidence label={copy.periodStart} value={formatInvoiceDate(invoice.periodStart, lang)} />
          <Evidence label={copy.periodEnd} value={formatInvoiceDate(invoice.periodEnd, lang)} />
          <Evidence label={copy.issuedAt} value={formatInvoiceDate(invoice.issuedAt, lang)} />
          <Evidence label={copy.dueAt} value={formatInvoiceDate(invoice.dueAt, lang)} />
          <Evidence label={copy.paidAt} value={formatInvoiceDate(invoice.paidAt, lang)} />
          <Evidence label={copy.updatedAt} value={formatInvoiceDate(invoice.updatedAt, lang)} />
        </EvidenceCard>
      </div>

      {detail.canRecordOfflinePayment ? (
        <Card className="border-info/30 bg-info-subtle px-4 py-3 text-info-subtle-foreground">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">{copy.offlinePayment}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{copy.offlinePaymentHint}</p>
            </div>
            <Button type="button" variant="primary" asChild>
              <Link href={`/tenants/${invoice.tenantId}`}>
                <CircleDollarSign className="size-4" aria-hidden="true" />
                {copy.offlinePayment}
              </Link>
            </Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="px-4 py-3 text-base font-semibold">{copy.invoiceLines}</h2>
        <DataTable
          labelEn={INVOICE_COPY.en.invoiceLines}
          labelAr={INVOICE_COPY.ar.invoiceLines}
          columns={lineColumns}
          data={invoice.lines ?? []}
          isRefreshing={detail.isRefreshing}
          getRowId={(line) => line.id}
          pagination={{
            page: 1,
            limit: Math.max((invoice.lines ?? []).length, 1),
            totalItems: (invoice.lines ?? []).length,
            totalPages: 1,
            onPageChange: () => {},
          }}
          emptyState={{ titleEn: copy.linesRequired, titleAr: copy.linesRequired }}
        />
      </Card>

      <InvoiceSnapshotMeta snapshot={detail.snapshot} copy={copy} lang={lang} />
    </div>
  );
}

function EvidenceCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-4">
      <h2 className="text-base font-semibold">{title}</h2>
      <dl className="mt-3 grid gap-2">{children}</dl>
    </Card>
  );
}

function Evidence({ label, value, mono, link }: { label: string; value: string; mono?: boolean; link?: string }) {
  const output = link ? (
    <Link href={link} className="text-action hover:underline">
      {value}
    </Link>
  ) : (
    value
  );
  return (
    <div className="rounded-md bg-muted px-3 py-2">
      <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
      <dd dir={mono ? "ltr" : undefined} className={`mt-1 break-all text-sm font-semibold ${mono ? "font-mono text-start" : ""}`}>
        {output}
      </dd>
    </div>
  );
}

function EditInvoiceDialog({ detail, copy, lang }: { detail: ReturnType<typeof useInvoiceDetail>; copy: InvoiceCopy; lang: "ar" | "en" }) {
  const pending = detail.mutation.phase === "PENDING";
  return (
    <DetailDialog title={copy.editDraft} onClose={detail.closeDialog}>
      <form onSubmit={(event) => { event.preventDefault(); void detail.saveEdit(); }} className="space-y-4">
        <InvoiceMutationNotice mutation={detail.mutation} copy={copy} />
        <EditDateInput label={copy.optionalDueAt} value={detail.editDraft.dueAt} error={detail.validationErrors.dueAt} copy={copy} onChange={detail.updateEditDueAt} />
        <div className="space-y-3">
          {detail.editDraft.lines.map((line, index) => (
            <fieldset key={line.clientId} className="rounded-lg border border-border p-3">
              <legend className="px-1 text-sm font-semibold">{copy.invoiceLines} {formatInvoiceInteger(index + 1, lang)}</legend>
              <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(140px,1fr)_minmax(160px,1fr)_44px]">
                <EditTextInput
                  label={copy.description}
                  value={line.description}
                  error={detail.validationErrors[`lines.${index}.description`]}
                  copy={copy}
                  onChange={(value) => detail.updateEditLine(line.clientId, "description", value)}
                />
                <EditTextInput
                  label={copy.quantity}
                  value={line.quantity}
                  dir="ltr"
                  inputMode="decimal"
                  error={detail.validationErrors[`lines.${index}.quantity`]}
                  copy={copy}
                  onChange={(value) => detail.updateEditLine(line.clientId, "quantity", value)}
                />
                <EditTextInput
                  label={copy.unitPrice}
                  value={line.unitPrice}
                  dir="ltr"
                  inputMode="decimal"
                  error={detail.validationErrors[`lines.${index}.unitPrice`]}
                  copy={copy}
                  onChange={(value) => detail.updateEditLine(line.clientId, "unitPrice", value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-5 justify-center px-0"
                  aria-label={`${copy.removeLine} ${formatInvoiceInteger(index + 1, lang)}`}
                  onClick={() => detail.removeEditLine(line.clientId)}
                >
                  <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                </Button>
              </div>
            </fieldset>
          ))}
          <InvoiceFieldError id="invoice-lines-error" code={detail.validationErrors.lines} copy={copy} />
          <Button type="button" variant="outline" onClick={detail.addEditLine} disabled={detail.editDraft.lines.length >= 200}>
            <Plus className="size-4" aria-hidden="true" />
            {copy.addLine}
          </Button>
        </div>
        <DialogActions copy={copy} pending={pending} onCancel={detail.closeDialog} submitLabel={pending ? copy.saving : copy.saveDraft} danger={false} />
      </form>
    </DetailDialog>
  );
}

function CriticalInvoiceDialog({ kind, detail, copy }: { kind: "ISSUE" | "VOID"; detail: ReturnType<typeof useInvoiceDetail>; copy: InvoiceCopy }) {
  const draft = kind === "ISSUE" ? detail.issueDraft : detail.voidDraft;
  const update = kind === "ISSUE" ? detail.updateIssueDraft : detail.updateVoidDraft;
  const execute = kind === "ISSUE" ? detail.issueInvoice : detail.voidInvoice;
  const pending = detail.mutation.phase === "PENDING";
  const confirmationId = `${kind.toLowerCase()}-invoice-confirmation`;
  const confirmationErrorId = `${kind.toLowerCase()}-confirmed-error`;
  return (
    <DetailDialog title={kind === "ISSUE" ? copy.issueTitle : copy.voidTitle} onClose={detail.closeDialog}>
      <form onSubmit={(event) => { event.preventDefault(); void execute(); }} className="space-y-4">
        <InvoiceMutationNotice mutation={detail.mutation} copy={copy} />
        {kind === "ISSUE" ? (
          <EditDateInput label={copy.dueAt} value={draft.dueAt} error={detail.validationErrors.dueAt} copy={copy} onChange={(value) => update("dueAt", value)} />
        ) : null}
        <Field label={copy.reviewReason} hint={copy.reviewReasonHint} error={detail.validationErrors.reason ? invoiceValidationMessage(detail.validationErrors.reason, copy) : undefined}>
          {(fp) => (
            <Textarea
              {...fp}
              value={draft.reason}
              maxLength={501}
              rows={4}
              invalid={Boolean(detail.validationErrors.reason)}
              onChange={(event) => update("reason", event.target.value)}
            />
          )}
        </Field>
        <Label htmlFor={confirmationId} className="flex min-h-11 items-start gap-3 rounded-lg border border-warning/30 bg-warning-subtle p-3 text-sm font-semibold text-warning-subtle-foreground">
          <Checkbox
            id={confirmationId}
            className="mt-1"
            checked={draft.confirmed}
            aria-invalid={Boolean(detail.validationErrors.confirmed)}
            aria-describedby={detail.validationErrors.confirmed ? confirmationErrorId : undefined}
            onCheckedChange={(checked) => update("confirmed", checked === true)}
          />
          <span>{kind === "ISSUE" ? copy.issueConfirmation : copy.voidConfirmation}</span>
        </Label>
        <InvoiceFieldError id={confirmationErrorId} code={detail.validationErrors.confirmed} copy={copy} />
        <DialogActions copy={copy} pending={pending} onCancel={detail.closeDialog} submitLabel={kind === "ISSUE" ? copy.confirmIssue : copy.confirmVoid} danger={kind === "VOID"} />
      </form>
    </DetailDialog>
  );
}

function DetailDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function DialogActions({ copy, pending, onCancel, submitLabel, danger }: { copy: InvoiceCopy; pending: boolean; onCancel: () => void; submitLabel: string; danger: boolean }) {
  return (
    <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
      <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
        {copy.cancel}
      </Button>
      <Button type="submit" variant={danger ? "destructive" : "primary"} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
        {submitLabel}
      </Button>
    </div>
  );
}

function EditDateInput({ label, value, onChange, error, copy }: { label: string; value: string; onChange: (value: string) => void; error?: InvoiceValidationCode; copy: InvoiceCopy }) {
  return (
    <Field label={label} error={error ? invoiceValidationMessage(error, copy) : undefined}>
      {(fp) => (
        <Input
          {...fp}
          type="datetime-local"
          value={value}
          invalid={Boolean(error)}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

function EditTextInput({ label, value, onChange, error, copy, dir, inputMode }: { label: string; value: string; onChange: (value: string) => void; error?: InvoiceValidationCode; copy: InvoiceCopy; dir?: "ltr"; inputMode?: "decimal" }) {
  return (
    <Field label={label} error={error ? invoiceValidationMessage(error, copy) : undefined}>
      {(fp) => (
        <Input
          {...fp}
          value={value}
          dir={dir}
          inputMode={inputMode}
          invalid={Boolean(error)}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

function formatInvoiceInteger(value: number, lang: "ar" | "en"): string {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}
