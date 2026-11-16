import { formatTemplate } from "@/lib/format/template";

export interface QuotationShareContext {
  reference: string;
  customerName: string;
  currencyCode: string;
  grandTotal: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  subjectTemplate: string;
  bodyTemplate: string;
}

/**
 * Strips formatting characters from a phone number for `https://wa.me/<digits>`.
 * Leading `+` and `00` international prefixes are normalized to bare digits.
 */
export function normalizeWhatsAppDigits(rawPhone: string | null | undefined): string {
  if (!rawPhone) return "";
  const trimmed = rawPhone.trim();
  const withoutPlus = trimmed.startsWith("+")
    ? trimmed.slice(1)
    : trimmed.startsWith("00")
      ? trimmed.slice(2)
      : trimmed;
  return withoutPlus.replace(/\D+/gu, "");
}

function buildQuotationShareSubject(ctx: QuotationShareContext): string {
  return formatTemplate(ctx.subjectTemplate, {
    reference: ctx.reference,
    customer: ctx.customerName,
  });
}

function buildQuotationShareBody(ctx: QuotationShareContext): string {
  return formatTemplate(ctx.bodyTemplate, {
    reference: ctx.reference,
    customer: ctx.customerName,
    currency: ctx.currencyCode,
    total: ctx.grandTotal,
  });
}

export function buildQuotationEmailHref(ctx: QuotationShareContext): string {
  const recipient = ctx.recipientEmail?.trim() ?? "";
  const subject = encodeURIComponent(buildQuotationShareSubject(ctx));
  const body = encodeURIComponent(buildQuotationShareBody(ctx));
  return `mailto:${encodeURIComponent(recipient)}?subject=${subject}&body=${body}`;
}

export function buildQuotationWhatsAppHref(ctx: QuotationShareContext): string {
  const digits = normalizeWhatsAppDigits(ctx.recipientPhone);
  const text = encodeURIComponent(buildQuotationShareBody(ctx));
  return digits.length >= 7
    ? `https://wa.me/${digits}?text=${text}`
    : `https://wa.me/?text=${text}`;
}

export function buildQuotationTelegramHref(ctx: QuotationShareContext): string {
  const text = encodeURIComponent(buildQuotationShareBody(ctx));
  return `https://t.me/share/url?url=&text=${text}`;
}
