"use client";

import Link from "next/link";
import { Filter, Plus, RefreshCw, RotateCcw } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useInvoicesList } from "../hooks/use-invoices-list";
import { INVOICE_SORT_FIELDS, INVOICE_STATUSES, type Invoice, type InvoiceListFilterDraft } from "../types/invoices";
import {
  formatInvoiceDate,
  formatInvoiceMoney,
  INVOICE_COPY,
  InvoiceFieldError,
  InvoiceHero,
  InvoicePageFrame,
  InvoiceSnapshotMeta,
  InvoiceStatePanel,
  RetryInvoiceButton,
  type InvoiceCopy,
} from "./invoice-shared";
import {
  Button,
  Card,
  CardContent,
  DataTable,
  Field,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  StatusBadge,
  type ColumnDef,
} from "@/design-system";

export function InvoicesListScreen() {
  const { lang, dir } = useI18n();
  const copy = INVOICE_COPY[lang];
  const invoices = useInvoicesList();

  return (
    <InvoicePageFrame dir={dir}>
      <InvoiceHero
        copy={copy}
        action={
          invoices.permissions.canCreate ? (
            <Button variant="primary" asChild>
              <Link href="/invoices/new">
                <Plus className="size-4" aria-hidden="true" />
                {copy.generate}
              </Link>
            </Button>
          ) : undefined
        }
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
  return (
    <Card>
      <CardContent>
        <form aria-label={copy.filters} onSubmit={invoices.submitFilters} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="inline-flex items-center gap-2 text-base font-semibold">
              <Filter className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              {copy.filters}
            </h2>
            <Button type="button" variant="outline" size="sm" onClick={invoices.refresh} disabled={invoices.isRefreshing}>
              <RefreshCw className={`size-4 ${invoices.isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              {copy.refresh}
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Field label={copy.search} error={invoices.validationErrors.search ? errorText(invoices.validationErrors.search, copy) : undefined}>
              {(fp) => (
                <Input
                  {...fp}
                  value={invoices.draft.search}
                  maxLength={201}
                  invalid={Boolean(invoices.validationErrors.search)}
                  onChange={(event) => invoices.updateFilter("search", event.target.value)}
                />
              )}
            </Field>
            <Field label={copy.tenantId} error={invoices.validationErrors.tenantId ? errorText(invoices.validationErrors.tenantId, copy) : undefined}>
              {(fp) => (
                <Input
                  {...fp}
                  dir="ltr"
                  value={invoices.draft.tenantId}
                  invalid={Boolean(invoices.validationErrors.tenantId)}
                  onChange={(event) => invoices.updateFilter("tenantId", event.target.value)}
                />
              )}
            </Field>
            <Field label={copy.status}>
              {(fp) => (
                <Select
                  value={invoices.draft.status || "ALL"}
                  onValueChange={(value) => invoices.updateFilter("status", (value === "ALL" ? "" : value) as InvoiceListFilterDraft["status"])}
                >
                  <SelectTrigger id={fp.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{copy.allStatuses}</SelectItem>
                    {INVOICE_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label={copy.sortBy}>
              {(fp) => (
                <Select value={invoices.draft.sortBy} onValueChange={(value) => invoices.updateFilter("sortBy", value as InvoiceListFilterDraft["sortBy"])}>
                  <SelectTrigger id={fp.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_SORT_FIELDS.map((field) => (
                      <SelectItem key={field} value={field}>
                        {field}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label={copy.sortDirection}>
              {(fp) => (
                <Select value={invoices.draft.sortDir} onValueChange={(value) => invoices.updateFilter("sortDir", value as InvoiceListFilterDraft["sortDir"])}>
                  <SelectTrigger id={fp.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DESC">{copy.descending}</SelectItem>
                    <SelectItem value="ASC">{copy.ascending}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label={copy.pageSize} error={invoices.validationErrors.limit ? errorText(invoices.validationErrors.limit, copy) : undefined}>
              {(fp) => (
                <Select value={String(invoices.draft.limit)} onValueChange={(value) => invoices.updateFilter("limit", value)}>
                  <SelectTrigger id={fp.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 25, 50, 100].map((limit) => (
                      <SelectItem key={limit} value={String(limit)}>
                        {limit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="outline" onClick={invoices.clearFilters}>
              <RotateCcw className="size-4" aria-hidden="true" />
              {copy.reset}
            </Button>
            <Button type="submit" variant="primary">
              <Filter className="size-4" aria-hidden="true" />
              {copy.apply}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function errorText(code: Parameters<typeof InvoiceFieldError>[0]["code"], copy: InvoiceCopy): string {
  if (!code) return "";
  return {
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
  }[code];
}

function InvoiceListBody({ invoices, copy, lang }: { invoices: ReturnType<typeof useInvoicesList>; copy: InvoiceCopy; lang: "ar" | "en" }) {
  if (invoices.state === "LOADING") return <InvoiceStatePanel kind="loading" title={copy.loading} copy={copy} />;
  if (invoices.state === "UNAVAILABLE") return <InvoiceStatePanel kind="unavailable" title={copy.unavailable} detail={invoices.error?.message} correlationId={invoices.error?.correlationId} copy={copy} action={<RetryInvoiceButton label={copy.retry} onClick={invoices.refresh} />} />;
  if (invoices.state === "ERROR") return <InvoiceStatePanel kind="error" title={copy.error} detail={invoices.error?.message} correlationId={invoices.error?.correlationId} copy={copy} action={<RetryInvoiceButton label={copy.retry} onClick={invoices.refresh} />} />;
  if (!invoices.snapshot) return <InvoiceStatePanel kind="error" title={copy.error} copy={copy} />;
  const data = invoices.snapshot.data;

  const columns: ColumnDef<Invoice>[] = [
    {
      key: "number",
      headerEn: copy.number,
      headerAr: copy.number,
      cell: (invoice) => (
        <div>
          <Link href={`/invoices/${invoice.id}`} className="font-mono font-semibold text-brand-700 hover:underline dark:text-brand-400">
            {invoice.number}
          </Link>
          <code dir="ltr" className="mt-1 block text-xs text-muted-foreground">{invoice.id}</code>
        </div>
      ),
    },
    { key: "status", headerEn: copy.status, headerAr: copy.status, cell: (invoice) => <StatusBadge status={invoice.status} /> },
    { key: "purpose", headerEn: copy.purpose, headerAr: copy.purpose, cell: (invoice) => <span className="font-mono text-xs font-semibold">{invoice.purpose}</span> },
    {
      key: "tenant",
      headerEn: copy.tenant,
      headerAr: copy.tenant,
      cell: (invoice) => (
        <Link href={`/tenants/${invoice.tenantId}`} className="font-mono text-xs text-brand-700 hover:underline dark:text-brand-400">
          {invoice.tenantId}
        </Link>
      ),
    },
    {
      key: "total",
      headerEn: copy.total,
      headerAr: copy.total,
      cell: (invoice) => <span dir="ltr" className="font-mono font-semibold">{formatInvoiceMoney(invoice.total, invoice.currencyCode)}</span>,
    },
    {
      key: "period",
      headerEn: copy.period,
      headerAr: copy.period,
      cell: (invoice) => (
        <span className="whitespace-nowrap">
          {formatInvoiceDate(invoice.periodStart, lang)}
          <span className="mx-1">→</span>
          {formatInvoiceDate(invoice.periodEnd, lang)}
        </span>
      ),
    },
    { key: "dueAt", headerEn: copy.dueAt, headerAr: copy.dueAt, cell: (invoice) => <span className="whitespace-nowrap">{formatInvoiceDate(invoice.dueAt, lang)}</span> },
    { key: "updatedAt", headerEn: copy.updatedAt, headerAr: copy.updatedAt, cell: (invoice) => <span className="whitespace-nowrap">{formatInvoiceDate(invoice.updatedAt, lang)}</span> },
    {
      key: "actions",
      headerEn: copy.actions,
      headerAr: copy.actions,
      align: "end",
      cell: (invoice) => (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/invoices/${invoice.id}`}>{copy.open}</Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <DataTable
        columns={columns}
        data={data.items}
        getRowId={(invoice) => invoice.id}
        pagination={{
          page: data.page,
          limit: data.limit,
          totalItems: data.total,
          totalPages: Math.max(data.totalPages, 1),
          onPageChange: invoices.goToPage,
        }}
        emptyState={{ titleEn: copy.empty, titleAr: copy.empty }}
      />
      <InvoiceSnapshotMeta snapshot={invoices.snapshot} copy={copy} lang={lang} />
    </div>
  );
}
