import type { DocumentKind } from './document.model';

export type LineColumn =
  | 'item'
  | 'description'
  | 'quantity'
  | 'unit'
  | 'price'
  | 'discount'
  | 'charge'
  | 'taxCategory'
  | 'taxRate'
  | 'taxAmount'
  | 'expectedDate'
  | 'receivingNode'
  | 'total';

export type StatusStepTone = 'default' | 'success' | 'danger';

export interface StatusStep {
  value: string;
  labelKey: string;
  tone: StatusStepTone;
}

export type PrintPurpose = 'CUSTOMER_QUOTATION' | 'SALES_ORDER' | 'PURCHASE_ORDER' | 'SUPPLIER_QUOTATION';
export type DocumentPartyRole = 'customer' | 'supplier';

export interface KindConfig {
  kind: DocumentKind;
  segment: string;
  icon: string;
  tile: string;
  titleKey: string;
  newKey: string;
  statuses: StatusStep[];
  searchable: boolean;
  lineColumns: LineColumn[];
  printPurpose: PrintPurpose;
  partyRole: DocumentPartyRole;
}

function statusStep(value: string, tone: StatusStepTone = 'default'): StatusStep {
  return {
    value,
    labelKey: `td.status.${value}`,
    tone,
  };
}

export const KIND_CONFIG: Record<DocumentKind, KindConfig> = {
  quotation: {
    kind: 'quotation',
    segment: 'quotations',
    icon: 'tablerFileDescription',
    tile: 'bg-icon-teal',
    titleKey: 'td.kinds.quotation.one',
    newKey: 'td.kinds.quotation.new',
    statuses: [
      statusStep('DRAFT', 'default'),
      statusStep('SENT', 'default'),
      statusStep('ACCEPTED', 'success'),
      statusStep('CONVERTED', 'success'),
      statusStep('REJECTED', 'danger'),
      statusStep('EXPIRED', 'danger'),
      statusStep('CANCELLED', 'danger'),
    ],
    searchable: true,
    lineColumns: ['item', 'description', 'quantity', 'unit', 'price', 'discount', 'total'],
    printPurpose: 'CUSTOMER_QUOTATION',
    partyRole: 'customer',
  },
  'sales-order': {
    kind: 'sales-order',
    segment: 'sales-orders',
    icon: 'tablerClipboardCheck',
    tile: 'bg-icon-green',
    titleKey: 'td.kinds.sales-order.one',
    newKey: 'td.kinds.sales-order.new',
    statuses: [
      statusStep('DRAFT', 'default'),
      statusStep('CONFIRMED', 'success'),
      statusStep('CANCELLED', 'danger'),
    ],
    searchable: true,
    lineColumns: [
      'item',
      'quantity',
      'unit',
      'price',
      'discount',
      'charge',
      'taxCategory',
      'taxRate',
      'taxAmount',
      'total',
    ],
    printPurpose: 'SALES_ORDER',
    partyRole: 'customer',
  },
  'purchase-order': {
    kind: 'purchase-order',
    segment: 'purchase-orders',
    icon: 'tablerShoppingCart',
    tile: 'bg-icon-orange',
    titleKey: 'td.kinds.purchase-order.one',
    newKey: 'td.kinds.purchase-order.new',
    statuses: [
      statusStep('DRAFT', 'default'),
      statusStep('CONFIRMED', 'success'),
      statusStep('CANCELLED', 'danger'),
    ],
    searchable: false,
    lineColumns: [
      'item',
      'quantity',
      'unit',
      'price',
      'charge',
      'taxCategory',
      'taxRate',
      'taxAmount',
      'expectedDate',
      'total',
    ],
    printPurpose: 'PURCHASE_ORDER',
    partyRole: 'supplier',
  },
  'purchase-quotation': {
    kind: 'purchase-quotation',
    segment: 'purchase-quotations',
    icon: 'tablerFileSearch',
    tile: 'bg-icon-blue',
    titleKey: 'td.kinds.purchase-quotation.one',
    newKey: 'td.kinds.purchase-quotation.new',
    statuses: [
      statusStep('DRAFT', 'default'),
      statusStep('ISSUED', 'success'),
      statusStep('CONVERTED', 'success'),
      statusStep('CANCELLED', 'danger'),
    ],
    searchable: false,
    lineColumns: ['item', 'description', 'quantity', 'unit', 'price', 'total'],
    printPurpose: 'SUPPLIER_QUOTATION',
    partyRole: 'supplier',
  },
};

const SEGMENT_TO_KIND: Readonly<Record<string, DocumentKind>> = {
  quotations: 'quotation',
  'sales-orders': 'sales-order',
  'purchase-orders': 'purchase-order',
  'purchase-quotations': 'purchase-quotation',
};

export function kindFromSegment(segment: string | null | undefined): DocumentKind | null {
  if (!segment) return null;
  return Object.prototype.hasOwnProperty.call(SEGMENT_TO_KIND, segment) ? SEGMENT_TO_KIND[segment] : null;
}
