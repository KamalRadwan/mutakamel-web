import type { LocalizedNames } from '../trade-foundation.model';

export type TermType = 'PAYMENT' | 'DELIVERY' | 'WARRANTY' | 'RETURNS' | 'GENERAL';
export const TERM_TYPES: readonly TermType[] = ['PAYMENT', 'DELIVERY', 'WARRANTY', 'RETURNS', 'GENERAL'];

export type TermSide = 'SALES' | 'PURCHASE' | 'BOTH';
export const TERM_SIDES: readonly TermSide[] = ['SALES', 'PURCHASE', 'BOTH'];

export type TermDocumentType = 'QUOTATION' | 'SALES_ORDER' | 'PURCHASE_ORDER' | 'PURCHASE_QUOTATION';

export const INCOTERMS = ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'] as const;
export type Incoterm = (typeof INCOTERMS)[number];

export const TERM_CODE_PATTERN = /^[A-Z][A-Z0-9_-]{1,39}$/;

export const TERM_LIMITS = {
  nameMin: 1,
  nameMax: 120,
  textMin: 1,
  textMax: 400,
  dueDaysMin: 0,
  dueDaysMax: 3650,
  maxClauses: 4,
} as const;

export interface TradeTerm {
  id: string;
  termType: TermType;
  side: TermSide;
  code: string;
  displayName: string;
  localizedNames: LocalizedNames;
  localizedTexts: LocalizedNames;
  dueDays: number | null;
  incotermCode: Incoterm | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  version: number;
  updatedAt: string;
}

export interface TermInput {
  termType: TermType;
  side: TermSide;
  code: string;
  localizedNames: LocalizedNames;
  localizedTexts: LocalizedNames;
  /** PAYMENT only: omit the key for every other type (the backend rejects even null). */
  dueDays?: number | null;
  /** DELIVERY only: omit the key for every other type (the backend rejects even null). */
  incotermCode?: Incoterm | null;
  /** Optional: the backend defaults to 0. */
  sortOrder?: number;
  /** Optional: the backend defaults to true. */
  isActive?: boolean;
}

export type TermPatch = Partial<Omit<TermInput, 'termType' | 'code'>>;

export interface TermOptions {
  byType: Record<TermType, TradeTerm[]>;
  defaults: Partial<Record<TermType, string>>;
}

export interface TermSelections {
  paymentTermId?: string;
  deliveryTermId?: string;
  warrantyTermId?: string;
  clauseIds?: string[];
}

export interface TermSelectionsInput {
  paymentTermId?: string | null;
  deliveryTermId?: string | null;
  warrantyTermId?: string | null;
  clauseIds?: readonly string[] | null;
}

/** Drops unset, null, or blank selection keys so document bodies never send null (backend 400). */
export function termSelectionsBody(sel: TermSelectionsInput | null | undefined): TermSelections {
  if (!sel) return {};
  const body: TermSelections = {};
  const paymentTermId = sel.paymentTermId?.trim();
  if (paymentTermId) body.paymentTermId = paymentTermId;
  const deliveryTermId = sel.deliveryTermId?.trim();
  if (deliveryTermId) body.deliveryTermId = deliveryTermId;
  const warrantyTermId = sel.warrantyTermId?.trim();
  if (warrantyTermId) body.warrantyTermId = warrantyTermId;
  const clauseIds = sel.clauseIds?.map((id) => id.trim()).filter((id) => id.length > 0);
  if (clauseIds && clauseIds.length > 0) body.clauseIds = clauseIds;
  return body;
}

export const TERM_SIDE_OF: Record<TermDocumentType, 'SALES' | 'PURCHASE'> = {
  QUOTATION: 'SALES',
  SALES_ORDER: 'SALES',
  PURCHASE_ORDER: 'PURCHASE',
  PURCHASE_QUOTATION: 'PURCHASE',
};

export const TERM_LIST_LIMITS = { defaultLimit: 25, maxLimit: 100 } as const;

/** GET /terms query: `active` absent = active and inactive; page from 1; limit 1..100 (default 25). */
export interface ListTermsQuery {
  type?: TermType;
  side?: TermSide;
  active?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface TermPage {
  items: TradeTerm[];
  total: number;
  page: number;
  limit: number;
}

/** GET /terms/counts query: `active` absent = active and inactive. */
export interface CountTermsQuery {
  active?: boolean;
}

export interface TermCounts {
  total: number;
  byType: Record<TermType, number>;
}
