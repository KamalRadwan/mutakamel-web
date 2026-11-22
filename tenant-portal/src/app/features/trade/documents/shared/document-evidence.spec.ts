import { describe, expect, it } from 'vitest';
import { lineEvidence, quotationTotals, totalsEvidence } from './document-evidence';

describe('document-evidence', () => {
  it('matches the mockup sales order line and total math', () => {
    const line1 = lineEvidence(
      {
        quantity: '4',
        unitPrice: '1150',
        discountTotal: '230',
        chargeTotal: '40',
        tax: { category: 'STANDARD', rateBps: 1400 },
      },
      'USD',
    );
    expect(line1).toEqual({
      subtotal: '4600',
      taxableBase: '4410',
      discountTotal: '230',
      chargeTotal: '40',
      taxTotal: '617.4',
      lineTotal: '5027.4',
      taxSnapshot: {
        category: 'STANDARD',
        rateBps: 1400,
        taxableBase: '4410',
        taxAmount: '617.4',
        currencyCode: 'USD',
      },
      inclusiveTax: false,
    });

    const line2 = lineEvidence(
      {
        quantity: '4',
        unitPrice: '95.125',
        discountTotal: '0',
        chargeTotal: '0',
        tax: { category: 'EXEMPT', rateBps: 0 },
      },
      'USD',
    );
    expect(line2.subtotal).toBe('380.5');
    expect(line2.taxTotal).toBe('0');
    expect(line2.lineTotal).toBe('380.5');

    const totals = totalsEvidence([line1, line2], 2);
    expect(totals).toEqual({
      subtotal: '4980.5',
      discountTotal: '230',
      chargeTotal: '40',
      taxTotal: '617.4',
      roundingTotal: '0',
      grandTotal: '5407.9',
      amountPaid: '0',
      amountDue: '5407.9',
    });

    const fromRawInputs = totalsEvidence(
      [
        {
          quantity: '4',
          unitPrice: '1150',
          discountTotal: '230',
          chargeTotal: '40',
          tax: { category: 'STANDARD', rateBps: 1400 },
        },
        {
          quantity: '4',
          unitPrice: '95.125',
          discountTotal: '0',
          chargeTotal: '0',
          tax: { category: 'EXEMPT', rateBps: 0 },
        },
      ],
      2,
    );
    expect(fromRawInputs).toEqual(totals);
  });

  it('matches the mockup purchase order lines and totals', () => {
    const poLine1 = lineEvidence(
      {
        quantity: '50',
        unitPrice: '15430',
        chargeTotal: '0',
        tax: { category: 'STANDARD', rateBps: 1400 },
      },
      'EGP',
    );
    expect(poLine1.subtotal).toBe('771500');
    expect(poLine1.taxTotal).toBe('108010');
    expect(poLine1.lineTotal).toBe('879510');

    const poLine2 = lineEvidence(
      {
        quantity: '200',
        unitPrice: '480',
        chargeTotal: '0',
        tax: { category: 'STANDARD', rateBps: 1400 },
      },
      'EGP',
    );
    expect(poLine2.subtotal).toBe('96000');
    expect(poLine2.taxTotal).toBe('13440');
    expect(poLine2.lineTotal).toBe('109440');

    const totals = totalsEvidence([poLine1, poLine2], 2);
    expect(totals).toEqual({
      subtotal: '867500',
      discountTotal: '0',
      chargeTotal: '0',
      taxTotal: '121450',
      roundingTotal: '0',
      grandTotal: '988950',
      amountPaid: '0',
      amountDue: '988950',
    });
  });

  it('computes positive rounding for zero-decimal currencies such as JPY', () => {
    const totals = totalsEvidence([{ lineTotal: '100.6' }], 0);
    expect(totals.grandTotal).toBe('101');
    expect(totals.roundingTotal).toBe('0.4');
    expect(totals.amountPaid).toBe('0');
    expect(totals.amountDue).toBe('101');
  });

  it('computes negative rounding when rounded grand total is less than the line sum', () => {
    const zeroDp = totalsEvidence([{ lineTotal: '100.4' }], 0);
    expect(zeroDp.grandTotal).toBe('100');
    expect(zeroDp.roundingTotal).toBe('-0.4');
    expect(zeroDp.amountDue).toBe('100');

    const twoDp = totalsEvidence([{ lineTotal: '10.004' }], 2);
    expect(twoDp.grandTotal).toBe('10');
    expect(twoDp.roundingTotal).toBe('-0.004');
    expect(twoDp.amountDue).toBe('10');
  });

  it('flags inclusive tax defaults, derives bps from item defaults, and zeroes ZERO/EXEMPT rates', () => {
    const inclusive = lineEvidence(
      {
        quantity: '1',
        unitPrice: '100',
        taxDefault: { rate: '14', isInclusive: true },
      },
      'EGP',
    );
    expect(inclusive.inclusiveTax).toBe(true);
    expect(inclusive.taxSnapshot.rateBps).toBe(1400);

    const fromDefault = lineEvidence(
      {
        quantity: '2',
        unitPrice: '500',
        taxDefault: { rate: '14', isInclusive: false },
      },
      'EGP',
    );
    expect(fromDefault.inclusiveTax).toBe(false);
    expect(fromDefault.taxSnapshot.category).toBe('STANDARD');
    expect(fromDefault.taxSnapshot.rateBps).toBe(1400);
    expect(fromDefault.taxTotal).toBe('140');
    expect(fromDefault.lineTotal).toBe('1140');

    const zeroTax = lineEvidence(
      {
        quantity: '2',
        unitPrice: '500',
        tax: { category: 'ZERO', rateBps: 1400 },
      },
      'EGP',
    );
    expect(zeroTax.taxSnapshot.rateBps).toBe(0);
    expect(zeroTax.taxTotal).toBe('0');
    expect(zeroTax.lineTotal).toBe('1000');

    const fractionalBps = lineEvidence(
      {
        quantity: '10',
        unitPrice: '100',
        tax: { category: 'STANDARD', rateBps: 725.5 },
      },
      'USD',
    );
    expect(fractionalBps.taxTotal).toBe('72.55');
    expect(fractionalBps.lineTotal).toBe('1072.55');
  });

  it('computes quotation totals without tax', () => {
    expect(
      quotationTotals([
        { quantity: '2', unitPrice: '1850', discountTotal: '70' },
        { quantity: '3', unitPrice: '100.5' },
      ]),
    ).toEqual({
      subtotal: '4001.5',
      discountTotal: '70',
      grandTotal: '3931.5',
    });

    expect(quotationTotals([])).toEqual({
      subtotal: '0',
      discountTotal: '0',
      grandTotal: '0',
    });
  });
});
