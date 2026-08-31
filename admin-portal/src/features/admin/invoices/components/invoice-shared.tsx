"use client";

import type { ReactNode } from "react";
import { AlertTriangle, FileText, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { PageHeader, Badge, Button, resolveStatusTone } from "@/design-system";
import type {
  CoreSnapshot,
  InvoiceMutationState,
  InvoicePurpose,
  InvoiceStatus,
  InvoiceValidationCode,
} from "../types/invoices";

export const INVOICE_COPY = {
  en: {
    title: "Invoice operations",
    readOnly: "Control-plane billing",
    generate: "Generate invoice",
    backToInvoices: "Back to invoices",
    filters: "Invoice filters",
    search: "Invoice number",
    tenantId: "Tenant UUID v7",
    status: "Status",
    allStatuses: "All statuses",
    sortBy: "Sort by",
    sortDirection: "Direction",
    ascending: "Ascending",
    descending: "Descending",
    pageSize: "Rows per page",
    apply: "Apply filters",
    reset: "Reset filters",
    refresh: "Refresh",
    loading: "Loading invoice evidence…",
    forbiddenRead: "You do not have permission to read invoices.",
    forbiddenCreate: "You do not have permission to generate invoices.",
    readPermission: "Required permission: admin.invoices.read",
    createPermission: "Required permission: admin.invoices.create",
    unavailable: "The invoice service is currently unavailable.",
    notFound: "This invoice no longer exists or is inaccessible.",
    error: "Invoice evidence could not be loaded.",
    empty: "No invoices match the applied filters.",
    retry: "Retry",
    number: "Invoice",
    purpose: "Purpose",
    tenant: "Tenant",
    tenantUnavailable: "Tenant no longer exists",
    total: "Total",
    period: "Service period",
    dueAt: "Due at",
    issuedAt: "Issued at",
    paidAt: "Paid at",
    createdAt: "Created",
    updatedAt: "Updated",
    actions: "Actions",
    open: "Open invoice",
    previous: "Previous page",
    next: "Next page",
    page: "Page",
    of: "of",
    rows: "records",
    correlation: "Correlation ID",
    responseAt: "Response received",
    generationTitle: "Generate from subscription",
    generationHelp: "Core loads the tenant subscription and computes canonical USD lines and totals. The browser does not price this invoice.",
    periodStart: "Service period starts",
    periodEnd: "Service period ends",
    currency: "Accounting currency",
    canonicalUsd: "USD — enforced by Core settlement",
    submitGenerate: "Generate draft invoice",
    generating: "Generating draft…",
    generated: "Draft invoice generated",
    generatedHelp: "The authoritative response has been received. Review the document before issue.",
    viewGenerated: "View generated invoice",
    startAnother: "Generate another",
    identity: "Document identity",
    financials: "Financial evidence",
    dates: "Lifecycle dates",
    subscriptionId: "Subscription UUID",
    subtotal: "Subtotal",
    tax: "Tax",
    amountPaid: "Allocated payments (USD)",
    settlementTotal: "Settlement total (USD)",
    fxRate: "FX units per USD",
    notRecorded: "Not recorded",
    invoiceLines: "Invoice lines",
    description: "Description",
    quantity: "Quantity",
    unitPrice: "Unit price",
    lineTotal: "Line total",
    editDraft: "Edit manual draft",
    issueInvoice: "Issue invoice",
    voidInvoice: "Void invoice",
    offlinePayment: "Record offline payment in tenant billing",
    offlinePaymentHint: "Open the tenant workspace and select Billing to use the existing reviewed payment workflow.",
    systemDraftLocked: "System-generated trial, renewal, and proration drafts are immutable.",
    addLine: "Add invoice line",
    removeLine: "Remove line",
    optionalDueAt: "Draft due date (optional)",
    saveDraft: "Save draft",
    saving: "Saving…",
    issueTitle: "Confirm invoice issue",
    voidTitle: "Confirm invoice void",
    reviewReason: "Operator review reason",
    reviewReasonHint: "Required for the operator confirmation in this browser. Core's strict issue/void DTO has no reason field, so this text is not transmitted or persisted.",
    issueConfirmation: "I reviewed the amount, period, recipient tenant, and due date and intend to issue this invoice.",
    voidConfirmation: "I reviewed collection and allocation evidence and intend to void this invoice.",
    confirmIssue: "Issue confirmed invoice",
    confirmVoid: "Void confirmed invoice",
    cancel: "Cancel",
    commandSucceeded: "The authoritative invoice command succeeded.",
    commandForbidden: "Your current permissions do not authorize this command.",
    commandConflict: "The invoice changed or its lifecycle no longer permits this command. Authoritative state was refreshed.",
    commandValidation: "Core rejected the command fields. Review the form and try a new corrected intent.",
    commandInFlight: "This exact UUIDv7 command is still in flight. Retry keeps the same command identity.",
    commandUnavailable: "The command outcome may be ambiguous. Invoice state was refreshed; retry unchanged fields to reuse the same identity.",
    commandError: "The invoice command failed.",
    invalidUuid: "Enter a UUID v7 identifier.",
    searchTooLong: "Search must be at most 200 characters.",
    invalidLimit: "Choose a supported page size.",
    invalidPeriodStart: "Enter a valid service-period start date and time.",
    invalidPeriodEnd: "Enter a valid service-period end date and time.",
    invalidPeriodRange: "The service-period end must be after its start.",
    invalidDueDate: "Enter a valid due date and time.",
    dueDateCannotClear: "Core does not support clearing an existing due date. Choose a replacement date and time.",
    linesRequired: "A manual draft requires at least one line.",
    tooManyLines: "An invoice supports at most 200 lines.",
    descriptionRequired: "Enter a line description.",
    descriptionTooLong: "Description must be at most 255 characters.",
    invalidQuantity: "Use a positive decimal up to 10 integer and 2 fractional digits.",
    invalidUnitPrice: "Use a non-negative decimal up to 14 integer and 4 fractional digits.",
    reasonRequired: "Enter the operator review reason.",
    reasonTooLong: "Review reason must be at most 500 characters.",
    confirmationRequired: "Confirm the reviewed command before continuing.",
  },
  ar: {
    title: "عمليات الفواتير",
    readOnly: "فوترة منصة التحكم",
    generate: "إنشاء فاتورة",
    backToInvoices: "العودة إلى الفواتير",
    filters: "عوامل تصفية الفواتير",
    search: "رقم الفاتورة",
    tenantId: "معرّف المستأجر UUID v7",
    status: "الحالة",
    allStatuses: "كل الحالات",
    sortBy: "الترتيب حسب",
    sortDirection: "الاتجاه",
    ascending: "تصاعدي",
    descending: "تنازلي",
    pageSize: "صفوف الصفحة",
    apply: "تطبيق التصفية",
    reset: "إعادة ضبط التصفية",
    refresh: "تحديث",
    loading: "جارٍ تحميل أدلة الفواتير…",
    forbiddenRead: "لا تملك صلاحية قراءة الفواتير.",
    forbiddenCreate: "لا تملك صلاحية إنشاء الفواتير.",
    readPermission: "الصلاحية المطلوبة: admin.invoices.read",
    createPermission: "الصلاحية المطلوبة: admin.invoices.create",
    unavailable: "خدمة الفواتير غير متاحة حاليًا.",
    notFound: "هذه الفاتورة لم تعد موجودة أو لا يمكن الوصول إليها.",
    error: "تعذر تحميل أدلة الفاتورة.",
    empty: "لا توجد فواتير تطابق عوامل التصفية.",
    retry: "إعادة المحاولة",
    number: "الفاتورة",
    purpose: "الغرض",
    tenant: "المستأجر",
    tenantUnavailable: "المستأجر لم يعد موجودًا",
    total: "الإجمالي",
    period: "فترة الخدمة",
    dueAt: "تاريخ الاستحقاق",
    issuedAt: "تاريخ الإصدار",
    paidAt: "تاريخ السداد",
    createdAt: "تاريخ الإنشاء",
    updatedAt: "آخر تحديث",
    actions: "الإجراءات",
    open: "فتح الفاتورة",
    previous: "الصفحة السابقة",
    next: "الصفحة التالية",
    page: "صفحة",
    of: "من",
    rows: "سجل",
    correlation: "معرّف التتبع",
    responseAt: "وقت استلام الاستجابة",
    generationTitle: "إنشاء من الاشتراك",
    generationHelp: "تقرأ Core اشتراك المستأجر وتحسب البنود والإجماليات بالدولار الأمريكي. المتصفح لا يسعّر الفاتورة.",
    periodStart: "بداية فترة الخدمة",
    periodEnd: "نهاية فترة الخدمة",
    currency: "عملة المحاسبة",
    canonicalUsd: "USD — مفروضة بواسطة تسوية Core",
    submitGenerate: "إنشاء مسودة فاتورة",
    generating: "جارٍ إنشاء المسودة…",
    generated: "تم إنشاء مسودة الفاتورة",
    generatedHelp: "تم استلام الاستجابة الموثوقة. راجع المستند قبل الإصدار.",
    viewGenerated: "عرض الفاتورة المنشأة",
    startAnother: "إنشاء فاتورة أخرى",
    identity: "هوية المستند",
    financials: "الأدلة المالية",
    dates: "تواريخ دورة الحياة",
    subscriptionId: "معرّف الاشتراك",
    subtotal: "الإجمالي الفرعي",
    tax: "الضريبة",
    amountPaid: "الدفعات المخصصة (USD)",
    settlementTotal: "إجمالي التسوية (USD)",
    fxRate: "وحدات الصرف لكل USD",
    notRecorded: "غير مسجل",
    invoiceLines: "بنود الفاتورة",
    description: "الوصف",
    quantity: "الكمية",
    unitPrice: "سعر الوحدة",
    lineTotal: "إجمالي البند",
    editDraft: "تعديل المسودة اليدوية",
    issueInvoice: "إصدار الفاتورة",
    voidInvoice: "إبطال الفاتورة",
    offlinePayment: "تسجيل دفعة خارجية في فوترة المستأجر",
    offlinePaymentHint: "افتح مساحة المستأجر واختر الفوترة لاستخدام مسار الدفع القائم الخاضع للمراجعة.",
    systemDraftLocked: "مسودات التجربة والتجديد والتوزيع المنشأة آليًا غير قابلة للتعديل.",
    addLine: "إضافة بند فاتورة",
    removeLine: "حذف البند",
    optionalDueAt: "استحقاق المسودة (اختياري)",
    saveDraft: "حفظ المسودة",
    saving: "جارٍ الحفظ…",
    issueTitle: "تأكيد إصدار الفاتورة",
    voidTitle: "تأكيد إبطال الفاتورة",
    reviewReason: "سبب مراجعة المشغّل",
    reviewReasonHint: "مطلوب لتأكيد المشغّل في هذا المتصفح. لا تحتوي DTO الصارمة في Core على حقل سبب، لذلك لا يُرسل هذا النص ولا يُحفظ.",
    issueConfirmation: "راجعت المبلغ والفترة والمستأجر المستلم وتاريخ الاستحقاق وأقصد إصدار هذه الفاتورة.",
    voidConfirmation: "راجعت أدلة التحصيل والتخصيص وأقصد إبطال هذه الفاتورة.",
    confirmIssue: "إصدار الفاتورة المؤكدة",
    confirmVoid: "إبطال الفاتورة المؤكدة",
    cancel: "إلغاء",
    commandSucceeded: "نجح أمر الفاتورة وتم استلام الحالة الموثوقة.",
    commandForbidden: "صلاحياتك الحالية لا تسمح بهذا الأمر.",
    commandConflict: "تغيرت الفاتورة أو لم تعد دورة حياتها تسمح بالأمر. تم تحديث الحالة الموثوقة.",
    commandValidation: "رفضت Core حقول الأمر. راجع النموذج وأرسل نية مصححة جديدة.",
    commandInFlight: "أمر UUIDv7 نفسه ما زال قيد التنفيذ. تحتفظ الإعادة بهوية الأمر نفسها.",
    commandUnavailable: "قد تكون نتيجة الأمر ملتبسة. تم تحديث حالة الفاتورة؛ أعد المحاولة دون تغيير الحقول لإعادة استخدام الهوية نفسها.",
    commandError: "فشل أمر الفاتورة.",
    invalidUuid: "أدخل معرّفًا بصيغة UUID v7.",
    searchTooLong: "يجب ألا يتجاوز البحث 200 حرف.",
    invalidLimit: "اختر حجم صفحة مدعومًا.",
    invalidPeriodStart: "أدخل تاريخ ووقت بداية صالحين لفترة الخدمة.",
    invalidPeriodEnd: "أدخل تاريخ ووقت نهاية صالحين لفترة الخدمة.",
    invalidPeriodRange: "يجب أن تكون نهاية فترة الخدمة بعد بدايتها.",
    invalidDueDate: "أدخل تاريخ ووقت استحقاق صالحين.",
    dueDateCannotClear: "لا تدعم Core إزالة تاريخ استحقاق موجود. اختر تاريخًا ووقتًا بديلين.",
    linesRequired: "تتطلب المسودة اليدوية بندًا واحدًا على الأقل.",
    tooManyLines: "تدعم الفاتورة 200 بند كحد أقصى.",
    descriptionRequired: "أدخل وصف البند.",
    descriptionTooLong: "يجب ألا يتجاوز الوصف 255 حرفًا.",
    invalidQuantity: "استخدم عددًا موجبًا حتى 10 خانات صحيحة وخانتين عشريتين.",
    invalidUnitPrice: "استخدم عددًا غير سالب حتى 14 خانة صحيحة و4 خانات عشرية.",
    reasonRequired: "أدخل سبب مراجعة المشغّل.",
    reasonTooLong: "يجب ألا يتجاوز سبب المراجعة 500 حرف.",
    confirmationRequired: "أكد الأمر الذي تمت مراجعته قبل المتابعة.",
  },
} as const;

export type InvoiceCopy = (typeof INVOICE_COPY)["en"] | (typeof INVOICE_COPY)["ar"];

/**
 * Purpose is a wire enum with no design-system vocabulary of its own.
 * Operators read invoices, not Core's codes, so it is resolved to a written
 * label in both languages before it reaches the screen.
 */
const INVOICE_PURPOSE_LABELS: Record<InvoicePurpose, { en: string; ar: string }> = {
  TRIAL_ACTIVATION: { en: "Trial activation", ar: "تفعيل التجربة" },
  RENEWAL: { en: "Renewal", ar: "تجديد" },
  PRORATION: { en: "Proration", ar: "تسوية تناسبية" },
  MANUAL: { en: "Manual", ar: "يدوية" },
};

export function invoicePurposeLabel(purpose: InvoicePurpose, lang: "ar" | "en"): string {
  return INVOICE_PURPOSE_LABELS[purpose][lang];
}

/**
 * Read from the same tone map the status badge renders, so a status chosen in
 * the filter is worded exactly like the badges it returns.
 */
export function invoiceStatusLabel(status: InvoiceStatus, lang: "ar" | "en"): string {
  const tone = resolveStatusTone(status, "invoice");
  return lang === "ar" ? tone.labelAr : tone.labelEn;
}

export function InvoicePageFrame({
  children,
  dir,
}: {
  children: ReactNode;
  dir: "rtl" | "ltr";
}) {
  return (
    <div dir={dir} className="mx-auto w-full max-w-[1600px] space-y-4">
      {children}
    </div>
  );
}

export function InvoiceHero({ copy, action }: { copy: InvoiceCopy; action?: ReactNode }) {
  return (
    <PageHeader
      title={copy.title}
      status={<Badge tone="neutral">{copy.readOnly}</Badge>}
      action={action}
    />
  );
}

export function InvoiceStatePanel({
  kind,
  title,
  detail,
  correlationId,
  copy,
  action,
}: {
  kind: "loading" | "empty" | "forbidden" | "notFound" | "unavailable" | "error";
  title: string;
  detail?: string;
  correlationId?: string;
  copy: InvoiceCopy;
  action?: ReactNode;
}) {
  const Icon = kind === "loading" ? Loader2 : kind === "forbidden" ? ShieldAlert : kind === "error" || kind === "unavailable" ? AlertTriangle : FileText;
  const tone = kind === "error"
    ? "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground"
    : kind === "forbidden" || kind === "unavailable"
      ? "border-warning/30 bg-warning-subtle text-warning-subtle-foreground"
      : "border-border bg-card text-foreground";
  return (
    <section role={kind === "loading" || kind === "empty" ? "status" : "alert"} className={`flex min-h-56 flex-col items-center justify-center rounded-lg border p-6 text-center ${tone}`}>
      <Icon className={`mb-3 size-9 opacity-70 ${kind === "loading" ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
      <h2 className="text-base font-semibold">{title}</h2>
      {detail ? <p className="mt-2 max-w-2xl text-sm leading-6 opacity-85">{detail}</p> : null}
      {correlationId ? (
        <p className="mt-2 max-w-full text-sm">
          <strong>{copy.correlation}:</strong> <code dir="ltr" className="select-all break-all">{correlationId}</code>
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

export function InvoiceMutationNotice({ mutation, copy }: { mutation: InvoiceMutationState; copy: InvoiceCopy }) {
  if (mutation.phase === "IDLE" || mutation.phase === "PENDING") return null;
  const message = {
    SUCCEEDED: copy.commandSucceeded,
    FORBIDDEN: copy.commandForbidden,
    CONFLICT: copy.commandConflict,
    VALIDATION: copy.commandValidation,
    IN_FLIGHT: copy.commandInFlight,
    UNAVAILABLE: copy.commandUnavailable,
    ERROR: copy.commandError,
  }[mutation.phase];
  const danger = mutation.phase === "ERROR" || mutation.phase === "FORBIDDEN";
  const tone = danger
    ? "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground"
    : mutation.phase === "SUCCEEDED"
      ? "border-success/30 bg-success-subtle text-success-subtle-foreground"
      : mutation.phase === "IN_FLIGHT"
        ? "border-info/30 bg-info-subtle text-info-subtle-foreground"
        : "border-warning/30 bg-warning-subtle text-warning-subtle-foreground";
  return (
    <div role={danger || mutation.phase === "CONFLICT" || mutation.phase === "VALIDATION" || mutation.phase === "UNAVAILABLE" ? "alert" : "status"} aria-live="polite" className={`rounded-lg border px-4 py-3 text-sm ${tone}`}>
      <p className="font-semibold">{message}</p>
      {mutation.error ? <p className="mt-1 leading-6">{mutation.error.message}</p> : null}
      {mutation.error?.errorCode ? <code dir="ltr" className="mt-1 block break-all text-sm">{mutation.error.errorCode}</code> : null}
      {mutation.correlationId ? <p className="mt-1 text-sm"><strong>{copy.correlation}:</strong> <code dir="ltr" className="select-all break-all">{mutation.correlationId}</code></p> : null}
    </div>
  );
}

export function InvoiceSnapshotMeta({ snapshot, copy, lang }: { snapshot: CoreSnapshot<unknown>; copy: InvoiceCopy; lang: "ar" | "en" }) {
  return (
    <footer className="grid gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground sm:grid-cols-2">
      <p><strong className="text-foreground">{copy.responseAt}:</strong> {formatInvoiceDate(snapshot.responseTimestamp, lang)}</p>
      <p className="min-w-0"><strong className="text-foreground">{copy.correlation}:</strong> <code dir="ltr" className="ms-1 select-all break-all">{snapshot.correlationId}</code></p>
    </footer>
  );
}

export function InvoiceFieldError({ id, code, copy }: { id: string; code?: InvoiceValidationCode; copy: InvoiceCopy }) {
  if (!code) return null;
  return <span id={id} role="alert" className="text-sm font-medium text-destructive-subtle-foreground">{invoiceValidationMessage(code, copy)}</span>;
}

export function invoiceValidationMessage(code: InvoiceValidationCode, copy: InvoiceCopy): string {
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

export function formatInvoiceDate(value: string | null, lang: "ar" | "en"): string {
  if (!value) return INVOICE_COPY[lang].notRecorded;
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

/**
 * A service period is a calendar boundary, not an instant: its stored
 * timestamps are day edges in UTC, so a locale clock would only add noise.
 * Rendered as a fixed dd/MM/yyyy in Latin digits so the same row reads
 * identically in both languages.
 */
export function formatInvoiceDateOnly(value: string | null, lang: "ar" | "en"): string {
  if (!value) return INVOICE_COPY[lang].notRecorded;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return INVOICE_COPY[lang].notRecorded;
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${parsed.getUTCFullYear()}`;
}

export function formatInvoiceServicePeriod(
  start: string | null,
  end: string | null,
  lang: "ar" | "en",
): string {
  if (!start && !end) return INVOICE_COPY[lang].notRecorded;
  return `${formatInvoiceDateOnly(start, lang)} → ${formatInvoiceDateOnly(end, lang)}`;
}

export function formatInvoiceDecimal(value: string): string {
  const match = /^(\d+)(\.\d+)?$/.exec(value);
  if (!match) return value;
  return `${match[1].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${match[2] ?? ""}`;
}

export function formatInvoiceMoney(value: string, currency: string): string {
  return `${currency} ${formatInvoiceDecimal(value)}`;
}

export function RetryInvoiceButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="primary" onClick={onClick}>
      <RefreshCw className="size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
