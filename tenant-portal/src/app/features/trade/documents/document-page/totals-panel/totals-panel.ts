import { Component, computed, input } from '@angular/core';
import { TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import { formatMoney } from '../../../shared/trade-format';
import { isZero, neg } from '../../shared/decimal';
import { quotationTotals, totalsEvidence } from '../../shared/document-evidence';
import type {
  Dec,
  DocumentKind,
  EditableLine,
  QuotationRevision,
  TotalsSnapshot,
} from '../../shared/document.model';

interface TotalRow {
  readonly key: string;
  readonly labelKey: string;
  readonly amount: string;
  readonly isGrand?: boolean;
}

const ARITHMETIC_DECIMAL_RE = /^-?\d+(?:\.\d+)?$/;

function safeDecimal(raw: Dec | null | undefined): Dec {
  return typeof raw === 'string' && ARITHMETIC_DECIMAL_RE.test(raw) ? raw : '0';
}

function formatDiscountAmount(currency: string, discount: Dec): string {
  const safe = safeDecimal(discount);
  return formatMoney(currency, isZero(safe) ? '0' : neg(safe));
}

@Component({
  selector: 'app-totals-panel',
  imports: [TranslocoPipe],
  providers: [provideTranslocoScope({ scope: 'trade-shared', alias: 'tradeShared' }, { scope: 'trade-documents-page', alias: 'tdpg' })],
  templateUrl: './totals-panel.html',
  host: { class: 'flex justify-end' },
})
export class TotalsPanel {
  readonly kind = input.required<DocumentKind>();
  readonly currencyCode = input.required<string>();
  readonly lines = input.required<readonly EditableLine[]>();
  readonly totalsSnapshot = input<TotalsSnapshot | null>(null);
  readonly quotationRevision = input<QuotationRevision | null>(null);
  readonly readonly = input(false);
  readonly currencyDecimalPlaces = input(2);

  protected readonly view = computed<{ primaryRows: TotalRow[]; grandRow: TotalRow; trailingRows: TotalRow[] }>(() => {
    const kind = this.kind();
    const currency = this.currencyCode();
    const lines = this.lines();
    const useSnapshot = this.readonly();

    if (kind === 'quotation') {
      const rev = useSnapshot ? this.quotationRevision() : null;
      const computed = rev ?? quotationTotals(
        lines.map((line) => ({
          quantity: safeDecimal(line.quantity),
          unitPrice: line.unitPrice !== null && ARITHMETIC_DECIMAL_RE.test(line.unitPrice) ? line.unitPrice : '0',
          discountTotal: safeDecimal(line.discountTotal),
        })),
      );

      return {
        primaryRows: [
          { key: 'subtotal', labelKey: 'tdpg.totals.subtotal', amount: formatMoney(currency, computed.subtotal) },
          {
            key: 'discount',
            labelKey: 'tdpg.totals.discount',
            amount: formatDiscountAmount(currency, computed.discountTotal),
          },
        ],
        grandRow: {
          key: 'grandTotal',
          labelKey: 'tdpg.totals.grandTotal',
          amount: formatMoney(currency, computed.grandTotal),
          isGrand: true,
        },
        trailingRows: [],
      };
    }

    if (kind === 'purchase-quotation') {
      const snap = useSnapshot ? this.totalsSnapshot() : null;
      const ev = snap ?? totalsEvidence(
        lines.map((line) => ({
          quantity: safeDecimal(line.quantity),
          unitPrice: line.unitPrice !== null && ARITHMETIC_DECIMAL_RE.test(line.unitPrice) ? line.unitPrice : '0',
          discountTotal: '0',
          chargeTotal: '0',
          tax: null,
        })),
        this.currencyDecimalPlaces(),
      );

      return {
        primaryRows: [
          { key: 'subtotal', labelKey: 'tdpg.totals.subtotal', amount: formatMoney(currency, ev.subtotal) },
        ],
        grandRow: {
          key: 'grandTotal',
          labelKey: 'tdpg.totals.grandTotal',
          amount: formatMoney(currency, ev.grandTotal),
          isGrand: true,
        },
        trailingRows: [],
      };
    }

    const snap = useSnapshot ? this.totalsSnapshot() : null;
    const isPurchaseOrder = kind === 'purchase-order';
    const dp = snap?.currencyDecimalPlaces ?? this.currencyDecimalPlaces();
    const ev = snap ?? totalsEvidence(
      lines.map((line) => ({
        quantity: safeDecimal(line.quantity),
        unitPrice: line.unitPrice !== null && ARITHMETIC_DECIMAL_RE.test(line.unitPrice) ? line.unitPrice : '0',
        discountTotal: isPurchaseOrder ? '0' : safeDecimal(line.discountTotal),
        chargeTotal: safeDecimal(line.chargeTotal),
        tax: line.tax,
      })),
      dp,
    );

    const primaryRows: TotalRow[] = [
      { key: 'subtotal', labelKey: 'tdpg.totals.subtotal', amount: formatMoney(currency, ev.subtotal) },
    ];
    if (!isPurchaseOrder) {
      primaryRows.push({
        key: 'discount',
        labelKey: 'tdpg.totals.discount',
        amount: formatDiscountAmount(currency, ev.discountTotal),
      });
    }
    primaryRows.push(
      { key: 'charges', labelKey: 'tdpg.totals.charges', amount: formatMoney(currency, ev.chargeTotal) },
      { key: 'tax', labelKey: 'tdpg.totals.tax', amount: formatMoney(currency, ev.taxTotal) },
      { key: 'rounding', labelKey: 'tdpg.totals.rounding', amount: formatMoney(currency, ev.roundingTotal) },
    );

    return {
      primaryRows,
      grandRow: {
        key: 'grandTotal',
        labelKey: 'tdpg.totals.grandTotal',
        amount: formatMoney(currency, ev.grandTotal),
        isGrand: true,
      },
      trailingRows: [
        { key: 'amountDue', labelKey: 'tdpg.totals.amountDue', amount: formatMoney(currency, ev.amountDue) },
      ],
    };
  });
}
