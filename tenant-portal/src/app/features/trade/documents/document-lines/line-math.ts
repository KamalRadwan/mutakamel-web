import { cmp, formatPercentCap, isDecimal, isZero, mul, sub } from '../shared/decimal';
import { lineEvidence, rateBpsFromPercent } from '../shared/document-evidence';
import type {
  Dec,
  DocumentKind,
  EditableLine,
  ItemTaxDefault,
  LineEvidence,
  LineTaxInput,
  TaxCategory,
} from '../shared/document.model';
import { newIdempotencyKey } from '../../shared/trade-api';
import { formatMoney } from '../../shared/trade-format';
import type { ItemSummary, TaxDefault } from '../../shared/trade-foundation.model';

export const MAX_DOCUMENT_LINES = 1000;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_DISCOUNT_REASON_LENGTH = 240;

const ARITHMETIC_DECIMAL_RE = /^-?\d+(?:\.\d+)?$/;

export interface ComputedEditableLine extends EditableLine {
  subtotal: Dec;
  taxTotal: Dec;
  lineTotal: Dec;
  evidence: LineEvidence | null;
}

export type LineFieldKey =
  | 'item'
  | 'description'
  | 'quantity'
  | 'unit'
  | 'discount'
  | 'charge'
  | 'taxCategory'
  | 'taxRate';

export interface LineValidationContext {
  inclusiveTax?: boolean;
  allowedUomIds?: readonly string[] | null;
  discountMode?: 'none' | 'line';
  currencyCode?: string;
}

export interface LineValidationError {
  field: LineFieldKey;
  key: string;
  params?: Record<string, string>;
}

export function isArithmeticDecimal(value: Dec | null | undefined): value is Dec {
  return typeof value === 'string' && ARITHMETIC_DECIMAL_RE.test(value);
}

export function safeDec(value: Dec | null | undefined): Dec {
  return isArithmeticDecimal(value) ? value : '0';
}

export function safeIsZero(value: Dec | null | undefined): boolean {
  return !isArithmeticDecimal(value) || isZero(value);
}

export function createEmptyEditableLine(): EditableLine {
  return {
    clientLineId: newIdempotencyKey(),
    itemId: null,
    itemLabel: '',
    description: '',
    uomId: null,
    quantity: '1',
    unitPrice: null,
    discount: null,
    discountTotal: '0',
    chargeTotal: '0',
    tax: null,
    taxLocked: false,
    expectedDate: null,
    receivingNodeId: null,
    maxDiscountAmount: null,
    maxDiscountPercent: null,
    locked: false,
  };
}

export function ratePercentFromBps(rateBps: number): Dec {
  if (!Number.isFinite(rateBps) || rateBps <= 0) {
    return '0';
  }
  return mul(String(rateBps), '0.01', 2);
}

export function rateBpsFromPercentInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!isDecimal(trimmed, { maxDecimals: 2 })) {
    return null;
  }
  if (cmp(trimmed, '100') > 0) {
    return null;
  }
  return Number(mul(trimmed, '100', 0));
}

export function taxInputFromDefault(taxDefault: ItemTaxDefault | TaxDefault | null): {
  tax: LineTaxInput;
  taxLocked: boolean;
  inclusiveTax: boolean;
} {
  if (!taxDefault) {
    return {
      tax: { category: 'STANDARD', rateBps: 0 },
      taxLocked: false,
      inclusiveTax: false,
    };
  }

  const rateBps = rateBpsFromPercent(taxDefault.rate);
  const code = taxDefault.code.toUpperCase();
  const category: TaxCategory = code === 'EXEMPT' ? 'EXEMPT' : rateBps > 0 ? 'STANDARD' : 'ZERO';

  return {
    tax: {
      category,
      rateBps: category === 'STANDARD' ? rateBps : 0,
    },
    taxLocked: true,
    inclusiveTax: taxDefault.isInclusive === true,
  };
}

export function allowedUomIdsForSummary(summary: ItemSummary): string[] {
  const seen = new Set<string>();
  const candidates = [
    summary.baseUomId,
    summary.defaultUomId,
    summary.defaultPurchaseUomId,
    summary.companyProfile?.defaultSalesUomId ?? null,
    summary.companyProfile?.defaultPurchaseUomId ?? null,
  ];
  for (const id of candidates) {
    if (id) {
      seen.add(id);
    }
  }
  return Array.from(seen);
}

export function recomputeLine(kind: DocumentKind, line: EditableLine, currencyCode: string): ComputedEditableLine {
  const hasPrice = line.unitPrice !== null && isArithmeticDecimal(line.unitPrice);
  const validQuantity = isArithmeticDecimal(line.quantity);

  switch (kind) {
    case 'quotation': {
      const discountTotal = safeDec(line.discountTotal);
      const subtotal = hasPrice && validQuantity ? mul(line.quantity, line.unitPrice!, 8) : '0';
      const lineTotal = hasPrice && validQuantity ? sub(subtotal, discountTotal) : '0';
      return {
        ...line,
        discountTotal,
        subtotal,
        taxTotal: '0',
        lineTotal,
        evidence: null,
      };
    }

    case 'sales-order':
    case 'purchase-order': {
      const discountTotal = kind === 'purchase-order' ? '0' : safeDec(line.discountTotal);
      const chargeTotal = safeDec(line.chargeTotal);
      const quantity = validQuantity ? line.quantity : '0';
      const unitPrice = hasPrice ? line.unitPrice! : '0';
      const normalizedTax: LineTaxInput | null = line.tax
        ? {
            category: line.tax.category,
            rateBps: line.tax.category === 'STANDARD' ? line.tax.rateBps : 0,
          }
        : null;

      const evidence = lineEvidence(
        {
          quantity,
          unitPrice,
          discountTotal,
          chargeTotal,
          tax: normalizedTax,
        },
        currencyCode,
      );

      return {
        ...line,
        discountTotal: evidence.discountTotal,
        tax: normalizedTax,
        subtotal: evidence.subtotal,
        taxTotal: evidence.taxTotal,
        lineTotal: evidence.lineTotal,
        evidence,
      };
    }

    case 'purchase-quotation': {
      const subtotal = hasPrice && validQuantity ? mul(line.quantity, line.unitPrice!, 8) : '0';
      return {
        ...line,
        discountTotal: '0',
        subtotal,
        taxTotal: '0',
        lineTotal: subtotal,
        evidence: null,
      };
    }
  }
}

export function validateLineFields(
  kind: DocumentKind,
  line: EditableLine,
  ctx: LineValidationContext = {},
): Partial<Record<LineFieldKey, LineValidationError>> {
  const errors: Partial<Record<LineFieldKey, LineValidationError>> = {};
  const isOrder = kind === 'sales-order' || kind === 'purchase-order';

  if (!line.itemId) {
    errors.item = { field: 'item', key: 'tdlines.errors.itemRequired' };
  } else if (isOrder && ctx.inclusiveTax) {
    errors.item = { field: 'item', key: 'tdlines.errors.inclusiveTax' };
  }

  if ((kind === 'quotation' || kind === 'purchase-quotation') && line.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = { field: 'description', key: 'tdlines.errors.descriptionMax' };
  }

  if (!isDecimal(line.quantity, { positive: true, maxDecimals: 8 })) {
    errors.quantity = { field: 'quantity', key: 'tdlines.errors.quantity' };
  }

  if (!line.uomId) {
    errors.unit = { field: 'unit', key: 'tdlines.errors.unitRequired' };
  } else if (ctx.allowedUomIds && ctx.allowedUomIds.length > 0 && !ctx.allowedUomIds.includes(line.uomId)) {
    errors.unit = { field: 'unit', key: 'tdlines.errors.unit' };
  }

  if (kind === 'quotation' && ctx.discountMode === 'line' && line.discount !== null) {
    const rawValue = line.discount.value.trim();
    if (rawValue !== '') {
      if (!isDecimal(rawValue, { maxDecimals: 8 })) {
        errors.discount = { field: 'discount', key: 'tdlines.errors.discountInvalid' };
      } else if (line.discount.type === 'PERCENT') {
        const max =
          line.maxDiscountPercent !== null && isArithmeticDecimal(line.maxDiscountPercent)
            ? line.maxDiscountPercent
            : '100';
        if (cmp(rawValue, max) > 0) {
          errors.discount = {
            field: 'discount',
            key: 'tdlines.maxLimit',
            params: { max: formatPercentCap(max) },
          };
        }
      } else if (
        line.maxDiscountAmount !== null &&
        isArithmeticDecimal(line.maxDiscountAmount) &&
        cmp(rawValue, line.maxDiscountAmount) > 0
      ) {
        errors.discount = {
          field: 'discount',
          key: 'tdlines.maxAmountLimit',
          params: { max: formatMoney(ctx.currencyCode ?? null, line.maxDiscountAmount) },
        };
      }
    }
  }

  if (isOrder) {
    const rawCharge = line.chargeTotal.trim();
    if (rawCharge !== '' && !isDecimal(rawCharge, { maxDecimals: 8 })) {
      errors.charge = { field: 'charge', key: 'tdlines.errors.charge' };
    }

    if (!line.tax) {
      errors.taxCategory = { field: 'taxCategory', key: 'tdlines.errors.taxCategoryRequired' };
    } else if (
      line.tax.category === 'STANDARD' &&
      (!Number.isFinite(line.tax.rateBps) || line.tax.rateBps < 0 || line.tax.rateBps > 10000)
    ) {
      errors.taxRate = { field: 'taxRate', key: 'tdlines.errors.taxRate' };
    }
  }

  return errors;
}

export function validateLine(
  kind: DocumentKind,
  line: EditableLine,
  ctx: LineValidationContext = {},
): string[] {
  const fieldErrors = validateLineFields(kind, line, ctx);
  return Object.values(fieldErrors).map((err) => err.key);
}
