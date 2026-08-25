import type {
  CriticalInvoiceDraft,
  GenerateInvoiceDraft,
  GenerateInvoiceDto,
  InvoiceEditDraft,
  InvoiceLineInputDto,
  InvoiceListFilterDraft,
  InvoiceListQuery,
  InvoiceValidationErrors,
  IssueInvoiceDto,
  UpdateInvoiceDto,
} from "../types/invoices";

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSITIVE_QUANTITY_12_2 =
  /^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,9}(?:\.\d{1,2})?)$/;
const NON_NEGATIVE_MONEY_18_4 =
  /^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/;
const LIST_LIMITS = new Set([10, 20, 25, 50, 100]);

export function validateInvoiceFilters(
  draft: InvoiceListFilterDraft,
): InvoiceValidationErrors {
  const errors: InvoiceValidationErrors = {};
  if (draft.search.trim().length > 200) errors.search = "SEARCH_TOO_LONG";
  if (draft.tenantId.trim() && !UUID_V7.test(draft.tenantId.trim())) {
    errors.tenantId = "INVALID_UUID_V7";
  }
  if (!LIST_LIMITS.has(Number(draft.limit))) errors.limit = "INVALID_LIMIT";
  return errors;
}

export function buildInvoiceListQuery(
  draft: InvoiceListFilterDraft,
  page: number,
): InvoiceListQuery {
  return {
    page,
    limit: Number(draft.limit),
    sortBy: draft.sortBy,
    sortDir: draft.sortDir,
    ...(draft.search.trim() ? { search: draft.search.trim() } : {}),
    ...(draft.tenantId.trim()
      ? { tenantId: draft.tenantId.trim().toLowerCase() }
      : {}),
    ...(draft.status ? { status: draft.status } : {}),
  };
}

export function validateGenerateInvoice(
  draft: GenerateInvoiceDraft,
): InvoiceValidationErrors {
  const errors: InvoiceValidationErrors = {};
  if (!UUID_V7.test(draft.tenantId.trim())) {
    errors.tenantId = "INVALID_UUID_V7";
  }
  const start = localDateTimeToDate(draft.periodStart);
  const end = localDateTimeToDate(draft.periodEnd);
  if (!start) errors.periodStart = "INVALID_PERIOD_START";
  if (!end) errors.periodEnd = "INVALID_PERIOD_END";
  if (start && end && end.getTime() <= start.getTime()) {
    errors.periodRange = "INVALID_PERIOD_RANGE";
  }
  return errors;
}

export function buildGenerateInvoiceDto(
  draft: GenerateInvoiceDraft,
): GenerateInvoiceDto {
  const start = localDateTimeToDate(draft.periodStart);
  const end = localDateTimeToDate(draft.periodEnd);
  if (!start || !end) throw new Error("INVALID_ADMIN_INVOICE_PERIOD");
  return {
    tenantId: draft.tenantId.trim().toLowerCase(),
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    currencyCode: "USD",
    purpose: draft.purpose,
  };
}

export function validateInvoiceEdit(
  draft: InvoiceEditDraft,
  hasExistingDueAt = false,
): InvoiceValidationErrors {
  const errors: InvoiceValidationErrors = {};
  if (draft.lines.length === 0) errors.lines = "LINES_REQUIRED";
  if (draft.lines.length > 200) errors.lines = "TOO_MANY_LINES";
  draft.lines.forEach((line, index) => {
    const prefix = `lines.${index}`;
    const description = line.description.trim();
    if (!description) errors[`${prefix}.description`] = "DESCRIPTION_REQUIRED";
    else if (description.length > 255) {
      errors[`${prefix}.description`] = "DESCRIPTION_TOO_LONG";
    }
    const quantity = line.quantity.trim();
    if (quantity.length > 13 || !POSITIVE_QUANTITY_12_2.test(quantity)) {
      errors[`${prefix}.quantity`] = "INVALID_QUANTITY";
    }
    const unitPrice = line.unitPrice.trim();
    if (unitPrice.length > 19 || !NON_NEGATIVE_MONEY_18_4.test(unitPrice)) {
      errors[`${prefix}.unitPrice`] = "INVALID_UNIT_PRICE";
    }
  });
  if (hasExistingDueAt && !draft.dueAt) {
    errors.dueAt = "DUE_DATE_CANNOT_CLEAR";
  } else if (draft.dueAt && !localDateTimeToDate(draft.dueAt)) {
    errors.dueAt = "INVALID_DUE_DATE";
  }
  return errors;
}

export function buildUpdateInvoiceDto(draft: InvoiceEditDraft): UpdateInvoiceDto {
  const lines: InvoiceLineInputDto[] = draft.lines.map((line) => ({
    description: line.description.trim(),
    quantity: line.quantity.trim(),
    unitPrice: line.unitPrice.trim(),
  }));
  const dueAt = draft.dueAt ? localDateTimeToDate(draft.dueAt) : null;
  return {
    lines,
    ...(dueAt ? { dueAt: dueAt.toISOString() } : {}),
  };
}

export function validateCriticalInvoiceDraft(
  draft: CriticalInvoiceDraft,
  requireDueAt: boolean,
): InvoiceValidationErrors {
  const errors: InvoiceValidationErrors = {};
  if (requireDueAt && !localDateTimeToDate(draft.dueAt)) {
    errors.dueAt = "INVALID_DUE_DATE";
  }
  const reason = draft.reason.trim();
  if (!reason) errors.reason = "REASON_REQUIRED";
  else if (reason.length > 500) errors.reason = "REASON_TOO_LONG";
  if (!draft.confirmed) errors.confirmed = "CONFIRMATION_REQUIRED";
  return errors;
}

export function buildIssueInvoiceDto(draft: CriticalInvoiceDraft): IssueInvoiceDto {
  const dueAt = localDateTimeToDate(draft.dueAt);
  if (!dueAt) throw new Error("INVALID_ADMIN_INVOICE_DUE_DATE");
  return { dueAt: dueAt.toISOString() };
}

export function isoToLocalDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localDateTimeToDate(value: string): Date | null {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const [year, month, day, hours, minutes, seconds] = match
    .slice(1)
    .map((part) => Number(part ?? 0));
  const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes ||
    date.getSeconds() !== seconds
  ) {
    return null;
  }
  return date;
}
