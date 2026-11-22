import { describe, expect, it } from 'vitest';
import type { EditableLine } from '../shared/document.model';
import type { ItemSummary } from '../../shared/trade-foundation.model';
import {
  allowedUomIdsForSummary,
  createEmptyEditableLine,
  rateBpsFromPercentInput,
  ratePercentFromBps,
  recomputeLine,
  taxInputFromDefault,
  validateLine,
  validateLineFields,
} from './line-math';

function makeLine(overrides: Partial<EditableLine> = {}): EditableLine {
  return {
    ...createEmptyEditableLine(),
    clientLineId: 'line-1',
    itemId: 'item-49',
    itemLabel: 'ST-220 · Steel shelf 220 cm',
    description: 'Steel shelf 220 cm',
    uomId: 'uom-pcs',
    quantity: '1',
    unitPrice: '100',
    tax: { category: 'STANDARD', rateBps: 1400 },
    ...overrides,
  };
}

describe('line-math', () => {
  it('matches the mockup sales order line 1 total (5027.4)', () => {
    const input = makeLine({
      quantity: '4',
      unitPrice: '1150',
      discountTotal: '230',
      chargeTotal: '40',
      tax: { category: 'STANDARD', rateBps: 1400 },
    });

    const result = recomputeLine('sales-order', input, 'USD');

    expect(result.subtotal).toBe('4600');
    expect(result.taxTotal).toBe('617.4');
    expect(result.lineTotal).toBe('5027.4');
    expect(result.evidence?.taxableBase).toBe('4410');
    expect(result.evidence?.taxSnapshot).toEqual({
      category: 'STANDARD',
      rateBps: 1400,
      taxableBase: '4410',
      taxAmount: '617.4',
      currencyCode: 'USD',
    });
  });

  it('matches the mockup purchase order line 1 total (879510) and ignores line discounts', () => {
    const input = makeLine({
      quantity: '50',
      unitPrice: '15430',
      discountTotal: '500',
      chargeTotal: '0',
      tax: { category: 'STANDARD', rateBps: 1400 },
    });

    const result = recomputeLine('purchase-order', input, 'EGP');

    expect(result.subtotal).toBe('771500');
    expect(result.discountTotal).toBe('0');
    expect(result.taxTotal).toBe('108010');
    expect(result.lineTotal).toBe('879510');
  });

  it('passes through quotation discountTotal and computes lineTotal without tax', () => {
    const input = makeLine({
      quantity: '5',
      unitPrice: '1850',
      discountTotal: '462.5',
      tax: null,
    });

    const result = recomputeLine('quotation', input, 'EGP');

    expect(result.subtotal).toBe('9250');
    expect(result.discountTotal).toBe('462.5');
    expect(result.taxTotal).toBe('0');
    expect(result.lineTotal).toBe('8787.5');
    expect(result.evidence).toBeNull();
  });

  it('computes purchase quotation lineTotal as quantity * unitPrice and handles null unitPrice', () => {
    const priced = recomputeLine(
      'purchase-quotation',
      makeLine({ quantity: '3', unitPrice: '95.125' }),
      'USD',
    );
    expect(priced.lineTotal).toBe('285.375');
    expect(priced.taxTotal).toBe('0');

    const unpriced = recomputeLine(
      'purchase-quotation',
      makeLine({ quantity: '3', unitPrice: null }),
      'USD',
    );
    expect(unpriced.lineTotal).toBe('0');
    expect(unpriced.subtotal).toBe('0');
  });

  it('forces rateBps to 0 for ZERO and EXEMPT order lines without mutating the input', () => {
    const original = makeLine({
      quantity: '2',
      unitPrice: '500',
      discountTotal: '0',
      chargeTotal: '0',
      tax: { category: 'EXEMPT', rateBps: 1400 },
    });

    const result = recomputeLine('sales-order', original, 'EGP');

    expect(result.tax).toEqual({ category: 'EXEMPT', rateBps: 0 });
    expect(result.taxTotal).toBe('0');
    expect(result.lineTotal).toBe('1000');
    expect(original.tax).toEqual({ category: 'EXEMPT', rateBps: 1400 });
  });

  it('validates required item, positive quantity, unit, tax category, and inclusive tax', () => {
    const emptyErrors = validateLine(
      'sales-order',
      makeLine({ itemId: null, uomId: null, quantity: '0', tax: null }),
    );
    expect(emptyErrors).toContain('tdlines.errors.itemRequired');
    expect(emptyErrors).toContain('tdlines.errors.quantity');
    expect(emptyErrors).toContain('tdlines.errors.unitRequired');
    expect(emptyErrors).toContain('tdlines.errors.taxCategoryRequired');

    const inclusiveOrder = validateLine(
      'purchase-order',
      makeLine(),
      { inclusiveTax: true },
    );
    expect(inclusiveOrder).toContain('tdlines.errors.inclusiveTax');

    const inclusiveQuote = validateLine(
      'quotation',
      makeLine({ tax: null }),
      { inclusiveTax: true },
    );
    expect(inclusiveQuote).not.toContain('tdlines.errors.inclusiveTax');
    expect(inclusiveQuote).not.toContain('tdlines.errors.taxCategoryRequired');
  });

  it('validates allowed UOMs, discount caps, charge, description length, and tax rate', () => {
    const disallowedUom = validateLine(
      'sales-order',
      makeLine({ uomId: 'uom-kg' }),
      { allowedUomIds: ['uom-pcs', 'uom-box'] },
    );
    expect(disallowedUom).toContain('tdlines.errors.unit');

    const overPercentFields = validateLineFields(
      'quotation',
      makeLine({
        tax: null,
        discount: { type: 'PERCENT', value: '15' },
        maxDiscountPercent: '10',
      }),
      { discountMode: 'line' },
    );
    expect(overPercentFields.discount).toEqual({
      field: 'discount',
      key: 'tdlines.maxLimit',
      params: { max: '10' },
    });

    const overAmountFields = validateLineFields(
      'quotation',
      makeLine({
        tax: null,
        discount: { type: 'AMOUNT', value: '300' },
        maxDiscountAmount: '250',
      }),
      { discountMode: 'line', currencyCode: 'EGP' },
    );
    expect(overAmountFields.discount).toEqual({
      field: 'discount',
      key: 'tdlines.maxAmountLimit',
      params: { max: 'EGP 250' },
    });

    const badOrderFields = validateLineFields(
      'sales-order',
      makeLine({
        chargeTotal: '-10',
        tax: { category: 'STANDARD', rateBps: 15000 },
      }),
    );
    expect(badOrderFields.charge?.key).toBe('tdlines.errors.charge');
    expect(badOrderFields.taxRate?.key).toBe('tdlines.errors.taxRate');

    const longDesc = validateLine(
      'purchase-quotation',
      makeLine({ description: 'x'.repeat(501), tax: null }),
    );
    expect(longDesc).toContain('tdlines.errors.descriptionMax');
  });

  it('derives tax inputs, rate conversions, allowed UOMs, and fresh UUIDv7 lines', () => {
    expect(taxInputFromDefault(null)).toEqual({
      tax: { category: 'STANDARD', rateBps: 0 },
      taxLocked: false,
      inclusiveTax: false,
    });

    expect(
      taxInputFromDefault({
        taxId: 'tax-vat14',
        code: 'VAT14',
        name: 'VAT 14%',
        rate: '14.000',
        isInclusive: false,
      }),
    ).toEqual({
      tax: { category: 'STANDARD', rateBps: 1400 },
      taxLocked: true,
      inclusiveTax: false,
    });

    expect(
      taxInputFromDefault({
        taxId: 'tax-exempt',
        code: 'EXEMPT',
        name: 'Exempt',
        rate: '0.000',
        isInclusive: false,
      }),
    ).toEqual({
      tax: { category: 'EXEMPT', rateBps: 0 },
      taxLocked: true,
      inclusiveTax: false,
    });

    expect(
      taxInputFromDefault({
        taxId: 'tax-vat14-incl',
        code: 'VAT14I',
        name: 'VAT 14% inclusive',
        rate: '14.000',
        isInclusive: true,
      }).inclusiveTax,
    ).toBe(true);

    expect(ratePercentFromBps(1400)).toBe('14');
    expect(ratePercentFromBps(725)).toBe('7.25');
    expect(ratePercentFromBps(0)).toBe('0');

    expect(rateBpsFromPercentInput('14')).toBe(1400);
    expect(rateBpsFromPercentInput('7.25')).toBe(725);
    expect(rateBpsFromPercentInput('100.01')).toBeNull();
    expect(rateBpsFromPercentInput('14.123')).toBeNull();

    const summary = {
      id: 'item-50',
      sku: 'BX-12',
      canonicalCode: 'BX-12',
      itemKind: 'PRODUCT',
      status: 'ACTIVE',
      displayName: 'Storage box',
      localizedNames: { en: 'Storage box' },
      categoryId: null,
      image: null,
      baseUomId: 'uom-pcs',
      defaultUomId: 'uom-box',
      defaultPurchaseUomId: 'uom-pcs',
      trackingMode: 'NONE',
      companyProfile: {
        id: 'cp-1',
        version: 1,
        canSell: true,
        canPurchase: true,
        canPos: false,
        trackInventory: true,
        trackingMode: 'NONE',
        defaultSalesUomId: 'uom-box',
        defaultPurchaseUomId: 'uom-ctn',
        salesPrice: '100',
        currencyCode: 'EGP',
      },
      salesTaxDefault: null,
      purchaseTaxDefault: null,
    } satisfies ItemSummary;

    expect(allowedUomIdsForSummary(summary)).toEqual(['uom-pcs', 'uom-box', 'uom-ctn']);

    const a = createEmptyEditableLine();
    const b = createEmptyEditableLine();
    expect(a.clientLineId).not.toBe(b.clientLineId);
    expect(a.quantity).toBe('1');
  });
});
