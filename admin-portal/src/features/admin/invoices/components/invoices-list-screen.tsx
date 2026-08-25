"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Filter, Plus, RefreshCw, RotateCcw } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useInvoicesList } from "../hooks/use-invoices-list";
import { INVOICE_SORT_FIELDS, INVOICE_STATUSES, type InvoiceListFilterDraft } from "../types/invoices";
import {
  formatInvoiceDate,
  formatInvoiceMoney,
  INVOICE_COPY,
  InvoiceFieldError,
  InvoiceHero,
  InvoicePageFrame,
  InvoiceSnapshotMeta,
  InvoiceStatePanel,
  InvoiceStatusBadge,
  RetryInvoiceButton,
  type InvoiceCopy,
} from "./invoice-shared";

export function InvoicesListScreen() {
  const { lang, dir } = useI18n();
  const copy = INVOICE_COPY[lang];
  const invoices = useInvoicesList();

  return (
    <InvoicePageFrame dir={dir}>
      <InvoiceHero
        copy={copy}
        action={invoices.permissions.canCreate ? (
          <Link href="/invoices/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-indigo-950 shadow-sm transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
            <Plus className="size-4" aria-hidden="true" />
            {copy.generate}
          </Link>
        ) : undefined}
      />

      {invoices.state === "FORBIDDEN" ? (
        <InvoiceStatePanel kind="forbidden" title={copy.forbiddenRead} detail={copy.readPermission} copy={copy} />
      ) : (
        <>
          <InvoiceFilters invoices={invoices} copy={copy} />
          <InvoiceListBody invoices={invoices} copy={copy} lang={lang} />
        </>
      )}
    </InvoicePageFrame>
  );
}

function InvoiceFilters({
  invoices,
  copy,
}: {
  invoices: ReturnType<typeof useInvoicesList>;
  copy: InvoiceCopy;
}) {
  const inputClass = "min-h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
  return (
    <form aria-label={copy.filters} onSubmit={invoices.submitFilters} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-base font-black"><Filter className="size-4 text-indigo-600" aria-hidden="true" />{copy.filters}</h2>
        <button type="button" onClick={invoices.refresh} disabled={invoices.isRefreshing} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-3 text-sm font-bold text-indigo-800 disabled:cursor-wait disabled:opacity-60 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
          <RefreshCw className={`size-4 ${invoices.isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />{copy.refresh}
        </button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <FilterInput id="invoice-search" label={copy.search} value={invoices.draft.search} maxLength={201} error={invoices.validationErrors.search} copy={copy} onChange={(value) => invoices.updateFilter("search", value)} />
        <FilterInput id="invoice-tenant" label={copy.tenantId} value={invoices.draft.tenantId} dir="ltr" error={invoices.validationErrors.tenantId} copy={copy} onChange={(value) => invoices.updateFilter("tenantId", value)} />
        <FilterSelect label={copy.status} value={invoices.draft.status} className={inputClass} onChange={(value) => invoices.updateFilter("status", value as InvoiceListFilterDraft["status"])}>
          <option value="">{copy.allStatuses}</option>
          {INVOICE_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
        </FilterSelect>
        <FilterSelect label={copy.sortBy} value={invoices.draft.sortBy} className={inputClass} onChange={(value) => invoices.updateFilter("sortBy", value as InvoiceListFilterDraft["sortBy"])}>
          {INVOICE_SORT_FIELDS.map((field) => <option key={field} value={field}>{field}</option>)}
        </FilterSelect>
        <FilterSelect label={copy.sortDirection} value={invoices.draft.sortDir} className={inputClass} onChange={(value) => invoices.updateFilter("sortDir", value as InvoiceListFilterDraft["sortDir"])}>
          <option value="DESC">{copy.descending}</option><option value="ASC">{copy.ascending}</option>
        </FilterSelect>
        <FilterSelect label={copy.pageSize} value={invoices.draft.limit} className={inputClass} onChange={(value) => invoices.updateFilter("limit", value)} error={invoices.validationErrors.limit} copy={copy}>
          {[10, 20, 25, 50, 100].map((limit) => <option key={limit} value={limit}>{limit}</option>)}
        </FilterSelect>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
        <button type="button" onClick={invoices.clearFilters} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"><RotateCcw className="size-4" aria-hidden="true" />{copy.reset}</button>
        <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-700 px-4 text-sm font-black text-white hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><Filter className="size-4" aria-hidden="true" />{copy.apply}</button>
      </div>
    </form>
  );
}

function FilterInput({ id, label, value, onChange, error, copy, maxLength, dir }: { id: string; label: string; value: string; onChange: (value: string) => void; error?: Parameters<typeof InvoiceFieldError>[0]["code"]; copy: InvoiceCopy; maxLength?: number; dir?: "ltr" }) {
  const errorId = `${id}-error`;
  return (
    <label htmlFor={id} className="grid gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
      <span>{label}</span>
      <input id={id} value={value} dir={dir} maxLength={maxLength} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onChange(event.target.value)} className={`min-h-10 min-w-0 rounded-xl border bg-white px-3 text-sm font-normal text-slate-950 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:text-slate-100 ${error ? "border-rose-500" : "border-slate-300 dark:border-slate-700"}`} />
      <InvoiceFieldError id={errorId} code={error} copy={copy} />
    </label>
  );
}

function FilterSelect({ label, value, onChange, className, children, error, copy }: { label: string; value: string; onChange: (value: string) => void; className: string; children: React.ReactNode; error?: Parameters<typeof InvoiceFieldError>[0]["code"]; copy?: InvoiceCopy }) {
  const errorId = `invoice-select-${label.replaceAll(" ", "-")}-error`;
  return (
    <label className="grid gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
      <span>{label}</span>
      <select value={value} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onChange(event.target.value)} className={className}>{children}</select>
      {copy ? <InvoiceFieldError id={errorId} code={error} copy={copy} /> : null}
    </label>
  );
}

function InvoiceListBody({ invoices, copy, lang }: { invoices: ReturnType<typeof useInvoicesList>; copy: InvoiceCopy; lang: "ar" | "en" }) {
  if (invoices.state === "LOADING") return <InvoiceStatePanel kind="loading" title={copy.loading} copy={copy} />;
  if (invoices.state === "UNAVAILABLE") return <InvoiceStatePanel kind="unavailable" title={copy.unavailable} detail={invoices.error?.message} correlationId={invoices.error?.correlationId} copy={copy} action={<RetryInvoiceButton label={copy.retry} onClick={invoices.refresh} />} />;
  if (invoices.state === "ERROR") return <InvoiceStatePanel kind="error" title={copy.error} detail={invoices.error?.message} correlationId={invoices.error?.correlationId} copy={copy} action={<RetryInvoiceButton label={copy.retry} onClick={invoices.refresh} />} />;
  if (!invoices.snapshot) return <InvoiceStatePanel kind="error" title={copy.error} copy={copy} />;
  if (invoices.state === "EMPTY") return <div className="space-y-3"><InvoiceStatePanel kind="empty" title={copy.empty} copy={copy} /><InvoiceSnapshotMeta snapshot={invoices.snapshot} copy={copy} lang={lang} /></div>;
  const data = invoices.snapshot.data;
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[1180px] text-start text-sm">
          <caption className="sr-only">{copy.title}</caption>
          <thead className="bg-slate-100 text-xs font-black uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300"><tr>{[copy.number, copy.status, copy.purpose, copy.tenant, copy.total, copy.period, copy.dueAt, copy.updatedAt, copy.actions].map((header) => <th key={header} scope="col" className="px-4 py-3 text-start">{header}</th>)}</tr></thead>
          <tbody>
            {data.items.map((invoice) => (
              <tr key={invoice.id} className="border-t border-slate-200 hover:bg-indigo-50/50 dark:border-slate-800 dark:hover:bg-indigo-950/20">
                <td className="px-4 py-3"><Link href={`/invoices/${invoice.id}`} className="font-mono font-black text-indigo-700 hover:underline dark:text-indigo-300">{invoice.number}</Link><code dir="ltr" className="mt-1 block text-xs text-slate-400">{invoice.id}</code></td>
                <td className="px-4 py-3"><InvoiceStatusBadge status={invoice.status} /></td>
                <td className="px-4 py-3 font-mono text-xs font-bold">{invoice.purpose}</td>
                <td className="px-4 py-3"><Link href={`/tenants/${invoice.tenantId}`} className="font-mono text-xs text-indigo-700 hover:underline dark:text-indigo-300">{invoice.tenantId}</Link></td>
                <td dir="ltr" className="px-4 py-3 text-start font-mono font-black">{formatInvoiceMoney(invoice.total, invoice.currencyCode)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatInvoiceDate(invoice.periodStart, lang)}<span className="mx-1">→</span>{formatInvoiceDate(invoice.periodEnd, lang)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatInvoiceDate(invoice.dueAt, lang)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatInvoiceDate(invoice.updatedAt, lang)}</td>
                <td className="px-4 py-3"><Link href={`/invoices/${invoice.id}`} className="inline-flex min-h-10 items-center rounded-xl border border-indigo-300 px-3 text-sm font-bold text-indigo-700 dark:border-indigo-800 dark:text-indigo-300">{copy.open}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <span className="text-sm text-slate-500 dark:text-slate-400">{copy.page} {data.page} {copy.of} {Math.max(data.totalPages, 1)} · {data.total} {copy.rows}</span>
        <div className="flex gap-2">
          <PageButton label={copy.previous} disabled={!data.hasPrev} onClick={invoices.previousPage} icon={<ChevronLeft className={`size-4 ${lang === "ar" ? "rotate-180" : ""}`} />} />
          <PageButton label={copy.next} disabled={!data.hasNext} onClick={invoices.nextPage} icon={<ChevronRight className={`size-4 ${lang === "ar" ? "rotate-180" : ""}`} />} />
        </div>
      </div>
      <InvoiceSnapshotMeta snapshot={invoices.snapshot} copy={copy} lang={lang} />
    </div>
  );
}

function PageButton({ label, disabled, onClick, icon }: { label: string; disabled: boolean; onClick: () => void; icon: React.ReactNode }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700">{icon}{label}</button>;
}
