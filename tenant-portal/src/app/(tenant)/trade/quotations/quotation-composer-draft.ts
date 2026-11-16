import { z } from "zod";
import { safeSessionStorage } from "@/lib/safeStorage";
import { generateUUIDv7, isUUIDv7 } from "@/lib/uuid";
import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { CHANNEL_SCOPE_HEADER } from "../trade-api";
import { parseTradeItems, parseTradeUoms } from "../documents/trade-lookup-contract";
import type { TradeLineDraftSnapshot } from "../documents/hooks/useTradeLineDraft";
import { parseQuotation, parseQuotationCustomerPage,
  type CreateQuotationRequest, type Quotation, type QuotationCustomerOption } from "./quotation-contract";
import { parseQuotationContactOption, quotationContactMatchesCustomer, QUOTATION_CONTACT_RELATIONSHIPS, type QuotationSelectedContact } from "./quotation-contact-contract";
import { defaultQuotationDiscount, quotationDiscountDraftSchema, type QuotationDiscountDraft } from "./quotation-discount-draft";

export const QUOTATION_HANDOFF_STORAGE_KEY = "trade:quotation:composer-handoff";
const SCOPE_KEYS = [COMPANY_SCOPE_HEADER, BRANCH_SCOPE_HEADER, CHANNEL_SCOPE_HEADER] as const;
const HANDOFF_TTL = 30 * 60_000;

export interface QuotationDraftFields {
  selected: QuotationCustomerOption | null;
  currencyCode: string;
  draftReference: string;
  contactPartyId: string;
  selectedContact: QuotationSelectedContact | null;
  validUntil: string;
  paymentTermCode: string;
  incotermCode: string;
  deliveryDays: string;
  warrantyMonths: string;
  discount: QuotationDiscountDraft;
}

export interface QuotationComposerHandoff extends QuotationDraftFields {
  scope: Record<string, string>;
  partialHeader: Quotation | null;
  lineDraft: TradeLineDraftSnapshot;
  replacementSource?: QuotationReplacementSource;
  replacementHandoffId?: string;
}

export function defaultQuotationFields(): QuotationDraftFields {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 14);
  return { selected: null, currencyCode: "", draftReference: "", contactPartyId: "", selectedContact: null,
    validUntil: date.toISOString().slice(0, 10), paymentTermCode: "NET_30",
    incotermCode: "EXW", deliveryDays: "14", warrantyMonths: "12", discount: defaultQuotationDiscount() };
}

export function parseQuotationTerm(input: string, fallback: number): number | null {
  const value = input.trim();
  if (value === "") return fallback;
  if (!/^[0-9]+$/u.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

export function validQuotationDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    && value >= new Date().toISOString().slice(0, 10);
}

export function quotationScope(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(SCOPE_KEYS.flatMap((key) => headers[key] ? [[key, headers[key]]] : []));
}

export function quotationScopeKey(headers: Record<string, string>): string {
  return JSON.stringify(SCOPE_KEYS.map((key) => headers[key] ?? null));
}

export function hasQuotationScope(headers: Record<string, string>): boolean {
  return isUUIDv7(headers[COMPANY_SCOPE_HEADER]) && isUUIDv7(headers[BRANCH_SCOPE_HEADER]);
}

const localLine = z.object({
  clientLineId: z.string().refine(isUUIDv7),
  itemId: z.string().refine((id) => id === "" || isUUIDv7(id)),
  uomId: z.string().refine((id) => id === "" || isUUIDv7(id)),
  quantity: z.string().max(40),
}).strict();
const contactText = (maximum: number) => z.string().refine((value) => [...value].length <= maximum);
const selectedContact = z.object({
  customerPartyId: z.string().refine(isUUIDv7), partyId: z.string().refine(isUUIDv7),
  displayName: contactText(200), relationshipType: z.enum(QUOTATION_CONTACT_RELATIONSHIPS),
  relationshipLabel: contactText(120).nullable(), isPrimary: z.boolean(),
  email: contactText(255).nullable(), mobile: contactText(255).nullable(), phone: contactText(255).nullable(),
}).strict().nullable();
const replacementSourceSchema = z.object({
  quotationId: z.string().refine(isUUIDv7),
  version: z.number().int().positive(),
  partyId: z.string().refine(isUUIDv7),
  crmCustomerProfileId: z.string().refine(isUUIDv7),
  displayName: z.string().min(1).max(500),
}).strict();
export type QuotationReplacementSource = z.infer<typeof replacementSourceSchema>;
export const QUOTATION_REPLACEMENT_PARAM = "replace";

function handoffKey(actor: string, headers: Record<string, string>, quotationId?: string): string {
  const base = `${QUOTATION_HANDOFF_STORAGE_KEY}:${actor}`;
  return quotationId ? `${base}:replacement:${quotationScopeKey(headers)}:${quotationId}` : base;
}

const replacementCreateSchema = z.object({ key: z.string().refine(isUUIDv7), body: z.string().min(1) }).strict();

function replacementCreateKey(actor: string, headers: Record<string, string>, quotationId: string): string {
  return `${handoffKey(actor, headers, quotationId)}:create`;
}

export function readQuotationReplacementCreateKey(actor: string, headers: Record<string, string>, quotationId: string): string | undefined {
  if (!hasQuotationScope(headers) || !isUUIDv7(quotationId)) return undefined;
  const raw = safeSessionStorage.getItem(replacementCreateKey(actor, headers, quotationId));
  try { return raw ? replacementCreateSchema.parse(JSON.parse(raw)).key : undefined; }
  catch { return undefined; }
}

/** Record the exact collection payload and key before sending its first request. */
export function rememberQuotationReplacementCreate(actor: string, headers: Record<string, string>,
  quotationId: string, create: CreateQuotationRequest) {
  if (!hasQuotationScope(headers) || !isUUIDv7(quotationId)) return null;
  const slot = replacementCreateKey(actor, headers, quotationId);
  const body = JSON.stringify(create);
  try {
    const storage = window.sessionStorage;
    const raw = storage.getItem(slot);
    if (raw !== null) {
      const existing = replacementCreateSchema.parse(JSON.parse(raw));
      return { key: existing.key, matches: existing.body === body, first: false };
    }
    const key = generateUUIDv7();
    const value = JSON.stringify({ key, body });
    storage.setItem(slot, value);
    return storage.getItem(slot) === value ? { key, matches: true, first: true } : null;
  } catch { return null; }
}

const envelope = z.object({
  format: z.literal(1), createdAt: z.number().finite(),
  replacementSource: replacementSourceSchema.optional(),
  replacementHandoffId: z.string().refine(isUUIDv7).optional(),
  fields: z.object({
    selected: z.object({
      partyId: z.string().refine(isUUIDv7), displayName: z.string().max(500),
      partyType: z.enum(["PERSON", "ORGANIZATION"]),
      crmCustomerProfileId: z.string().refine(isUUIDv7).nullable(),
      commercialAccountStatus: z.string().max(100), eligibilitySource: z.string().max(100),
      quotationSelectable: z.boolean(), denialCode: z.string().max(200).nullable(),
    }).strict().nullable(), currencyCode: z.string().max(3), draftReference: z.string().max(80),
    contactPartyId: z.string().max(36), selectedContact, validUntil: z.string().max(10),
    paymentTermCode: z.string().max(500), incotermCode: z.string().max(500),
    deliveryDays: z.string().max(20), warrantyMonths: z.string().max(20),
    discount: quotationDiscountDraftSchema.default(defaultQuotationDiscount),
  }).strict(),
  scope: z.record(z.string(), z.string()), partialHeader: z.unknown(),
  lines: z.array(localLine).max(1_000), items: z.array(z.unknown()).max(1_000),
  units: z.record(z.string(), z.array(z.unknown()).max(100)),
}).strict();

export function readQuotationHandoff(actor: string, headers: Record<string, string>, quotationId?: string): QuotationComposerHandoff | null {
  if (!hasQuotationScope(headers) || (quotationId !== undefined && !isUUIDv7(quotationId))) return null;
  const key = handoffKey(actor, headers, quotationId);
  const raw = safeSessionStorage.getItem(key);
  if (!raw) return null;
  if (!quotationId) {
    safeSessionStorage.removeItem(key);
    safeSessionStorage.removeItem(QUOTATION_HANDOFF_STORAGE_KEY);
  }
  try {
    const data = envelope.parse(JSON.parse(raw));
    if (Date.now() - data.createdAt > HANDOFF_TTL || data.createdAt > Date.now() + 1_000
      || quotationScopeKey(data.scope) !== quotationScopeKey(headers)) return null;
    const selected = data.fields.selected === null ? null
      : parseQuotationCustomerPage({ items: [data.fields.selected] }).items[0];
    const contact = data.fields.selectedContact === null ? null : {
      ...parseQuotationContactOption(data.fields.selectedContact), customerPartyId: data.fields.selectedContact.customerPartyId,
    };
    if (!quotationContactMatchesCustomer(selected, data.fields.contactPartyId, contact)) return null;
    const partialHeader = data.partialHeader === null ? null : parseQuotation(data.partialHeader);
    if (data.replacementSource?.quotationId !== quotationId
      || (data.replacementSource && (!data.replacementHandoffId || selected || partialHeader || data.fields.contactPartyId))) return null;
    if (partialHeader && (partialHeader.companyId !== headers[COMPANY_SCOPE_HEADER]
      || partialHeader.branchId !== headers[BRANCH_SCOPE_HEADER] || partialHeader.partyId !== selected?.partyId
      || partialHeader.currencyCode !== data.fields.currencyCode
      || (partialHeader.contactPartyId ?? "") !== data.fields.contactPartyId)) return null;
    if (Object.keys(data.fields.discount.lineDiscounts).some((id) => !data.lines.some((line) => line.clientLineId === id))) return null;
    const items = data.items.flatMap((item) => parseTradeItems({
      items: [item], total: 1, page: 1, limit: 1,
    }, "SALES").items);
    const units = Object.fromEntries(Object.entries(data.units).map(([id, values]) => {
      if (!isUUIDv7(id)) throw new Error("INVALID_HANDOFF_ITEM");
      return [id, parseTradeUoms({ items: values, total: values.length, page: 1, limit: 100 }).items];
    }));
    return { ...data.fields, selected, selectedContact: contact, partialHeader, scope: quotationScope(data.scope),
      ...(data.replacementSource ? { replacementSource: data.replacementSource, replacementHandoffId: data.replacementHandoffId } : {}),
      lineDraft: { items, uomsByItem: units, lines: data.lines.map((line) => ({ ...line,
        unitPrice: null, isPricing: false, priceError: null })) } };
  } catch { return null; }
}

export function writeQuotationHandoff(actor: string, snapshot: QuotationComposerHandoff): boolean {
  if (!hasQuotationScope(snapshot.scope)) return false;
  if (!quotationContactMatchesCustomer(snapshot.selected, snapshot.contactPartyId, snapshot.selectedContact)) return false;
  const { scope, partialHeader, lineDraft, replacementSource, replacementHandoffId: _handoffId, ...fields } = snapshot;
  if (replacementSource && (fields.selected || partialHeader || fields.contactPartyId)) return false;
  const candidate = { format: 1, createdAt: Date.now(), fields, scope, partialHeader, replacementSource,
    replacementHandoffId: replacementSource ? generateUUIDv7() : undefined,
    lines: lineDraft.lines.map(({ clientLineId, itemId, uomId, quantity }) => ({ clientLineId, itemId, uomId, quantity })),
    items: lineDraft.items, units: lineDraft.uomsByItem };
  if (!envelope.safeParse(candidate).success) return false;
  const value = JSON.stringify(candidate);
  const key = handoffKey(actor, scope, replacementSource?.quotationId);
  safeSessionStorage.setItem(key, value);
  return safeSessionStorage.getItem(key) === value;
}

/** Consume the exact retained input before a replacement can reach its first write. */
export function consumeQuotationReplacement(actor: string, headers: Record<string, string>,
  quotationId: string, handoffId: string): boolean {
  const snapshot = readQuotationHandoff(actor, headers, quotationId);
  if (snapshot?.replacementHandoffId !== handoffId) return false;
  try {
    window.sessionStorage.removeItem(handoffKey(actor, headers, quotationId));
    return true;
  } catch { return false; }
}
