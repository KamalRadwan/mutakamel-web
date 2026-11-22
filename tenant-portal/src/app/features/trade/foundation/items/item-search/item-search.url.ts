import type { SearchFacet, SearchField } from '../../../../../shared/ui/facet-search/facet-search.model';
import type { ItemKind, ItemUsagePurpose } from '../../../shared/trade-foundation.model';
import { ITEM_KINDS, type ItemListFilter, type ItemListScope } from '../items.model';
import { ITEM_FACET_FIELDS } from './item-search.fields';

export interface ItemFacetUrlParams {
  q?: string | null;
  kind?: string | null;
  purpose?: string | null;
  img?: string | null;
  cat?: string | null;
}

const FILTER_PURPOSES: readonly ItemUsagePurpose[] = ['SALES', 'PURCHASE'];

function parseKind(raw: string | null | undefined): ItemKind | undefined {
  if (!raw) return undefined;
  return (ITEM_KINDS as readonly string[]).includes(raw) ? (raw as ItemKind) : undefined;
}

function parsePurpose(raw: string | null | undefined, scope: ItemListScope): ItemUsagePurpose | undefined {
  if (scope !== 'company' || !raw) return undefined;
  return (FILTER_PURPOSES as readonly string[]).includes(raw) ? (raw as ItemUsagePurpose) : undefined;
}

function parseImage(raw: string | null | undefined): boolean | undefined {
  if (raw === 'yes') return true;
  if (raw === 'no') return false;
  return undefined;
}

function parseCategory(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const first = raw
    .split(',')
    .map((part) => part.trim())
    .find(Boolean);
  return first || undefined;
}

export function urlParamsToFilter(params: ItemFacetUrlParams, scope: ItemListScope): ItemListFilter {
  const search = params.q?.trim() || undefined;
  const itemKind = parseKind(params.kind?.trim());
  const purpose = parsePurpose(params.purpose?.trim(), scope);
  const hasImage = parseImage(params.img?.trim());
  const categoryId = parseCategory(params.cat);

  return {
    ...(search ? { search } : {}),
    ...(itemKind ? { itemKind } : {}),
    ...(purpose ? { purpose } : {}),
    ...(hasImage !== undefined ? { hasImage } : {}),
    ...(categoryId ? { categoryId, includeSubcategories: true } : {}),
  };
}

export function filterToFacets(filter: ItemListFilter, fields: readonly SearchField[]): SearchFacet[] {
  const facets: SearchFacet[] = [];
  const fieldById = new Map(fields.map((field) => [field.id, field]));

  if (filter.search) {
    const meta = fieldById.get(ITEM_FACET_FIELDS.text);
    facets.push({
      field: ITEM_FACET_FIELDS.text,
      label: meta?.label ?? ITEM_FACET_FIELDS.text,
      values: [{ value: filter.search, label: filter.search }],
    });
  }

  if (filter.itemKind) {
    const meta = fieldById.get(ITEM_FACET_FIELDS.kind);
    const label = meta?.options?.find((opt) => opt.value === filter.itemKind)?.label ?? filter.itemKind;
    facets.push({
      field: ITEM_FACET_FIELDS.kind,
      label: meta?.label ?? ITEM_FACET_FIELDS.kind,
      values: [{ value: filter.itemKind, label }],
    });
  }

  if (filter.purpose) {
    const meta = fieldById.get(ITEM_FACET_FIELDS.purpose);
    if (meta) {
      const label = meta.options?.find((opt) => opt.value === filter.purpose)?.label ?? filter.purpose;
      facets.push({
        field: ITEM_FACET_FIELDS.purpose,
        label: meta.label,
        values: [{ value: filter.purpose, label }],
      });
    }
  }

  if (filter.categoryId) {
    const meta = fieldById.get(ITEM_FACET_FIELDS.category);
    const label = meta?.options?.find((opt) => opt.value === filter.categoryId)?.label ?? filter.categoryId;
    facets.push({
      field: ITEM_FACET_FIELDS.category,
      label: meta?.label ?? ITEM_FACET_FIELDS.category,
      values: [{ value: filter.categoryId, label }],
    });
  } else if (filter.categoryIds?.length) {
    const meta = fieldById.get(ITEM_FACET_FIELDS.category);
    facets.push({
      field: ITEM_FACET_FIELDS.category,
      label: meta?.label ?? ITEM_FACET_FIELDS.category,
      values: filter.categoryIds.map((id) => ({
        value: id,
        label: meta?.options?.find((opt) => opt.value === id)?.label ?? id,
      })),
    });
  }

  if (filter.hasImage !== undefined) {
    const val = filter.hasImage ? 'yes' : 'no';
    const meta = fieldById.get(ITEM_FACET_FIELDS.image);
    const label = meta?.options?.find((opt) => opt.value === val)?.label ?? val;
    facets.push({
      field: ITEM_FACET_FIELDS.image,
      label: meta?.label ?? ITEM_FACET_FIELDS.image,
      values: [{ value: val, label }],
    });
  }

  return facets;
}

export function facetsToFilter(facets: readonly SearchFacet[], scope: ItemListScope): ItemListFilter {
  const filter: ItemListFilter = {};

  for (const facet of facets) {
    if (!facet.values.length) continue;
    const last = facet.values[facet.values.length - 1];

    switch (facet.field) {
      case ITEM_FACET_FIELDS.text: {
        const clean = last.value.trim();
        if (clean) filter.search = clean;
        break;
      }
      case ITEM_FACET_FIELDS.kind: {
        const parsed = parseKind(last.value);
        if (parsed) filter.itemKind = parsed;
        break;
      }
      case ITEM_FACET_FIELDS.purpose: {
        const parsed = parsePurpose(last.value, scope);
        if (parsed) filter.purpose = parsed;
        break;
      }
      case ITEM_FACET_FIELDS.image: {
        const parsed = parseImage(last.value);
        if (parsed !== undefined) filter.hasImage = parsed;
        break;
      }
      case ITEM_FACET_FIELDS.category: {
        const clean = last.value.trim();
        if (clean) {
          filter.categoryId = clean;
          filter.includeSubcategories = true;
        }
        break;
      }
    }
  }

  return filter;
}

export function filterToUrlParams(
  filter: ItemListFilter,
  scope: ItemListScope,
): Record<'q' | 'kind' | 'purpose' | 'img' | 'cat', string | null> {
  return {
    q: filter.search?.trim() || null,
    kind: filter.itemKind ?? null,
    purpose: scope === 'company' ? (filter.purpose ?? null) : null,
    img: filter.hasImage === true ? 'yes' : filter.hasImage === false ? 'no' : null,
    cat: filter.categoryId ?? (filter.categoryIds?.length ? filter.categoryIds.join(',') : null),
  };
}

export function hasActiveFilter(filter: ItemListFilter): boolean {
  return Boolean(
    filter.search ||
      filter.itemKind ||
      filter.purpose ||
      filter.hasImage !== undefined ||
      filter.categoryId ||
      (filter.categoryIds && filter.categoryIds.length > 0) ||
      filter.ownerUserId,
  );
}
