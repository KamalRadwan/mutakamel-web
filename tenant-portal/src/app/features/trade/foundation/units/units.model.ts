import type { LocalizedNames, Uom, UomStatus } from '../../shared/trade-foundation.model';

export type UnitStatusFilter = 'ACTIVE' | 'RETIRED' | 'ALL';

export interface CreateUomBody {
  code: string;
  displayName: string;
  localizedNames: LocalizedNames;
}

export interface UpdateUomBody {
  displayName?: string;
  localizedNames?: LocalizedNames;
  status?: UomStatus;
}

export interface UomListPage {
  items: Uom[];
  total: number;
  page: number;
  limit: number;
  source: 'AUTHORIZED_TRADE_UOM_MASTER';
}

export const UOM_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,31}$/;
export const UOM_CODE_CANONICAL_PATTERN = /^[A-Z][A-Z0-9._-]{0,31}$/;
export const UOM_LOCALE_KEY_PATTERN = /^[a-z]{2}(?:-[A-Z]{2})?$/;

export const UOM_LIMITS = {
  codeMax: 32,
  nameMax: 160,
  localizedMin: 1,
  localizedMax: 20,
  searchMax: 80,
} as const;

export const UOM_REF_KEYS = [
  'ITEM_BASE',
  'COMPANY_DEFAULT',
  'PRICE_ENTRY',
  'PURCHASE_QUOTATION_DRAFT',
  'QUOTATION_OPEN',
  'ORDER_OPEN',
  'SALES_INVOICE_DRAFT',
  'CONVERSION',
  'STOCK',
  'RESERVATION',
] as const;

export type UomRefKey = (typeof UOM_REF_KEYS)[number];

export interface UomReferenceGroup {
  key: UomRefKey;
  count: number;
}

export interface UomReferences {
  blocking: boolean;
  groups: UomReferenceGroup[];
}

export function compareUomsByCode(a: Uom, b: Uom): number {
  return a.code.localeCompare(b.code);
}

export function uomNameIn(uom: Uom, lang: 'en' | 'ar'): string {
  return uom.localizedNames[lang] ?? uom.displayName;
}

export function filterUomsBySearch(units: readonly Uom[], search: string): Uom[] {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return units.slice().sort(compareUomsByCode);
  }

  const prefixMatches: Uom[] = [];
  const nameMatches: Uom[] = [];

  for (const unit of units) {
    if (unit.code.toLowerCase().startsWith(needle)) {
      prefixMatches.push(unit);
      continue;
    }
    const matchesDisplay = unit.displayName.toLowerCase().includes(needle);
    const matchesLocalized = Object.values(unit.localizedNames).some((name) => name.toLowerCase().includes(needle));
    if (matchesDisplay || matchesLocalized) {
      nameMatches.push(unit);
    }
  }

  prefixMatches.sort(compareUomsByCode);
  nameMatches.sort(compareUomsByCode);
  return [...prefixMatches, ...nameMatches];
}

export function parseUomRefGroupsFromDetails(details: unknown): UomReferenceGroup[] {
  if (!details || typeof details !== 'object') {
    return [];
  }

  const allowed = new Set<string>(UOM_REF_KEYS);
  const counts = new Map<UomRefKey, number>();
  const addCount = (key: unknown, rawCount: unknown): void => {
    if (typeof key !== 'string' || !allowed.has(key)) return;
    const count =
      typeof rawCount === 'number'
        ? rawCount
        : typeof rawCount === 'string'
          ? Number(rawCount.trim())
          : Number.NaN;
    if (Number.isInteger(count) && count > 0) {
      counts.set(key as UomRefKey, count);
    }
  };

  const record = details as Record<string, unknown>;
  if (Array.isArray(record['groups'])) {
    for (const entry of record['groups']) {
      if (entry && typeof entry === 'object') {
        const item = entry as Record<string, unknown>;
        addCount(item['key'], item['count']);
      } else if (typeof entry === 'string') {
        const match = /^([A-Z_]+)\s*[:=]\s*(\d+)$/.exec(entry.trim());
        if (match) {
          addCount(match[1], match[2]);
        }
      }
    }
  }

  for (const key of UOM_REF_KEYS) {
    const raw = record[key];
    if (Array.isArray(raw)) {
      if (raw.length > 0) {
        addCount(key, raw[0]);
      }
    } else if (raw !== undefined) {
      addCount(key, raw);
    }
  }

  return UOM_REF_KEYS.filter((key) => (counts.get(key) ?? 0) > 0).map((key) => ({
    key,
    count: counts.get(key)!,
  }));
}
