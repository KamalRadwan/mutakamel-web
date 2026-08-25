"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleDollarSign, FileCheck2, Loader2, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useInvoiceDetail } from "../hooks/use-invoice-detail";
import type { Invoice, InvoiceValidationCode } from "../types/invoices";
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
  InvoiceStatusBadge,
  RetryInvoiceButton,
  type InvoiceCopy,
} from "./invoice-shared";

export function InvoiceDetailScreen({ invoiceId }: { invoiceId: string }) {
  const { lang, dir } = useI18n();
  const copy = INVOICE_COPY[lang];
  const detail = useInvoiceDetail(invoiceId);

  return (
    <InvoicePageFrame dir={dir}>
      <Link href="/invoices" className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-slate-600 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-300">
        {dir === "rtl" ? <ArrowRight className="size-4" /> : <ArrowLeft className="size-4" />}{copy.backToInvoices}
      </Link>
      <InvoiceDetailBody detail={detail} copy={copy} lang={lang} />
      {detail.dialog === "EDIT" ? <EditInvoiceDialog detail={detail} copy={copy} /> : null}
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
  return (
    <div className="space-y-4" aria-busy={detail.isRefreshing || detail.mutation.phase === "PENDING"}>
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="flex flex-wrap items-center gap-3"><h1 dir="ltr" className="font-mono text-xl font-black text-start sm:text-2xl">{invoice.number}</h1><InvoiceStatusBadge status={invoice.status} /></div><code dir="ltr" className="mt-2 block break-all text-start text-xs text-slate-500">{invoice.id}</code><p className="mt-2 font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300">{invoice.purpose}</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={detail.refresh} disabled={detail.isRefreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-bold disabled:cursor-wait disabled:opacity-60 dark:border-slate-700"><RefreshCw className={`size-4 ${detail.isRefreshing ? "animate-spin" : ""}`} />{copy.refresh}</button>
            {detail.canEdit ? <button type="button" onClick={detail.openEdit} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-3 text-sm font-bold text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"><Pencil className="size-4" />{copy.editDraft}</button> : null}
            {detail.canIssue ? <button type="button" onClick={detail.openIssue} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-black text-white hover:bg-amber-700"><FileCheck2 className="size-4" />{copy.issueInvoice}</button> : null}
            {detail.canVoid ? <button type="button" onClick={detail.openVoid} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-700 px-4 text-sm font-black text-white hover:bg-rose-800"><Trash2 className="size-4" />{copy.voidInvoice}</button> : null}
          </div>
        </div>
        {invoice.status === "DRAFT" && invoice.purpose !== "MANUAL" ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{copy.systemDraftLocked}</p> : null}
      </header>

      <InvoiceMutationNotice mutation={detail.mutation} copy={copy} />

      <div className="grid gap-4 xl:grid-cols-3">
        <EvidenceCard title={copy.identity}><Evidence label={copy.tenantId} value={invoice.tenantId} mono link={`/tenants/${invoice.tenantId}`} /><Evidence label={copy.subscriptionId} value={invoice.subscriptionId} mono /><Evidence label={copy.purpose} value={invoice.purpose} mono /></EvidenceCard>
        <EvidenceCard title={copy.financials}><Evidence label={copy.total} value={formatInvoiceMoney(invoice.total, invoice.currencyCode)} mono /><Evidence label={copy.subtotal} value={formatInvoiceMoney(invoice.subtotal, invoice.currencyCode)} mono /><Evidence label={copy.tax} value={formatInvoiceMoney(invoice.taxTotal, invoice.currencyCode)} mono /><Evidence label={copy.settlementTotal} value={invoice.settlementTotalUsd ? formatInvoiceMoney(invoice.settlementTotalUsd, "USD") : copy.notRecorded} mono /><Evidence label={copy.amountPaid} value={formatInvoiceMoney(invoice.amountPaidUsd, "USD")} mono /><Evidence label={copy.fxRate} value={invoice.fxUnitsPerUsd ?? copy.notRecorded} mono /></EvidenceCard>
        <EvidenceCard title={copy.dates}><Evidence label={copy.periodStart} value={formatInvoiceDate(invoice.periodStart, lang)} /><Evidence label={copy.periodEnd} value={formatInvoiceDate(invoice.periodEnd, lang)} /><Evidence label={copy.issuedAt} value={formatInvoiceDate(invoice.issuedAt, lang)} /><Evidence label={copy.dueAt} value={formatInvoiceDate(invoice.dueAt, lang)} /><Evidence label={copy.paidAt} value={formatInvoiceDate(invoice.paidAt, lang)} /><Evidence label={copy.updatedAt} value={formatInvoiceDate(invoice.updatedAt, lang)} /></EvidenceCard>
      </div>

      {detail.canRecordOfflinePayment ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">{copy.offlinePayment}</h2><p className="mt-1 text-sm">{copy.offlinePaymentHint}</p></div><Link href={`/tenants/${invoice.tenantId}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-800 px-4 text-sm font-black text-white"><CircleDollarSign className="size-4" />{copy.offlinePayment}</Link></div>
        </section>
      ) : null}

      <InvoiceLines invoice={invoice} copy={copy} lang={lang} />
      <InvoiceSnapshotMeta snapshot={detail.snapshot} copy={copy} lang={lang} />
    </div>
  );
}

function EvidenceCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="text-base font-black">{title}</h2><dl className="mt-3 grid gap-2">{children}</dl></section>;
}

function Evidence({ label, value, mono, link }: { label: string; value: string; mono?: boolean; link?: string }) {
  const output = link ? <Link href={link} className="text-indigo-700 hover:underline dark:text-indigo-300">{value}</Link> : value;
  return <div className="rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-800/70"><dt className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</dt><dd dir={mono ? "ltr" : undefined} className={`mt-1 break-all text-sm font-bold ${mono ? "font-mono text-start" : ""}`}>{output}</dd></div>;
}

function InvoiceLines({ invoice, copy, lang }: { invoice: Invoice; copy: InvoiceCopy; lang: "ar" | "en" }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="px-4 py-3 text-base font-black">{copy.invoiceLines}</h2>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><caption className="sr-only">{copy.invoiceLines}</caption><thead className="bg-slate-100 text-xs font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300"><tr><th className="px-4 py-3 text-start">{copy.description}</th><th className="px-4 py-3 text-start">{copy.quantity}</th><th className="px-4 py-3 text-start">{copy.unitPrice}</th><th className="px-4 py-3 text-start">{copy.lineTotal}</th></tr></thead><tbody>{(invoice.lines ?? []).map((line) => <tr key={line.id} className="border-t border-slate-200 dark:border-slate-800"><td className="px-4 py-3 font-medium">{line.descriptionI18n[lang]}</td><td dir="ltr" className="px-4 py-3 text-start font-mono">{formatInvoiceDecimal(line.quantity)}</td><td dir="ltr" className="px-4 py-3 text-start font-mono">{formatInvoiceMoney(line.unitPrice, invoice.currencyCode)}</td><td dir="ltr" className="px-4 py-3 text-start font-mono font-black">{formatInvoiceMoney(line.lineTotal, invoice.currencyCode)}</td></tr>)}</tbody></table></div>
      {(invoice.lines ?? []).length === 0 ? <p className="border-t border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800">{copy.linesRequired}</p> : null}
    </section>
  );
}

function EditInvoiceDialog({ detail, copy }: { detail: ReturnType<typeof useInvoiceDetail>; copy: InvoiceCopy }) {
  const pending = detail.mutation.phase === "PENDING";
  return (
    <Dialog title={copy.editDraft} onClose={detail.closeDialog} closeLabel={copy.cancel}>
      <form onSubmit={(event) => { event.preventDefault(); void detail.saveEdit(); }} className="space-y-4">
        <InvoiceMutationNotice mutation={detail.mutation} copy={copy} />
        <EditDateInput id="edit-due-at" label={copy.optionalDueAt} value={detail.editDraft.dueAt} error={detail.validationErrors.dueAt} copy={copy} onChange={detail.updateEditDueAt} />
        <div className="space-y-3">
          {detail.editDraft.lines.map((line, index) => {
            const prefix = `lines.${index}`;
            return <fieldset key={line.clientId} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"><legend className="px-1 text-xs font-black">{copy.invoiceLines} {index + 1}</legend><div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(140px,1fr)_minmax(160px,1fr)_44px]"><EditTextInput id={`line-${line.clientId}-description`} label={copy.description} value={line.description} error={detail.validationErrors[`${prefix}.description`]} copy={copy} onChange={(value) => detail.updateEditLine(line.clientId, "description", value)} /><EditTextInput id={`line-${line.clientId}-quantity`} label={copy.quantity} value={line.quantity} dir="ltr" inputMode="decimal" error={detail.validationErrors[`${prefix}.quantity`]} copy={copy} onChange={(value) => detail.updateEditLine(line.clientId, "quantity", value)} /><EditTextInput id={`line-${line.clientId}-price`} label={copy.unitPrice} value={line.unitPrice} dir="ltr" inputMode="decimal" error={detail.validationErrors[`${prefix}.unitPrice`]} copy={copy} onChange={(value) => detail.updateEditLine(line.clientId, "unitPrice", value)} /><button type="button" onClick={() => detail.removeEditLine(line.clientId)} aria-label={`${copy.removeLine} ${index + 1}`} className="mt-5 grid size-11 place-items-center rounded-xl border border-rose-300 text-rose-700 dark:border-rose-900 dark:text-rose-300"><Trash2 className="size-4" /></button></div></fieldset>;
          })}
          <InvoiceFieldError id="invoice-lines-error" code={detail.validationErrors.lines} copy={copy} />
          <button type="button" onClick={detail.addEditLine} disabled={detail.editDraft.lines.length >= 200} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-indigo-300 px-3 text-sm font-bold text-indigo-700 disabled:opacity-40 dark:border-indigo-800 dark:text-indigo-300"><Plus className="size-4" />{copy.addLine}</button>
        </div>
        <DialogActions copy={copy} pending={pending} onCancel={detail.closeDialog} submitLabel={pending ? copy.saving : copy.saveDraft} danger={false} />
      </form>
    </Dialog>
  );
}

function CriticalInvoiceDialog({ kind, detail, copy }: { kind: "ISSUE" | "VOID"; detail: ReturnType<typeof useInvoiceDetail>; copy: InvoiceCopy }) {
  const draft = kind === "ISSUE" ? detail.issueDraft : detail.voidDraft;
  const update = kind === "ISSUE" ? detail.updateIssueDraft : detail.updateVoidDraft;
  const execute = kind === "ISSUE" ? detail.issueInvoice : detail.voidInvoice;
  const pending = detail.mutation.phase === "PENDING";
  return (
    <Dialog title={kind === "ISSUE" ? copy.issueTitle : copy.voidTitle} onClose={detail.closeDialog} closeLabel={copy.cancel}>
      <form onSubmit={(event) => { event.preventDefault(); void execute(); }} className="space-y-4">
        <InvoiceMutationNotice mutation={detail.mutation} copy={copy} />
        {kind === "ISSUE" ? <EditDateInput id="issue-due-at" label={copy.dueAt} value={draft.dueAt} error={detail.validationErrors.dueAt} copy={copy} onChange={(value) => update("dueAt", value)} /> : null}
        <label htmlFor={`${kind.toLowerCase()}-reason`} className="grid gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300"><span>{copy.reviewReason}</span><textarea id={`${kind.toLowerCase()}-reason`} value={draft.reason} maxLength={501} aria-invalid={Boolean(detail.validationErrors.reason)} aria-describedby={`${kind.toLowerCase()}-reason-help ${kind.toLowerCase()}-reason-error`} onChange={(event) => update("reason", event.target.value)} rows={4} className={`min-h-24 rounded-xl border bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none focus:border-indigo-500 dark:bg-slate-950 dark:text-slate-100 ${detail.validationErrors.reason ? "border-rose-500" : "border-slate-300 dark:border-slate-700"}`} /><span id={`${kind.toLowerCase()}-reason-help`} className="text-xs font-normal leading-5 text-slate-500">{copy.reviewReasonHint}</span><InvoiceFieldError id={`${kind.toLowerCase()}-reason-error`} code={detail.validationErrors.reason} copy={copy} /></label>
        <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><input type="checkbox" checked={draft.confirmed} aria-invalid={Boolean(detail.validationErrors.confirmed)} aria-describedby={detail.validationErrors.confirmed ? `${kind.toLowerCase()}-confirmed-error` : undefined} onChange={(event) => update("confirmed", event.target.checked)} className="mt-1 size-4 accent-amber-700" /><span>{kind === "ISSUE" ? copy.issueConfirmation : copy.voidConfirmation}</span></label>
        <InvoiceFieldError id={`${kind.toLowerCase()}-confirmed-error`} code={detail.validationErrors.confirmed} copy={copy} />
        <DialogActions copy={copy} pending={pending} onCancel={detail.closeDialog} submitLabel={kind === "ISSUE" ? copy.confirmIssue : copy.confirmVoid} danger={kind === "VOID"} />
      </form>
    </Dialog>
  );
}

function Dialog({ title, onClose, closeLabel, children }: { title: string; onClose: () => void; closeLabel: string; children: React.ReactNode }) {
  const id = useId();
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      const initialTarget = dialogRef.current?.querySelector<HTMLElement>(
        "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])",
      );
      (initialTarget ?? dialogRef.current)?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/70 p-4"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="my-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 id={id} className="text-lg font-black">{title}</h2>
          <button type="button" onClick={onClose} aria-label={closeLabel} className="grid size-11 place-items-center rounded-xl border border-slate-300 dark:border-slate-700">
            <X className="size-4" />
          </button>
        </header>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </section>
    </div>
  );
}

function DialogActions({ copy, pending, onCancel, submitLabel, danger }: { copy: InvoiceCopy; pending: boolean; onCancel: () => void; submitLabel: string; danger: boolean }) {
  return <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800"><button type="button" onClick={onCancel} disabled={pending} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold dark:border-slate-700">{copy.cancel}</button><button type="submit" disabled={pending} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60 ${danger ? "bg-rose-700 hover:bg-rose-800" : "bg-indigo-700 hover:bg-indigo-800"}`}>{pending ? <Loader2 className="size-4 animate-spin" /> : null}{submitLabel}</button></div>;
}

function EditDateInput({ id, label, value, onChange, error, copy }: { id: string; label: string; value: string; onChange: (value: string) => void; error?: InvoiceValidationCode; copy: InvoiceCopy }) {
  const errorId = `${id}-error`; return <label htmlFor={id} className="grid gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300"><span>{label}</span><input id={id} type="datetime-local" value={value} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onChange(event.target.value)} className={`min-h-11 rounded-xl border bg-white px-3 text-sm font-normal text-slate-950 outline-none focus:border-indigo-500 dark:bg-slate-950 dark:text-slate-100 ${error ? "border-rose-500" : "border-slate-300 dark:border-slate-700"}`} /><InvoiceFieldError id={errorId} code={error} copy={copy} /></label>;
}

function EditTextInput({ id, label, value, onChange, error, copy, dir, inputMode }: { id: string; label: string; value: string; onChange: (value: string) => void; error?: InvoiceValidationCode; copy: InvoiceCopy; dir?: "ltr"; inputMode?: "decimal" }) {
  const errorId = `${id}-error`; return <label htmlFor={id} className="grid min-w-0 gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300"><span>{label}</span><input id={id} value={value} dir={dir} inputMode={inputMode} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onChange(event.target.value)} className={`min-h-11 min-w-0 rounded-xl border bg-white px-3 text-sm font-normal text-slate-950 outline-none focus:border-indigo-500 dark:bg-slate-950 dark:text-slate-100 ${error ? "border-rose-500" : "border-slate-300 dark:border-slate-700"}`} /><InvoiceFieldError id={errorId} code={error} copy={copy} /></label>;
}

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");
