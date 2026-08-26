"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, FilePlus2, Loader2, RotateCcw } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useGenerateInvoice } from "../hooks/use-generate-invoice";
import { INVOICE_PURPOSES, type GenerateInvoiceDraft, type InvoiceValidationCode } from "../types/invoices";
import {
  formatInvoiceMoney,
  INVOICE_COPY,
  InvoiceFieldError,
  InvoiceMutationNotice,
  InvoicePageFrame,
  InvoiceSnapshotMeta,
  InvoiceStatePanel,
  type InvoiceCopy,
} from "./invoice-shared";

export function GenerateInvoiceScreen() {
  const { lang, dir } = useI18n();
  const copy = INVOICE_COPY[lang];
  const generator = useGenerateInvoice();

  return (
    <InvoicePageFrame dir={dir}>
      <Link href="/invoices" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-300">
        {dir === "rtl" ? <ArrowRight className="size-4" /> : <ArrowLeft className="size-4" />}{copy.backToInvoices}
      </Link>
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
    <section className="mx-auto w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-white px-5 py-4 dark:border-slate-800 dark:from-indigo-950/40 dark:to-slate-900">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-indigo-700 text-white"><FilePlus2 className="size-5" /></span><div><h1 className="text-xl font-semibold">{copy.generationTitle}</h1><p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{copy.generationHelp}</p></div></div>
      </header>
      <form onSubmit={(event) => void generator.submit(event)} className="space-y-4 p-5" aria-label={copy.generationTitle}>
        <InvoiceMutationNotice mutation={generator.mutation} copy={copy} />
        <div className="grid gap-4 md:grid-cols-2">
          <GenerateInput id="generate-tenant-id" label={copy.tenantId} value={generator.draft.tenantId} dir="ltr" error={generator.validationErrors.tenantId} copy={copy} onChange={(value) => generator.updateDraft("tenantId", value)} />
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300"><span>{copy.purpose}</span><select value={generator.draft.purpose} onChange={(event) => generator.updateDraft("purpose", event.target.value as GenerateInvoiceDraft["purpose"])} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">{INVOICE_PURPOSES.map((purpose) => <option key={purpose} value={purpose}>{purpose.replaceAll("_", " ")}</option>)}</select></label>
          <GenerateInput id="generate-period-start" type="datetime-local" label={copy.periodStart} value={generator.draft.periodStart} error={generator.validationErrors.periodStart} copy={copy} onChange={(value) => generator.updateDraft("periodStart", value)} />
          <GenerateInput id="generate-period-end" type="datetime-local" label={copy.periodEnd} value={generator.draft.periodEnd} error={generator.validationErrors.periodEnd ?? generator.validationErrors.periodRange} copy={copy} onChange={(value) => generator.updateDraft("periodEnd", value)} />
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300"><span>{copy.currency}</span><input readOnly value={copy.canonicalUsd} dir="ltr" className="min-h-11 rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300" /></label>
        </div>
        <div className="flex justify-end border-t border-slate-200 pt-4 dark:border-slate-800">
          <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-700 px-5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-wait disabled:opacity-60">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FilePlus2 className="size-4" aria-hidden="true" />}{pending ? copy.generating : copy.submitGenerate}
          </button>
        </div>
      </form>
    </section>
  );
}

function GenerateInput({ id, label, value, onChange, copy, error, type = "text", dir }: { id: string; label: string; value: string; onChange: (value: string) => void; copy: InvoiceCopy; error?: InvoiceValidationCode; type?: "text" | "datetime-local"; dir?: "ltr" }) {
  const errorId = `${id}-error`;
  return <label htmlFor={id} className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300"><span>{label}</span><input id={id} type={type} dir={dir} value={value} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onChange(event.target.value)} className={`min-h-11 min-w-0 rounded-xl border bg-white px-3 text-sm font-normal text-slate-950 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100 ${error ? "border-rose-500" : "border-slate-300 dark:border-slate-700"}`} /><InvoiceFieldError id={errorId} code={error} copy={copy} /></label>;
}

function GeneratedInvoice({ generator, copy, lang }: { generator: ReturnType<typeof useGenerateInvoice>; copy: InvoiceCopy; lang: "ar" | "en" }) {
  const created = generator.created;
  if (!created) return null;
  return (
    <div className="mx-auto w-full max-w-4xl space-y-3">
      <section role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
        <h1 className="text-xl font-semibold">{copy.generated}</h1><p className="mt-1 text-sm">{copy.generatedHelp}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3"><Evidence label={copy.number} value={created.data.number} mono /><Evidence label={copy.status} value={created.data.status} mono /><Evidence label={copy.total} value={formatInvoiceMoney(created.data.total, created.data.currencyCode)} mono /></dl>
        <div className="mt-5 flex flex-wrap gap-2">
          {generator.permissions.canRead ? <Link href={`/invoices/${created.data.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900">{copy.viewGenerated}</Link> : null}
          <button type="button" onClick={generator.startAnother} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-300 px-4 text-sm font-semibold"><RotateCcw className="size-4" />{copy.startAnother}</button>
        </div>
      </section>
      <InvoiceSnapshotMeta snapshot={created} copy={copy} lang={lang} />
    </div>
  );
}

function Evidence({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div className="rounded-xl bg-white/70 px-3 py-2 dark:bg-slate-950/40"><dt className="text-xs font-semibold opacity-70">{label}</dt><dd dir={mono ? "ltr" : undefined} className={`mt-1 text-base font-semibold ${mono ? "font-mono text-start" : ""}`}>{value}</dd></div>;
}
