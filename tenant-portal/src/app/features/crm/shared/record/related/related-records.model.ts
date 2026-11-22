/** Record types the related-counts endpoint accepts. */
export type RelatedRecordType = 'LEAD' | 'CUSTOMER_PROFILE';

/** Record types that can host the related badges; OPPORTUNITY supplies its own counts loader. */
export type RelatedHostType = RelatedRecordType | 'OPPORTUNITY';

export type RelatedKind = 'leads' | 'opportunities' | 'quotations' | 'salesOrders' | 'invoices';

export const DEFAULT_RELATED_KINDS: readonly RelatedKind[] = [
  'leads',
  'opportunities',
  'quotations',
  'salesOrders',
  'invoices',
];

export interface RelatedCountsBody {
  branchId: string;
  recordType: RelatedRecordType;
  recordIds: string[];
}

export interface RelatedCounts {
  partyId: string;
  leads: number | null;
  opportunities: number | null;
  quotations: number | null;
  salesOrders: number | null;
  invoices: number | null;
}

export interface RelatedCountsResponse {
  countsByRecordId: Record<string, RelatedCounts>;
}

export interface RelatedLinkIds {
  recordId: string;
  partyId: string | null;
  partyLabel: string | null;
  recordType?: RelatedHostType;
}

export interface RelatedLinkTarget {
  commands: string[];
  queryParams: Record<string, string>;
}

export type RelatedLinkFn = (ids: RelatedLinkIds) => RelatedLinkTarget;

export interface RelatedBadgeClickEvent {
  kind: RelatedKind;
  target: RelatedLinkTarget;
  event: MouseEvent;
}

export interface RelatedKindMeta {
  icon: string;
  labelKey: string;
}

export const RELATED_KIND_META: Record<RelatedKind, RelatedKindMeta> = {
  leads: { icon: 'tablerUserSearch', labelKey: 'recordRelated.kinds.leads' },
  opportunities: { icon: 'tablerTargetArrow', labelKey: 'recordRelated.kinds.opportunities' },
  quotations: { icon: 'tablerFileDescription', labelKey: 'recordRelated.kinds.quotations' },
  salesOrders: { icon: 'tablerShoppingCart', labelKey: 'recordRelated.kinds.salesOrders' },
  invoices: { icon: 'tablerFileInvoice', labelKey: 'recordRelated.kinds.invoices' },
};

function partyParams(partyId: string | null, partyLabel: string | null): Record<string, string> {
  const params: Record<string, string> = {};
  if (partyId) params['partyId'] = partyId;
  const label = partyLabel?.trim();
  if (label) params['partyLabel'] = label;
  return params;
}

function partyIdParams(partyId: string | null): Record<string, string> {
  return partyId ? { partyId } : {};
}

export const RELATED_LIST_LINKS: Record<RelatedKind, RelatedLinkFn> = {
  leads: ({ recordId, partyId, partyLabel, recordType }) => {
    const queryParams = partyParams(partyId, partyLabel);
    if (recordType === 'LEAD' && recordId) {
      queryParams['excludeId'] = recordId;
    }
    return { commands: ['/crm/leads'], queryParams };
  },
  opportunities: ({ partyId, partyLabel }) => {
    const queryParams: Record<string, string> = {};
    if (partyId) queryParams['customerPartyId'] = partyId;
    const label = partyLabel?.trim();
    if (label) queryParams['partyLabel'] = label;
    return { commands: ['/crm/opportunities'], queryParams };
  },
  quotations: ({ partyId }) => ({
    commands: ['/trade/documents/quotations'],
    queryParams: partyIdParams(partyId),
  }),
  salesOrders: ({ partyId }) => ({
    commands: ['/trade/documents/sales-orders'],
    queryParams: partyIdParams(partyId),
  }),
  invoices: ({ partyId }) => ({
    commands: ['/trade/documents/invoices'],
    queryParams: partyIdParams(partyId),
  }),
};
