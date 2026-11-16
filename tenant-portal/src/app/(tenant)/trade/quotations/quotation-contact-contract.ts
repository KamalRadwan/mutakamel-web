import type { TradePath } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";
import { record, tradeInvalidResponse } from "../documents/trade-document-contract";
import { QUOTATIONS_PATH } from "./quotation-contract";

export type QuotationPartyType = "PERSON" | "ORGANIZATION";
export const QUOTATION_CONTACT_RELATIONSHIPS = ["CONTACT_PERSON", "BILLING_CONTACT", "LEGAL_CONTACT"] as const;
export const QUOTATION_CONTACT_CURSOR_MAX = 2048;
export const QUOTATION_CONTACT_SEARCH_MAX = 120;

export interface QuotationContactOption {
  partyId: string;
  displayName: string;
  relationshipType: typeof QUOTATION_CONTACT_RELATIONSHIPS[number];
  relationshipLabel: string | null;
  isPrimary: boolean;
  email: string | null;
  mobile: string | null;
  phone: string | null;
}
export interface QuotationSelectedContact extends QuotationContactOption { customerPartyId: string }
export function quotationContactMatchesCustomer(customer: { partyId: string; partyType: QuotationPartyType } | null,
  contactId: string, contact: QuotationSelectedContact | null): boolean {
  return contactId === "" ? contact === null : Boolean(isUUIDv7(contactId) && customer?.partyType === "ORGANIZATION"
    && contact?.partyId === contactId && contact.customerPartyId === customer.partyId);
}
export interface QuotationContactPage {
  partyType: QuotationPartyType;
  items: QuotationContactOption[];
  nextCursor: string | null;
}

export function quotationContactOptionsPath(partyId: string, search: string, cursor: string | null): TradePath {
  if (!isUUIDv7(partyId)) tradeInvalidResponse();
  const query = new URLSearchParams({ partyId, limit: "50" });
  const term = [...search.trim()].slice(0, QUOTATION_CONTACT_SEARCH_MAX).join("");
  if (term) query.set("search", term);
  if (cursor) {
    if (cursor.length > QUOTATION_CONTACT_CURSOR_MAX) tradeInvalidResponse();
    query.set("cursor", cursor);
  }
  return `${QUOTATIONS_PATH}/contact-options?${query.toString()}` as TradePath;
}

function nullableContactText(value: unknown, max: number): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || [...value].length > max) tradeInvalidResponse();
  return value;
}

export function parseQuotationContactOption(value: unknown): QuotationContactOption {
  const row = record(value);
  if (!row || !isUUIDv7(row.partyId) || typeof row.displayName !== "string" || !row.displayName.trim()
    || [...row.displayName].length > 200 || typeof row.isPrimary !== "boolean"
    || !QUOTATION_CONTACT_RELATIONSHIPS.some((type) => type === row.relationshipType)) tradeInvalidResponse();
  return { partyId: row.partyId, displayName: row.displayName,
    relationshipType: row.relationshipType as QuotationContactOption["relationshipType"], isPrimary: row.isPrimary,
    relationshipLabel: nullableContactText(row.relationshipLabel, 120), email: nullableContactText(row.email, 255),
    mobile: nullableContactText(row.mobile, 255), phone: nullableContactText(row.phone, 255) };
}

export function parseQuotationContactPage(value: unknown): QuotationContactPage {
  const page = record(value);
  if (!page || (page.partyType !== "PERSON" && page.partyType !== "ORGANIZATION") || !Array.isArray(page.items)
    || page.items.length > 100 || (page.partyType === "PERSON" && page.items.length > 0)
    || (page.nextCursor !== undefined && (typeof page.nextCursor !== "string" || !page.nextCursor
      || page.nextCursor.length > QUOTATION_CONTACT_CURSOR_MAX))) tradeInvalidResponse();
  return { partyType: page.partyType, items: page.items.map(parseQuotationContactOption),
    nextCursor: typeof page.nextCursor === "string" ? page.nextCursor : null };
}
