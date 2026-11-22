import { add, mul, round, sub } from './decimal';
import type {
  Dec,
  ItemTaxDefault,
  LineEvidence,
  LineTaxInput,
  QuotationTotals,
  TaxCategory,
  TaxSnapshot,
  TotalsEvidence,
} from './document.model';

export type { LineEvidence, TotalsEvidence, QuotationTotals };

export interface LineEvidenceInput {
  quantity: Dec;
  unitPrice: Dec | null;
  discountTotal?: Dec | null;
  chargeTotal?: Dec | null;
  tax?: LineTaxInput | null;
  taxDefault?: (Pick<ItemTaxDefault, 'rate' | 'isInclusive'> & { code?: string }) | null;
}

export type TotalsEvidenceLine =
  | LineEvidence
  | LineEvidenceInput
  | {
      subtotal?: Dec;
      orderedQuantity?: Dec;
      unitPrice?: Dec;
      discountTotal?: Dec | null;
      chargeTotal?: Dec | null;
      taxTotal?: Dec | null;
      lineTotal: Dec;
    };

export interface QuotationTotalsLine {
  quantity: Dec;
  unitPrice: Dec | null;
  discountTotal?: Dec | null;
}

export function rateBpsFromPercent(rate: Dec): number {
  return Number(mul(rate, '100', 2));
}

function resolveTaxInput(line: LineEvidenceInput): LineTaxInput {
  if (line.tax) {
    const { category, rateBps } = line.tax;
    return {
      category,
      rateBps: category === 'ZERO' || category === 'EXEMPT' ? 0 : rateBps,
    };
  }
  if (line.taxDefault) {
    const rateBps = rateBpsFromPercent(line.taxDefault.rate);
    const code = line.taxDefault.code?.toUpperCase();
    if (code === 'EXEMPT') {
      return { category: 'EXEMPT', rateBps: 0 };
    }
    if (rateBps > 0) {
      return { category: 'STANDARD', rateBps };
    }
    return { category: 'ZERO', rateBps: 0 };
  }
  return { category: 'ZERO', rateBps: 0 };
}

export function lineEvidence(line: LineEvidenceInput, currencyCode: string): LineEvidence {
  const inclusiveTax = line.taxDefault?.isInclusive === true;
  const discountTotal = add(line.discountTotal ?? '0', '0');
  const chargeTotal = add(line.chargeTotal ?? '0', '0');
  const subtotal = mul(line.quantity, line.unitPrice ?? '0', 8);
  const taxableBase = add(sub(subtotal, discountTotal), chargeTotal);

  const { category, rateBps }: { category: TaxCategory; rateBps: number } = resolveTaxInput(line);
  const rateDecimal = rateBps === 0 ? '0' : mul(String(rateBps), '0.0001', 8);
  const taxTotal = rateBps === 0 ? '0' : mul(taxableBase, rateDecimal, 8);
  const lineTotal = add(taxableBase, taxTotal);

  const taxSnapshot: TaxSnapshot = {
    category,
    rateBps,
    taxableBase,
    taxAmount: taxTotal,
    currencyCode,
  };

  return {
    subtotal,
    taxableBase,
    discountTotal,
    chargeTotal,
    taxTotal,
    lineTotal,
    taxSnapshot,
    inclusiveTax,
  };
}

export function totalsEvidence(
  lines: readonly TotalsEvidenceLine[],
  currencyDecimalPlaces: number,
): TotalsEvidence {
  let subtotal: Dec = '0';
  let discountTotal: Dec = '0';
  let chargeTotal: Dec = '0';
  let taxTotal: Dec = '0';
  let sumLine: Dec = '0';

  for (const line of lines) {
    if ('lineTotal' in line) {
      const lineDiscount = add(line.discountTotal ?? '0', '0');
      const lineCharge = add(line.chargeTotal ?? '0', '0');
      const lineTax = add(line.taxTotal ?? '0', '0');
      const lineTotal = add(line.lineTotal, '0');
      const lineSubtotal =
        'subtotal' in line && line.subtotal !== undefined
          ? add(line.subtotal, '0')
          : 'orderedQuantity' in line && line.orderedQuantity !== undefined && 'unitPrice' in line && line.unitPrice !== undefined
            ? mul(line.orderedQuantity, line.unitPrice, 8)
            : sub(add(sub(lineTotal, lineTax), lineDiscount), lineCharge);

      subtotal = add(subtotal, lineSubtotal);
      discountTotal = add(discountTotal, lineDiscount);
      chargeTotal = add(chargeTotal, lineCharge);
      taxTotal = add(taxTotal, lineTax);
      sumLine = add(sumLine, lineTotal);
    } else {
      const ev = lineEvidence(line, '');
      subtotal = add(subtotal, ev.subtotal);
      discountTotal = add(discountTotal, ev.discountTotal);
      chargeTotal = add(chargeTotal, ev.chargeTotal);
      taxTotal = add(taxTotal, ev.taxTotal);
      sumLine = add(sumLine, ev.lineTotal);
    }
  }

  const grandTotal = round(sumLine, currencyDecimalPlaces);
  const roundingTotal = sub(grandTotal, sumLine);

  return {
    subtotal,
    discountTotal,
    chargeTotal,
    taxTotal,
    roundingTotal,
    grandTotal,
    amountPaid: '0',
    amountDue: grandTotal,
  };
}

export function quotationTotals(lines: readonly QuotationTotalsLine[]): QuotationTotals {
  let subtotal: Dec = '0';
  let discountTotal: Dec = '0';

  for (const line of lines) {
    subtotal = add(subtotal, mul(line.quantity, line.unitPrice ?? '0', 8));
    discountTotal = add(discountTotal, line.discountTotal ?? '0');
  }

  return {
    subtotal,
    discountTotal,
    grandTotal: sub(subtotal, discountTotal),
  };
}
